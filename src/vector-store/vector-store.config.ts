import { VectorStoreConfig } from "./interfaces";

const DEFAULT_CONFIG: Omit<VectorStoreConfig, 'indexName' | 'indexSchema'| 'client'> = {
    distanceMetric: "COSINE",
    embeddingsModel: "mistral-embed",
};

export const resolveConfig = (vectorStoreConfig: VectorStoreConfig): VectorStoreConfig => {
    return {
        ...DEFAULT_CONFIG,
        ...vectorStoreConfig,
    };
}