import { RagConfig, ResolvedRagConfig } from "./interfaces";

const DEFAULT_CONFIG = {
    llm: "mistral-small-latest",
    numResults: 10,
    chunkFiltering: {
        enabled: false,
        thresholdMultiplier: 0.66,
    },
    output: {
        reasoningEnabled: false,
        chunksOrAnswerFormat: 'chunks' as 'chunks' | 'answer',
        includeCitations: false,
        fewShotsEnabled: false,
    },
    reranking: {
        enabled: false,
        llm: "mistral-small-latest",
        fewShotsEnabled: false,
        batchSize: 5,
        llmEvaluationWeight: 0.7,
        reasoningEnabled: false,
        chunkFiltering: {
            enabled: false,
            thresholdMultiplier: 0.66,
        }
    },
    parentPageRetrieval: {
        enabled: false,
        offset: 0,
    },
    verbose: false,
};

export const resolveConfig = (ragConfig: RagConfig): ResolvedRagConfig => {
    return {
        ...DEFAULT_CONFIG,
        ...ragConfig,
        chunkFiltering: {
            ...DEFAULT_CONFIG.chunkFiltering,
            ...ragConfig.chunkFiltering,
        },
        output: {
            ...DEFAULT_CONFIG.output,
            ...ragConfig.output,
        },
        reranking: {
            ...DEFAULT_CONFIG.reranking,
            ...ragConfig.reranking,
            chunkFiltering: {
                ...DEFAULT_CONFIG.reranking.chunkFiltering,
                ...ragConfig.reranking?.chunkFiltering,
            }
        },
        parentPageRetrieval: {
            ...DEFAULT_CONFIG.parentPageRetrieval,
            ...ragConfig.parentPageRetrieval,
        },
    };
}