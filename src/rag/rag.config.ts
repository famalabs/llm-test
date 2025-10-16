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
    return {
        ...DEFAULT_CONFIG,
        ...ragConfig,
        llmConfig: {
            ...DEFAULT_CONFIG.llmConfig,
            ...ragConfig.llmConfig,
        }
    };
}