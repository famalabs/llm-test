export interface Embedder {
    embedDocuments: (texts: string[]) => Promise<number[][]>;
    embedQuery: (text: string) => Promise<number[]>;
}

export type EmbeddingProvider = 'openai' | 'mistral' | 'local' | 'google';