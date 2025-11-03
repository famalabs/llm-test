import { LmaConfig } from "./interfaces";
import z from "zod";

const DEFAULT_CONFIG = {
    baseConfig: {
        parallel: false,
    },
    summarizationConfig: {
        C_MIN: 200,
        C_MAX: 2000
    },
    sentimentAnalysisConfig: {
        scoreSet: [-1, -0.6, -0.3, 0, 0.3, 0.6, 1]
    },
    userRequestConfig: {
        requestDetection: {
            mode: 'simple' as 'simple',
        }
    }
}

export const resolveConfig = (lmaConfig: Partial<LmaConfig>): LmaConfig => {
    // Validate initial config shape and use the parsed (narrowed) value
    const parsed = InitialLmaConfigSchema.parse(lmaConfig);

    const provider = parsed.baseConfig.provider;
    const model = parsed.baseConfig.model;

    return {
        baseConfig: {
            ...DEFAULT_CONFIG.baseConfig,
            ...parsed.baseConfig
        },
        sentimentAnalysisConfig: {
            provider: parsed.sentimentAnalysisConfig?.provider || provider,
            model: parsed.sentimentAnalysisConfig?.model || model,
            scoreSet: parsed.sentimentAnalysisConfig?.scoreSet || DEFAULT_CONFIG.sentimentAnalysisConfig.scoreSet,
            ...(parsed.sentimentAnalysisConfig || {})
        },
        taskAnalysisConfig: {
            provider: parsed.taskAnalysisConfig?.provider || provider,
            model: parsed.taskAnalysisConfig?.model || model,
            ...(parsed.taskAnalysisConfig || {})
        },
        summarizationConfig: {
            provider: parsed.summarizationConfig?.provider || provider,
            model: parsed.summarizationConfig?.model || model,
            ...DEFAULT_CONFIG.summarizationConfig,
            ...(parsed.summarizationConfig || {}),
        },

        userRequestConfig: {

            satisfactionDetection: {
                provider: parsed.userRequestConfig?.satisfactionDetection?.provider || provider,
                model: parsed.userRequestConfig?.satisfactionDetection?.model || model,
                ...(parsed.userRequestConfig?.satisfactionDetection || {})
            },

            requestDetection: {
                provider: parsed.userRequestConfig?.requestDetection?.provider || provider,
                model: parsed.userRequestConfig?.requestDetection?.model || model,
                ...DEFAULT_CONFIG.userRequestConfig.requestDetection,
                ...(parsed.userRequestConfig?.requestDetection || {}),
            },

        }
    };
}

// Zod schema for validating the initial LMA configuration
const LLMConfigSchema = z.object({
    provider: z.enum(["mistral", "google", "openai"]),
    model: z.string().min(1),
});

const ToolParamSchema = z.object({
    name: z.string().min(1),
    type: z.enum(["string", "number", "boolean"]),
    description: z.string().min(1),
});

const ToolSchema = z.object({
    name: z.string().min(1),
    description: z.string().min(1),
    parameters: z.array(ToolParamSchema).optional(),
});

const SentimentAnalysisConfigSchema = LLMConfigSchema.extend({
    scoreSet: z.array(z.number()),
});

const UserRequestConfigSchema = z.object({
    satisfactionDetection: LLMConfigSchema,
    requestDetection: LLMConfigSchema.extend({
        mode: z.enum(["simple", "tools-params", "tools"]),
        tools: z.array(ToolSchema).optional(),
    }),
});

const SummarizationConfigSchema = LLMConfigSchema.extend({
    maximumSentences: z.number().int().min(1).optional(),
    C_MIN: z.number().int(),
    C_MAX: z.number().int(),
});

const BaseConfigSchema = LLMConfigSchema.extend({
    parallel: z.boolean().optional(),
});

const InitialLmaConfigSchema = z.object({
    baseConfig: BaseConfigSchema,
    sentimentAnalysisConfig: SentimentAnalysisConfigSchema.optional(),
    taskAnalysisConfig: LLMConfigSchema.optional(),
    userRequestConfig: UserRequestConfigSchema.optional(),
    summarizationConfig: SummarizationConfigSchema.optional(),
});