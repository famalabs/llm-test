/**
 * To execute Redis:
 * sudo docker run -it --rm --name redis-search    -p 6379:6379    redislabs/redisearch
 */

import { MistralAIEmbeddings } from "@langchain/mistralai";
import {
    createClient,
    RedisClientType,
    SCHEMA_FIELD_TYPE,
    SCHEMA_VECTOR_FIELD_ALGORITHM,
} from "redis";
import { randomUUID } from "crypto";
import "dotenv/config";
import { Chunk } from "../lib/chunks/interfaces";

const EMBEDDING_DIMENSION = 1024; // mistral-embed output dimension

function float32Buffer(arr: number[]) {
    return Buffer.from(new Float32Array(arr).buffer);
}

function escapeTagValue(value: string) {
    return value.replace(/([,{}\\])/g, "\\$1").replace(/ /g, "\\ ");
}

export class VectorStore {
    private client: RedisClientType | null = null;
    private readonly embeddings: MistralAIEmbeddings;
    private readonly indexName: string;

    constructor(indexName: string) {
        this.indexName = this.normalizeIndexName(indexName);
        this.embeddings = new MistralAIEmbeddings({ model: "mistral-embed" });
    }

    private normalizeIndexName(name: string): string {
        return name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
    }

    private async ensureIndex() {
        if (!this.client) throw new Error("Client not connected");
        try {
            await this.client.ft.info(this.indexName);
            console.log(`Index "${this.indexName}" exists.`);
            return;
        } catch (e: any) {
            // questo viene rilanciato se l'errore non è dovuto all'assenza dell'indice (ad esempio problemi di connessione o permessi)
            if (!e?.message?.includes("Unknown Index name")) throw e;

            console.log(`Index "${this.indexName}" not found. Creating (FLAT, HASH)...`);
        }

        await this.client.ft.create(
            this.indexName,
            {
                pageContent: { type: SCHEMA_FIELD_TYPE.TEXT }, // da vedere se serve
                embedding: {
                    type: SCHEMA_FIELD_TYPE.VECTOR,
                    ALGORITHM: SCHEMA_VECTOR_FIELD_ALGORITHM.FLAT,
                    TYPE: "FLOAT32",
                    DIM: EMBEDDING_DIMENSION,
                    DISTANCE_METRIC: "COSINE",
                },
                source: { type: SCHEMA_FIELD_TYPE.TAG },
            },
            {
                ON: "HASH",
                PREFIX: `${this.indexName}:`,
            }
        );
        console.log(`Index "${this.indexName}" created.`);
    }

    public async load() {
        if (!process.env.REDIS_URL) {
            throw new Error("Missing REDIS_URL in environment variables.");
        }
        this.client = createClient({ url: process.env.REDIS_URL });
        await this.client.connect();
        console.log("Redis connected.");
        await this.ensureIndex();
        console.log(`Redis vector store ready. Index: ${this.indexName}`);
    }

    public async wipe() {
        if (!this.client) throw new Error("Store not initialized. Call load() first.");
        try {
            await this.client.ft.dropIndex(this.indexName);
            console.log(`Index "${this.indexName}" dropped.`);
        } catch (e: any) {
            // questo viene rilanciato se l'errore non è dovuto all'assenza dell'indice (ad esempio problemi di connessione o permessi)
            if (e?.message?.includes("Unknown Index name")) {
                console.log(`Index "${this.indexName}" does not exist. Nothing to drop.`);
            } else {
                throw e;
            }
        }
        await this.ensureIndex();
    }

    public async add(documents: Chunk[]) {
        if (!this.client) throw new Error("Store not initialized. Call load() first.");
        const contents = documents.map((d) => d.pageContent ?? "");
        const vectors = await this.embeddings.embedDocuments(contents);

        const multi = this.client.multi();
        for (let i = 0; i < documents.length; i++) {
            const doc = documents[i];
            const key = `${this.indexName}:${randomUUID()}`;
            const source = doc.metadata.source;
            const value = {
                pageContent: doc.pageContent,
                embedding: float32Buffer(vectors[i]),
                source: String(source),

                metadata: JSON.stringify(doc.metadata)
            };
            multi.hSet(key, value);
        }
        await multi.exec();
        console.log(`Added ${documents.length} documents to index "${this.indexName}"`);
    }

    public async retrieveFromText(
        text: string,
        numResults = 3,
        filter?: Record<string, any>
    ): Promise<Chunk[]> {
        const queryEmbedding = await this.embeddings.embedQuery(text);
        return this.retrieve(queryEmbedding, numResults, filter);
    }

    public async retrieve(
        queryEmbedding: number[],
        numResults = 3,
        filter?: Record<string, any>
    ): Promise<Chunk[]> {
        if (!this.client) throw new Error("Store not initialized. Call load() first.");

        let filterQuery = "*";
        if (filter && Object.keys(filter).length > 0) {
            const parts: string[] = [];
            if (filter.source) {
                const values = Array.isArray(filter.source) ? filter.source : [filter.source];
                const tagSet = values.map((v: string) => escapeTagValue(String(v))).join("|");
                parts.push(`@source:{${tagSet}}`);
            }
            filterQuery = parts.length ? `(${parts.join(" ")})` : "*";
        }

        const knn = `${filterQuery}=>[KNN ${numResults} @embedding $BLOB AS vector_score]`;
        const blob = float32Buffer(queryEmbedding);
        const res = await this.client.ft.search(this.indexName, knn, {
            PARAMS: { BLOB: blob },
            SORTBY: "vector_score",
            DIALECT: 2,
            RETURN: ["vector_score", "pageContent", "source", "metadata"],
        });

        const docs = (res?.documents ?? []).map((d) => {
            const pageContent = d.value?.pageContent ?? "";
            const source = d.value?.source ?? "";
            const distance = Number(d.value?.vector_score ?? 0);
            let metadata: Record<string, any> = {};
            try {
                metadata = d.value?.metadata ? JSON.parse(String(d.value.metadata)) : {};
            } catch {
                metadata = {};
            }

            const doc = { pageContent, metadata: { source, ...metadata } };
            return { ...doc, distance } as Chunk;
        });

        return docs;
    }

    public async close() {
        if (this.client) {
            await this.client.quit();
            this.client = null;
            console.log("Redis connection closed.");
        }
    }
}
