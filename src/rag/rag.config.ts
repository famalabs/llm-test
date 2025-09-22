import { RagConfig } from "./interfaces";

const DEFAULT_CONFIG: Omit<RagConfig, 'vectorStoreName'> = {
    provider: 'mistral',
    llm: "mistral-small-latest",
    numResults: 10,
    reasoningEnabled: false,
    chunksOrAnswerFormat: 'chunks',
    includeCitations: false,
    fewShotsEnabled: false,

    chunkFiltering: {},
    reranking: {},
    parentPageRetrieval: {},
    verbose: false,
};

export const resolveConfig = (ragConfig: RagConfig): RagConfig => {
    return {
        ...DEFAULT_CONFIG,
        ...ragConfig,
        chunkFiltering: {
            ...DEFAULT_CONFIG.chunkFiltering,
            ...ragConfig.chunkFiltering,
        },
        reranking: {
            ...DEFAULT_CONFIG.reranking,
            ...ragConfig.reranking,
        },
        parentPageRetrieval: {
            ...DEFAULT_CONFIG.parentPageRetrieval,
            ...ragConfig.parentPageRetrieval,
        },
    };
}