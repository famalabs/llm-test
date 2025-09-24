export interface Embedder {
    embedDocuments: (texts: string[]) => Promise<number[][]>;
    embedQuery: (text: string) => Promise<number[]>;
}