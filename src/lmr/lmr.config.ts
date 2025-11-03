import { LmrConfig } from "./interfaces";
import z from "zod";

const DEFAULT_CONFIG = {
    baseConfig: {
        parallel: false,
    },
}

export const resolveConfig = (lmrConfig: Partial<LmrConfig>): LmrConfig => {
    // Validate initial config shape
    const parsed = InitialLmrConfigSchema.parse(lmrConfig);

    return {
        baseConfig: {
            ...DEFAULT_CONFIG.baseConfig,
            ...parsed.baseConfig
        },
    };
}

// Zod schema for validating the initial LMR configuration
const LLMConfigSchema = z.object({
    provider: z.enum(["mistral", "google", "openai"]),
    model: z.string().min(1),
});

const BaseConfigSchema = LLMConfigSchema.extend({
    // Allow optional parallel to tolerate DEFAULT_CONFIG that includes it
    parallel: z.boolean().optional(),
});

const InitialLmrConfigSchema = z.object({
    baseConfig: BaseConfigSchema,
}).passthrough();