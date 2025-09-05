export interface RerankingConfig {
    enabled?: boolean;
    llm?: string;
    fewShotsEnabled?: boolean;
    batchSize?: number;
    llmEvaluationWeight?: number;
    reasoningEnabled?: boolean;
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
    reranking?: RerankingConfig;
    parentPageRetrieval?: ParentPageRetrievalConfig;
    output?: OutputConfig;
}

export interface ResolvedRerankingConfig {
    enabled: boolean;
    llm: string;
    fewShotsEnabled: boolean;
    batchSize: number;
    llmEvaluationWeight: number;
    reasoningEnabled: boolean;
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
    reranking: ResolvedRerankingConfig;
    parentPageRetrieval: ResolvedParentPageRetrievalConfig;
    output: ResolvedOutputConfig;
}