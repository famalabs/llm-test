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

    constructor(config: VectorStoreConfig) {
        this.config = resolveConfig(config);
        this.client = this.config.client;
        this.embedder = createEmbedder(this.config.embeddingsModel!, this.config.embeddingsProvider!);
    }

    public async load() {
        if (this.loaded) return;
        try {
            await this.client.call("FT.INFO", this.config.indexName);
        } 
        catch (e: any) {
            if (e?.message?.includes("Unknown Index name")) {
                throw new Error(`Index "${this.config.indexName}" does not exist. Create it with ensureIndex() before using VectorStore.`);
            }
            throw e;
        }
        this.loaded = true;
    }

    public embedQuery(query: string): Promise<number[]> {
        return this.embedder.embedQuery(query);
    }

    private deserializeField(value: string): any {
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
        let vectors: number[][] = [];

        if (!fieldToEmbed) {
            if (documents.some(doc => !Array.isArray(doc[EMBEDDING_FIELD]) || doc[EMBEDDING_FIELD].length === 0)) {
                throw new Error(`Documents must have the "${EMBEDDING_FIELD}" field with precomputed embeddings, or specify "fieldToEmbed" in the config.`);
            }
            vectors = documents.map(doc => doc[EMBEDDING_FIELD] as number[]);
        }

        else {
            const contents = documents.map(d => d[fieldToEmbed] ?? "");
            vectors = await this.embedder.embedDocuments(contents);
        }

        const pipeline = this.client.multi();
        for (let i = 0; i < documents.length; i++) {
            const doc = documents[i];
            const key = `${this.config.indexName}:${randomUUID()}`;
            for (const k of Object.keys(doc)) {
                if (typeof doc[k] === "object") (doc as any)[k] = JSON.stringify(doc[k]);
            }
            const value = { ...doc, [EMBEDDING_FIELD]: float32Buffer(vectors[i]!) };
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
        filter?: string,
        returnFields?: string[]
    ): Promise<ReturnDocumentType[]> {
        const filterQuery = filter ?? "*";
        const blob = float32Buffer(queryEmbedding);
        const knnQuery = `${filterQuery}=>[KNN ${numResults} @${EMBEDDING_FIELD} $BLOB AS distance]`;
        const searchArgs = [
            this.config.indexName,
            knnQuery,
            "PARAMS", "2", "BLOB", blob,
            "SORTBY", "distance",
        ];
        if (returnFields && returnFields.length > 0) searchArgs.push(
            "RETURN", (returnFields.length + 1).toString(), "distance", ...returnFields,
        );
        searchArgs.push("DIALECT", "2");

        const res = await this.client.callBuffer("FT.SEARCH", ...searchArgs) as (Buffer | Buffer[])[];
        const docs: ReturnDocumentType[] = [];

        for (let i = 1; i < res.length; i += 2) {
            const fields = res[i + 1] as Buffer[];
            const obj: any = {};
            for (let j = 0; j < fields.length; j += 2) {
                let k = fields[j].toString();
                if (k === EMBEDDING_FIELD) continue;
                let v = fields[j + 1];
                obj[k] = this.deserializeField(v.toString());
            }
            docs.push(obj);
        }

        return docs;
    }

    public async deleteByFilter(filter: string): Promise<number> {
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
            );

            const [total, ...keys] = res as [number, ...string[]];
            if (total == 0 || keys.length == 0) break;

            const pipeline = this.client.multi();
            for (const key of keys) pipeline.call("FT.DEL", indexName, key, "DD");
            await pipeline.exec();
            
            totalDeleted += keys.length;

            offset += PAGE;
            if (offset >= total) break;
        }

        return totalDeleted;
    }

    public async wipe(): Promise<void> {
        const { indexName } = this.config;
        try {
            await this.client.call("FT.DROPINDEX", indexName, "DD");
            this.loaded = false;
        } 
        catch (e: any) {
            if (e?.message?.includes("Unknown Index name")) {
                return;
            }
            throw e;
        }
    }
}