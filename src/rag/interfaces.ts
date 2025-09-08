export interface RerankingConfig {
    enabled?: boolean;
    llm?: string;
    fewShotsEnabled?: boolean;
    batchSize?: number;
    llmEvaluationWeight?: number;
    reasoningEnabled?: boolean;
    chunkFiltering?: {
        enabled?: boolean;
        thresholdMultiplier?: number;
    };
}

export interface ParentPageRetrievalConfig {
    enabled?: boolean;
    offset?: number;
}

export interface OutputConfig {
    reasoningEnabled?: boolean;
    chunksOrAnswerFormat: 'chunks' | 'answer';
    includeCitations?: boolean;
    fewShotsEnabled?: boolean;
}

export interface RagConfig {
    vectorStoreName: string; // Required parameter
    llm?: string;
    numResults?: number;
    chunkFiltering?: {
        enabled?: boolean;
        thresholdMultiplier?: number;
    };
    reranking?: RerankingConfig;
    parentPageRetrieval?: ParentPageRetrievalConfig;
    output?: OutputConfig;
    verbose?: boolean;
}

export interface ResolvedRerankingConfig {
    enabled: boolean;
    llm: string;
    fewShotsEnabled: boolean;
    batchSize: number;
    llmEvaluationWeight: number;
    reasoningEnabled: boolean;
    chunkFiltering: {
        enabled: boolean;
        thresholdMultiplier: number;
    }
}

export interface ResolvedParentPageRetrievalConfig {
    enabled: boolean;
    offset: number;
}

export interface ResolvedOutputConfig {
    reasoningEnabled: boolean;
    chunksOrAnswerFormat: 'chunks' | 'answer';
    includeCitations: boolean;
    fewShotsEnabled: boolean;
}

export interface ResolvedRagConfig {
    vectorStoreName: string;
    llm: string;
    numResults: number;
    chunkFiltering: {
        enabled: boolean;
        thresholdMultiplier: number;
    };
    reranking: ResolvedRerankingConfig;
    parentPageRetrieval: ResolvedParentPageRetrievalConfig;
    output: ResolvedOutputConfig;
    verbose: boolean;
};