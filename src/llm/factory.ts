import { LanguageModel } from "ai";
import { LLMConfigProvider } from "./interfaces";

const cachedImports: { [key: string]: (id: string) => LanguageModel } = {};

export const getLLMProvider = async (provider: LLMConfigProvider) => {
    if (cachedImports[provider]) {
        return cachedImports[provider];
    }
    switch (provider) {
        case "mistral": {
            const { mistral } = await import("@ai-sdk/mistral");
            cachedImports[provider] = mistral;
            return mistral;
        }
        case "google": {
            const { google } = await import("@ai-sdk/google");
            cachedImports[provider] = google;
            return google;
        }
        case "openai": {
            const { openai } = await import("@ai-sdk/openai");
            cachedImports[provider] = openai;
            return openai;
        }
        default:
            throw new Error(`Unsupported LLM provider: ${provider}`);
    }
};
