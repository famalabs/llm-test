import { VectorStoreConfig } from "./interfaces";
import { createEmbedder, Embedder } from "../lib/embeddings";
import { resolveConfig } from "./vector-store.config";
import { float32Buffer } from "../utils";
import { randomUUID } from "crypto";
import Redis from "ioredis";
import "dotenv/config";

export const EMBEDDING_FIELD = "embedding";

export class VectorStore<TReturnDocument> {
    private client: Redis;
    private config: VectorStoreConfig;
    private loaded = false;
    private readonly embedder: Embedder;
    private readonly deserializationTypes: Record<string, 'string' | 'number' | 'object' | 'boolean'> = {};
    private readonly fieldTypes: Record<string, string> = {};

    constructor(config: VectorStoreConfig) {
        this.config = resolveConfig(config);
        this.config.indexName = this.normalizeIndexName(this.config.indexName);
        this.client = this.config.client;
        this.embedder = createEmbedder(this.config.embeddingsModel);
    }

    private normalizeIndexName(name: string): string {
        return name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
    }

    public async load() {
        if (this.loaded) return;
        try {
            await this.client.call("FT.INFO", this.config.indexName);
        } catch (e: any) {
            if (e?.message?.includes("Unknown Index name")) {
                throw new Error(`Index "${this.config.indexName}" does not exist. Create it before using VectorStore.`);
            }
            throw e;
        }
        this.loaded = true;
    }

    private buildDocumentPayload(doc: Record<string, any>, vector: number[]): Record<string, any> {
        const fieldToEmbed = this.config.fieldToEmbed;
        const value: Record<string, any> = {
            [fieldToEmbed]: doc[fieldToEmbed],
            [EMBEDDING_FIELD]: float32Buffer(vector)
        };

        for (const [k, raw] of Object.entries(doc)) {
            if (k == "ttl" || k == fieldToEmbed || k == EMBEDDING_FIELD) continue;
            if (raw === undefined || raw === null) continue;

            const fieldType = typeof raw;
            let redisType: string;

            switch (fieldType) {

                case "number":
                    redisType = "NUMERIC";
                    value[k] = Number(raw);
                    this.deserializationTypes[k] = "number";
                    break;

                case "string":
                    redisType = "TEXT";
                    value[k] = String(raw);
                    this.deserializationTypes[k] = "string";
                    break;

                case "boolean":
                    redisType = "TAG";
                    value[k] = String(raw);
                    this.deserializationTypes[k] = "boolean";
                    break;

                case "object":
                    redisType = "TEXT";
                    value[k] = JSON.stringify(raw);
                    this.deserializationTypes[k] = "object";

                    break;

                default:
                    throw new Error(`Unsupported data type for field "${k}": ${fieldType}`);
            }


            if (!this.fieldTypes[k]) {
                this.fieldTypes[k] = redisType;
            }
        }

        return value;
    }

    private deserializeField(key: string, value: string): any {
        const targetType = this.deserializationTypes[key];
        if (!targetType) return value;

        try {
            switch (targetType) {
                case "number":
                    return parseFloat(value);
                case "boolean":
                    return value === "true";
                case "object":
                    return JSON.parse(value);
                case "string":
                    return value;
                default:
                    return value;
            }
        }

        catch (error) {
            console.error(`Error deserializing field "${key}" with value "${value}":`, error);
            return value;
        }
    }

    public async add(documents: ({ [key: string]: any; ttl?: number })[]) {
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
            const value = this.buildDocumentPayload(doc, vectors[i]);

            pipeline.hset(key, value);
            if (doc.ttl && doc.ttl > 0) pipeline.expire(key, doc.ttl);
        }

        await pipeline.exec();
    }

    public async retrieveFromText(text: string, numResults = 3, filter?: string): Promise<TReturnDocument[]> {
        const queryEmbedding = await this.embedder.embedQuery(text);
        return this.retrieve(queryEmbedding, numResults, filter);
    }


    public async retrieve(
        queryEmbedding: number[],
        numResults = 3,
        filter?: string
    ): Promise<TReturnDocument[]> {
        const filterQuery = filter ?? "*";
        const blob = float32Buffer(queryEmbedding);
        const returnFields = Object.keys(this.fieldTypes);

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

        const docs: TReturnDocument[] = [];
        if (!Array.isArray(res)) return docs;

        for (let i = 1; i < res.length; i += 2) {
            const fields = res[i + 1];
            if (!Array.isArray(fields)) continue;

            const obj: any = {};
            for (let j = 0; j < fields.length; j += 2) {
                const k = fields[j].toString();
                let v: any = fields[j + 1];
                if (k === EMBEDDING_FIELD) continue;
                if (k == "distance") v = parseFloat(v);
                obj[k] = this.deserializeField(k, v.toString());
            }
            docs.push(obj);
        }

        return docs;
    }

    public async deleteByFilter(filter?: string): Promise<number> {
        const filterQuery = filter ?? "*";
        let totalDeleted = 0;

        const res = await this.client.call(
            "FT.SEARCH",
            this.config.indexName,
            filterQuery,
            "NOCONTENT"
        ) as string[];


        const keys = res.slice(1);

        // UNLINK faster then DEL
        const pipeline = this.client.multi();
        for (const key of keys) {
            pipeline.unlink(key);
        }
        await pipeline.exec();

        totalDeleted += keys.length;

        return totalDeleted;
    }

}
