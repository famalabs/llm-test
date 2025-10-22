import { LmaConfig } from "./interfaces";

const DEFAULT_CONFIG = {
    summarizationConfig: {
        C_MIN: 200,
        C_MAX: 2000
    },
    sentimentAnalysisConfig: {
        scoreSet: [-1, -0.6, -0.3, 0, 0.3, 0.6, 1]
    },
}

export const resolveConfig = (lmaConfig: Partial<LmaConfig>): LmaConfig => {
    if (!lmaConfig.baseConfig) throw new Error("baseConfig is required in LmaConfig");

    const provider = lmaConfig.baseConfig.provider;
    const model = lmaConfig.baseConfig.model;

    return {
        baseConfig: {
            ...lmaConfig.baseConfig
        },
        sentimentAnalysisConfig: {
            provider: lmaConfig.sentimentAnalysisConfig?.provider || provider,
            model: lmaConfig.sentimentAnalysisConfig?.model || model,
            scoreSet: lmaConfig.sentimentAnalysisConfig?.scoreSet || DEFAULT_CONFIG.sentimentAnalysisConfig.scoreSet,
            ...(lmaConfig.sentimentAnalysisConfig || {})
        },
        taskAnalysisConfig: {
            provider: lmaConfig.taskAnalysisConfig?.provider || provider,
            model: lmaConfig.taskAnalysisConfig?.model || model,
            ...(lmaConfig.taskAnalysisConfig || {})
        },
        summarizationConfig: {
            provider: lmaConfig.summarizationConfig?.provider || provider,
            model: lmaConfig.summarizationConfig?.model || model,
            ...DEFAULT_CONFIG.summarizationConfig,
            ...(lmaConfig.summarizationConfig || {}),
        },
        userRequestDetectionConfig: {
            provider: lmaConfig.userRequestDetectionConfig?.provider || provider,
            model: lmaConfig.userRequestDetectionConfig?.model || model,
            ...(lmaConfig.userRequestDetectionConfig || {})
        }
    };
}