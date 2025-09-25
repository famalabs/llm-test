import Redis from "ioredis"

export interface VectorStoreConfig {
    client: Redis;
    indexName: string;
    distanceMetric?: 'COSINE' | 'L2' | 'IP';
    embeddingsModel?: string;
    fieldToEmbed?: string;
}