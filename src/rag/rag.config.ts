import z from "zod";
import { RagConfig } from "./interfaces";

const DEFAULT_CONFIG: Omit<RagConfig, 'docStore' | 'semanticCache'> = {
    llmConfig: {
        provider: 'mistral',
        model: "mistral-small-latest",
    },
    numResults: 10,
    reasoningEnabled: false,
    includeCitations: false,
    fewShotsEnabled: false,
    verbose: false,
};

export const resolveConfig = (ragConfig: RagConfig): RagConfig => {

    InitialRagConfigSchema.parse(ragConfig);

    return {
        ...DEFAULT_CONFIG,
        ...ragConfig,
        llmConfig: {
            ...DEFAULT_CONFIG.llmConfig,
            ...ragConfig.llmConfig,
        }
    };
}

const LLMConfigSchema = z.object({
    provider: z.enum(['mistral', 'google', 'openai']),
    model: z.string().min(1),
});

const ChunkFilteringSchema = z.object({
    thresholdMultiplier: z.number().positive(),
    baseThreshold: z.number().min(0).max(1),
    maxChunks: z.number().int().min(1).optional(),
});

const ParentPageRetrievalSchema = z.object({
    offset: z.number().int().min(0).optional(),
    type: z.enum(['lines', 'full-section', 'chunks']),
});

const RerankingSchema = z.object({
    llmConfig: LLMConfigSchema,
    fewShotsEnabled: z.boolean(),
    batchSize: z.number().int().min(1),
    llmEvaluationWeight: z.number().min(0).max(1),
    reasoningEnabled: z.boolean(),
    chunkFiltering: ChunkFilteringSchema.optional(),
});

const InitialRagConfigSchema = z.object({
    llmConfig: LLMConfigSchema,
    numResults: z.number().int().min(1).optional(),
    chunkFiltering: ChunkFilteringSchema.optional(),
    reranking: RerankingSchema.optional(),
    parentPageRetrieval: ParentPageRetrievalSchema.optional(),
    reasoningEnabled: z.boolean().optional(),
    includeCitations: z.boolean().optional(),
    fewShotsEnabled: z.boolean().optional(),
    verbose: z.boolean().optional(),
});