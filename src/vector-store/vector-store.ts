import { MistralAIEmbeddings } from "@langchain/mistralai";
import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { Document } from "langchain/document";
import 'dotenv/config';
import { Chunk } from "../lib/chunks/interfaces";

export class VectorStore {
    private store: FaissStore | null = null;
    private readonly saveDir: string;
    private readonly embeddings: MistralAIEmbeddings;
    private static readonly BASE_DIR = 'vector-stores';

    size: number; 

    constructor(saveDir: string) {
        this.saveDir = `${VectorStore.BASE_DIR}/${this.normalizeStoreName(saveDir)}`;
        this.embeddings = new MistralAIEmbeddings({
            model: "mistral-embed",
        });
    }

    private normalizeStoreName(name:string) : string {
        return name.replace(/[^a-zA-Z09]/g, "_").toLowerCase();
    }

    public async load() {
        try {
            this.store = await FaissStore.load(this.saveDir, this.embeddings);
            this.size = this.store.docstore._docs.size;
            console.log(`Vector store loaded from ${this.saveDir}`);
        } catch (err) {
            console.warn("No vector store found, creating a new one...");
            this.store = await FaissStore.fromTexts([], [], this.embeddings);
        }
    }

    public async add(documents: Document[]) {
        if (!this.store) throw new Error("Store not initialized. Call load() first.");

        await this.store.addDocuments(documents);
        await this.store.save(this.saveDir);
    }

    public async retrieveFromText(text: string, numResults = 3): Promise<Chunk[]> {
        if (!this.store) throw new Error("Store not initialized. Call load() first.");

        const queryEmbedding = await this.embeddings.embedQuery(text);
        return this.retrieve(queryEmbedding, numResults);
    }

    public async retrieve(queryEmbedding: number[], numResults = 3): Promise<Chunk[]> {
        if (!this.store) throw new Error("Store not initialized. Call load() first.");

        const results = await this.store.similaritySearchVectorWithScore(queryEmbedding, numResults);
        return results.map(([doc, distance]) => ({...doc, distance}));
    }
}
