import Redis from "ioredis"
import { LLMConfigProvider } from "../llm";

export interface VectorStoreConfig {
    client: Redis;
    indexName: string;
    distanceMetric?: 'COSINE' | 'L2' | 'IP';
    embeddingsModel?: string;
    embeddingsProvider?: LLMConfigProvider;
    fieldToEmbed?: string;
}