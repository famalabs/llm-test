import { VectorStoreConfig } from "./interfaces";
import { createEmbedder, Embedder } from "../lib/embeddings";
import { resolveConfig } from "./vector-store.config";
import { float32Buffer } from "../utils";
import { randomUUID } from "crypto";
import Redis from "ioredis";
import "dotenv/config";

export const EMBEDDING_FIELD = "embedding";

export class VectorStore<ReturnDocumentType extends Record<string, any>> {
    private client: Redis;
    private config: VectorStoreConfig;
    private loaded = false;
    private readonly embedder: Embedder;
    private readonly registeredFields = new Set<string>();

    constructor(config: VectorStoreConfig) {
        this.config = resolveConfig(config);
        this.config.indexName = this.normalizeIndexName(this.config.indexName);
        this.client = this.config.client;
        this.embedder = createEmbedder(this.config.embeddingsModel);
    }

    private normalizeIndexName(name: string): string {
        return name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
    }

    public embedQuery(query: string): Promise<number[]> {
        return this.embedder.embedQuery(query);
    }

    public async load() {
        if (this.loaded) return;
        try {
            const info = (await this.client.call("FT.INFO", this.config.indexName)) as Record<string, any>;
            this.rebuildFieldTypesFromInfo(info);
        } catch (e: any) {
            if (e?.message?.includes("Unknown Index name")) {
                throw new Error(`Index "${this.config.indexName}" does not exist. Create it before using VectorStore.`);
            }
            throw e;
        }
        this.loaded = true;
    }

    private rebuildFieldTypesFromInfo(info: Record<string, any>) {
        if (!Array.isArray(info)) return;
        const map: Record<string, any> = {};
        for (let i = 0; i < info.length; i += 2) map[info[i]] = info[i + 1];

        const attributes = map.attributes || map.attrs;
        if (!Array.isArray(attributes)) return;

        for (const attr of attributes) {
            if (!Array.isArray(attr)) continue;
            const obj: Record<string, any> = {};
            for (let i = 0; i < attr.length - 1; i += 2) {
                obj[attr[i]] = attr[i + 1];
            }
            const redisType = obj.type.toString();
            if (redisType === "VECTOR" || !redisType) continue;
            const field = obj.identifier;
            if (!field) continue;
            this.registeredFields.add(field);
        }
    }

    private deserializeField(key: string, value: string): any {
        if (value === "true") return true;
        if (value === "false") return false;

        if (
            (value.startsWith("{") && value.endsWith("}")) ||
            (value.startsWith("[") && value.endsWith("]"))
        ) {
            try {
                return JSON.parse(value);
            } catch {
                return value;
            }
        }

        if (/^-?\d+(\.\d+)?$/.test(value)) {
            try {
                const num = parseFloat(value);
                if (!Number.isNaN(num)) return num;
            } catch { }
        }

        return value;
    }

    public async add(documents: (ReturnDocumentType & { ttl?: number })[]) {
        const fieldToEmbed = this.config.fieldToEmbed;
        const contents = documents.map(d => d[fieldToEmbed] ?? "");
        const vectors = await this.embedder.embedDocuments(contents);

        const pipeline = this.client.multi();
        for (let i = 0; i < documents.length; i++) {
            const doc = documents[i];
            if (doc[fieldToEmbed] == null) {
                throw new Error(`Document at index ${i} missing text field "${fieldToEmbed}".`);
            }
            const key = `${this.config.indexName}:${randomUUID()}`;
            for (const k of Object.keys(doc)) {
                this.registeredFields.add(k);
                if (typeof doc[k] === "object") (doc as any)[k] = JSON.stringify(doc[k]);
            }
            const value = { ...doc, [EMBEDDING_FIELD]: float32Buffer(vectors[i]) };
            pipeline.hset(key, value);
            if (doc.ttl && doc.ttl > 0) pipeline.expire(key, doc.ttl);
        }
        await pipeline.exec();
    }

    public async retrieveFromText(text: string, numResults = 3, filter?: string): Promise<ReturnDocumentType[]> {
        const queryEmbedding = await this.embedQuery(text);
        return this.retrieve(queryEmbedding, numResults, filter);
    }

    public async retrieve(
        queryEmbedding: number[],
        numResults = 3,
        filter?: string
    ): Promise<ReturnDocumentType[]> {
        const filterQuery = filter ?? "*";
        const blob = float32Buffer(queryEmbedding);
        const returnFields = Array.from(this.registeredFields);

        const knnQuery = `${filterQuery}=>[KNN ${numResults} @${EMBEDDING_FIELD} $BLOB AS distance]`;

        const searchArgs = [
            this.config.indexName,
            knnQuery,
            "PARAMS", "2", "BLOB", blob,
            "SORTBY", "distance",
            "RETURN", (returnFields.length + 1).toString(), "distance", ...returnFields,
            "DIALECT", "2"
        ];

        const res = await this.client.callBuffer("FT.SEARCH", ...searchArgs);

        const docs: ReturnDocumentType[] = [];
        if (!Array.isArray(res)) return docs;

        for (let i = 1; i < res.length; i += 2) {
            const fields = res[i + 1];
            if (!Array.isArray(fields)) continue;

            const obj: any = {};
            for (let j = 0; j < fields.length; j += 2) {
                const k = fields[j].toString();
                let v: any = fields[j + 1];
                if (k === EMBEDDING_FIELD) continue;
                obj[k] = this.deserializeField(k, v.toString());
            }
            docs.push(obj);
        }

        return docs;
    }

    public async deleteByFilter(filter = "*"): Promise<number> {
        const { indexName } = this.config;
        let totalDeleted = 0;
        const PAGE = 1000;
        let offset = 0;

        while (true) {
            const res = await this.client.call(
                "FT.SEARCH",
                indexName,
                filter,
                "NOCONTENT",
                "LIMIT", offset.toString(), PAGE.toString(),
                "DIALECT", "2"
            ) as (string | number)[];

            if (!Array.isArray(res) || res.length === 0) break;

            const total = Number(res[0] ?? 0);
            const keys = res.slice(1) as string[];
            if (keys.length === 0) break;

            const pipeline = this.client.multi();
            for (const key of keys) {
                pipeline.call("FT.DEL", indexName, key, "DD");
            }
            await pipeline.exec();
            totalDeleted += keys.length;

            offset += PAGE;
            if (offset >= total) break;
        }

        return totalDeleted;
    }

}