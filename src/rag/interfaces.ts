import { VectorStore } from '../vector-store';
import { Chunk, Citation } from '../lib/chunks';

export type LLMConfigProvider = 'mistral' | 'google' | 'openai';

export interface LLMConfig {
    /**
     * Name of the main LLM used for generating answers.
     */
    model: string;

    /**
     * Name of the LLM provider.
     */
    provider: LLMConfigProvider;
}

export interface RagAnswer {
    /**
     * The generated answer text.
    */
    answer: string;

    /**
     * The list of source chunks used to generate the answer.
     */
    chunks: Chunk[];

    /**
     * Citations corresponding to the source chunks, if citations are enabled.
     */
    citations?: Citation[];

    /**
     * Optional reasoning provided by the LLM, if reasoning is enabled.
     */
    reasoning?: string;

    /**
     * Distance score of the answer, used for ranking.
     */
    distance?: number;
}

export interface ChunkFilteringConfig {
    /**
     * Multiplier that determines the filtering threshold relative to average similarity.
     */
    thresholdMultiplier: number;

    /**
     * Base flat threshold for distance scores to consider a chunk for reranking. Optional.
     * E.g. 0.4 means only chunks with distance <= 0.4 will be considered for reranking.
     */
    baseThreshold: number;
};

export interface RerankingConfig {
    /**
     * Configuration for the LLM used in reranking.
     */
    llmConfig: LLMConfig;

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
    chunkFiltering?: ChunkFilteringConfig;
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
     * Configuration for the LLM used in reranking.
     * Defaults to { provider: 'mistral', model: 'mistral-small-latest' }.
     */
    llmConfig: LLMConfig;

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
    chunkFiltering?: ChunkFilteringConfig;

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
