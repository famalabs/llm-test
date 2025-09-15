import { MistralAIEmbeddings } from "@langchain/mistralai";
import { RedisVectorStore, RedisVectorStoreFilterType } from "@langchain/redis";
import { Document } from "langchain/document";
import { createClient, RedisClientType } from "redis";
import "dotenv/config";
import { Chunk } from "../lib/chunks/interfaces";

export class VectorStore {
    private store: RedisVectorStore | null = null;
    private client: RedisClientType | null = null;
    private readonly embeddings: MistralAIEmbeddings;
    private readonly indexName: string;

    constructor(indexName: string) {
        this.indexName = this.normalizeIndexName(indexName);
        this.embeddings = new MistralAIEmbeddings({
            model: "mistral-embed",
        });
    }

    private normalizeIndexName(name: string): string {
        return name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
    }

    public async load() {
        if (!process.env.REDIS_URL) {
            throw new Error("Missing REDIS_URL in environment variables.");
        }

        this.client = createClient({ url: process.env.REDIS_URL });
        await this.client.connect();

        console.log('redis client: ', this.client);

        this.store = new RedisVectorStore(this.embeddings, {
            redisClient: this.client as any,
            indexName: this.indexName,
        });

        console.log(`Redis vector store ready. Index: ${this.indexName}`);
    }

    public async add(documents: Document[]) {
        if (!this.store) throw new Error("Store not initialized. Call load() first.");
        await this.store.addDocuments(documents);
        console.log(`Added ${documents.length} documents to index "${this.indexName}"`);
    }

    public async retrieveFromText(
        text: string,
        numResults = 3,
        filter?: Record<string, any>
    ): Promise<Chunk[]> {
        if (!this.store) throw new Error("Store not initialized. Call load() first.");
        const queryEmbedding = await this.embeddings.embedQuery(text);
        return this.retrieve(queryEmbedding, numResults, filter);
    }

    public async retrieve(
        queryEmbedding: number[],
        numResults = 3,
        filter?: Record<string, any>
    ): Promise<Chunk[]> {
        if (!this.store) throw new Error("Store not initialized. Call load() first.");

        const results = await this.store.similaritySearchVectorWithScore(
            queryEmbedding,
            numResults,
            filter as RedisVectorStoreFilterType
        );

        return results.map(([doc, distance]) => ({ ...doc, distance }));
    }

    public async close() {
        if (this.client) {
            await this.client.quit();
            this.client = null;
            console.log("Redis connection closed.");
        }
    }
}
