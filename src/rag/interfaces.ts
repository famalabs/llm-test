import { LanguageModel } from 'ai';

export interface RerankingConfig {
    /** 
     * Name of the LLM used for reranking.
     */
    llm?: string;

    /** 
     * Enables few-shot examples to improve reranking quality.
     */
    fewShotsEnabled?: boolean;

    /** 
     * Maximum number of chunks processed in a single reranking batch.
     */
    batchSize?: number;

    /** 
     * Weight assigned to the LLM evaluation score when combining with vector similarity.
     */
    llmEvaluationWeight?: number;

    /** 
     * Ask for a reasoning sentence during reranking.
     */
    reasoningEnabled?: boolean;

    /** 
     * Configuration for filtering chunks before reranking.
     */
    chunkFiltering?: {
        /**
         * Multiplier that determines the filtering threshold relative to average similarity.
         */
        thresholdMultiplier?: number;
    };
}

export interface ParentPageRetrievalConfig {
    /**
     * Number of lines to include around the ones containing the original chunk.
     */
    offset?: number;
}

export interface RagConfig {
    /**
     * Name of the vector store used to retrieve documents.
     */
    vectorStoreName: string;

    /**
     * Name of the LLM provider.
     */
    provider: 'mistral' | 'google' | 'openai';

    /**
     * Name of the main LLM used for generating answers.
     */
    llm: string;

    /**
     * Number of chunks retrieved from the vector store.
     */
    numResults?: number;

    /**
     * Configuration for filtering chunks based on similarity score.
     */
    chunkFiltering?: {
        /**
         * Multiplier that determines the global filtering threshold.
         */
        thresholdMultiplier?: number;
    };

    /**
     * Configuration for reranking retrieved results.
     */
    reranking?: RerankingConfig;

    /**
     * Configuration for retrieving entire lines around the original chunks.
     */
    parentPageRetrieval?: ParentPageRetrievalConfig;

    /**
     * Ask for reasoning during the final answer generation.
     */
    reasoningEnabled?: boolean;

    /**
     * Determines the output format:
     * - 'chunks': return retrieved chunks
     * - 'answer': return a string answer
     */
    chunksOrAnswerFormat: 'chunks' | 'answer';

    /**
     * Includes citations (references to source chunks) in the answer.
     */
    includeCitations?: boolean;

    /**
     * Enables few-shot examples for answer generation.
     */
    fewShotsEnabled?: boolean;

    /**
     * Prints detailed logs during retrieval and generation.
     */
    verbose?: boolean;
}
