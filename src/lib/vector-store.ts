import { MistralAIEmbeddings } from "@langchain/mistralai";
import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { Document } from "langchain/document";
import 'dotenv/config';

export class VectorStore {
    private store: FaissStore | null = null;
    private readonly saveDir: string;
    private readonly embeddings: MistralAIEmbeddings;

    constructor(saveDir: string) {
        this.saveDir = saveDir;
        this.embeddings = new MistralAIEmbeddings({
            model: "mistral-embed",
        });
    }

    async load() {
        try {
            this.store = await FaissStore.load(this.saveDir, this.embeddings);
            console.log(`Vector store loaded from ${this.saveDir}`);
        } catch (err) {
            console.warn("No vector store found, creating a new one...");
            this.store = await FaissStore.fromTexts([], [], this.embeddings);
        }
    }

    async add(documents: Document[]) {
        if (!this.store) throw new Error("Store not initialized. Call load() first.");

        await this.store.addDocuments(documents);
        await this.store.save(this.saveDir);
    }

    async retrieveFromText(text: string, numResults = 3): Promise<Document[]> {
        if (!this.store) throw new Error("Store not initialized. Call load() first.");

        const queryEmbedding = await this.embeddings.embedQuery(text);
        return this.retrieve(queryEmbedding, numResults);
    }

    async retrieve(queryEmbedding: number[], numResults = 3): Promise<Document[]> {
        if (!this.store) throw new Error("Store not initialized. Call load() first.");

        const results = await this.store.similaritySearchVectorWithScore(queryEmbedding, numResults);
        return results.map(([doc, _distance]) => doc);
    }
}
