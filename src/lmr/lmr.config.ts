import { LmrConfig } from "./interfaces";
import z from "zod";

export const resolveConfig = (lmrConfig: Partial<LmrConfig>): LmrConfig => {
    const parsed = InitialLmrConfigSchema.parse(lmrConfig);
    return parsed;
}

const LLMConfigSchema = z.object({
    provider: z.enum(["mistral", "google", "openai"]),
    model: z.string().min(1),
});

const BaseConfigSchema = LLMConfigSchema.extend({
    parallel: z.boolean().optional(),
});

const InitialLmrConfigSchema = z.object({
    baseConfig: BaseConfigSchema,
});