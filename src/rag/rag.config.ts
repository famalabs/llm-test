import { RagConfig } from "./interfaces";

const DEFAULT_CONFIG: Omit<RagConfig, 'docStore' | 'semanticCache'> = {
    provider: 'mistral',
    llm: "mistral-small-latest",
    numResults: 10,
    reasoningEnabled: false,
    chunksOrAnswerFormat: 'chunks',
    includeCitations: false,
    fewShotsEnabled: false,
    verbose: false,
};

export const resolveConfig = (ragConfig: RagConfig): RagConfig => {
    return {
        ...DEFAULT_CONFIG,
        ...ragConfig,
    };
}