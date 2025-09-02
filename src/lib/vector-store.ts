import { MistralAIEmbeddings } from "@langchain/mistralai";
import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { Document } from "langchain/document";

export class VectorStore {
    private store: FaissStore | null = null;
    private readonly saveDir: string;
    private readonly embeddings: MistralAIEmbeddings;

    constructor(saveDir = "faiss_index") {
        this.saveDir = saveDir;
        this.embeddings = new MistralAIEmbeddings({
            model: "mistral-embed",
        });
    }

    async load(): Promise<void> {
        try {
            this.store = await FaissStore.load(this.saveDir, this.embeddings);
            console.log(`Vector store loaded from ${this.saveDir}`);
        } catch (err) {
            console.warn("No vector store found, creating a new one...");
            this.store = new FaissStore(this.embeddings, {});
        }
    }

    async add(document: Document): Promise<void> {
        if (!this.store) {
            throw new Error("Store not initialized. Call load() first.");
        }
        await this.store.addDocuments([document]);
        await this.store.save(this.saveDir);
    }

    async search(embedding: number[], numResults = 3): Promise<Document[]> {
        if (!this.store) {
            throw new Error("Store not initialized. Call load() first.");
        }
        return this.store.similaritySearchVectorWithScore(embedding, numResults).then(results =>
            results.map(([doc]) => doc)
        );
    }
}
