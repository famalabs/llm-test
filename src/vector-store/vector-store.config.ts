import { VectorStoreConfig } from "./interfaces";

const DEFAULT_CONFIG: Omit<VectorStoreConfig, 'indexName' | 'indexSchema'| 'client'> = {
    distanceMetric: "IP", // since now embeddings are normalized
    embeddingsProvider: "openai",
    embeddingsModel: "text-embedding-3-large",
};

export const resolveConfig = (vectorStoreConfig: VectorStoreConfig): VectorStoreConfig => {
    return {
        ...DEFAULT_CONFIG,
        ...vectorStoreConfig,
    };
}