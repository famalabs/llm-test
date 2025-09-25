import { VectorStore } from '../vector-store';
import { Chunk, Citation } from '../lib/chunks';

export interface RagAnswer {
    answer: string;
    chunks: Chunk[];
    citations?: Citation[];
    reasoning?: string;
    distance?: number;
}

export interface RerankingConfig {
    /** 
     * Name of the LLM used for reranking.
     */
    llm: string;

    /**
     * Provider of the LLM used for reranking.
     */
    provider: 'mistral' | 'google' | 'openai';

    /** 
     * Enables few-shot examples to improve reranking quality.
     */
    fewShotsEnabled: boolean;

    /** 
     * Maximum number of chunks processed in a single reranking batch.
     */
    batchSize: number;

    /** 
     * Weight assigned to the LLM evaluation score when combining with vector similarity.
     */
    llmEvaluationWeight: number;

    /** 
     * Ask for a reasoning sentence during reranking.
     */
    reasoningEnabled: boolean;

    /** 
     * Configuration for filtering chunks before reranking. Optional.
     */
    chunkFiltering?: {
        /**
         * Multiplier that determines the filtering threshold relative to average similarity.
         */
        thresholdMultiplier: number;
    };
}

export interface ParentPageRetrievalConfig {
    /**
     * Number of lines to include around the ones containing the original chunk.
     */
    offset: number;
}

export interface SemanticCacheConfig {
    /**
     * Instance of the semantic cache vector store.
     */
    cacheStore: VectorStore<RagAnswer>;

    /**
     * Distance threshold for retrieving from the semantic cache.
     * If a cached answer has distance below this threshold, it will be used directly.
     */
    distanceThreshold: number;

    /** 
     * Time-to-live for cached answers. Optional.
     */
    ttl?: number;
}

export interface RagConfig {
    /**
     * Name of the LLM provider. Defaults to 'mistral'.
     */
    provider: 'mistral' | 'google' | 'openai';

    /**
     * Name of the main LLM used for generating answers. Defaults to 'mistral-small-latest'.
     */
    llm: string;

    /**
     * Instance of the document store (vector database) used for retrieval.
     */
    docStore: VectorStore<Chunk>;

    /**
     * Number of chunks retrieved from the vector store. Defaults to 10.
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
     * Ask for reasoning during the final answer generation. Defaults to false.
     */
    reasoningEnabled?: boolean;

    /**
     * Includes citations (references to source chunks) in the answer. Defaults to false.
     */
    includeCitations?: boolean;

    /**
     * Enables few-shot examples for answer generation. Defaults to false.
     */
    fewShotsEnabled?: boolean;

    /**
     * Prints detailed logs during retrieval and generation. Defaults to false.
     */
    verbose?: boolean;

    /**
     * Optional configuration for a semantic cache to speed up responses.
     */
    semanticCache?: SemanticCacheConfig;
}
