import { Embedder } from "./interfaces";
const cachedImports: { [key: string]: (id: string) => Embedder } = {};

export const EMBEDDING_DIMENSION = 1024; // mistral-embed output dimension

export function createEmbedder(model: string, provider: "mistral" | "google" | "openai" | "voyage" | "local" | "huggingface"): Embedder {

    if (cachedImports[provider]) {
        return cachedImports[provider](model);
    }

    switch (provider) {
        case "mistral":
            const { MistralAIEmbeddings } = require("@langchain/mistralai");
            cachedImports[provider] = (model: string) => new MistralAIEmbeddings({ model });
            break;
        case "openai":
            const { OpenAIEmbeddings } = require("@langchain/openai");
            cachedImports[provider] = (model: string) => new OpenAIEmbeddings({ model });
            break;
        case "voyage":
            const { VoyageAIEmbeddings } = require("./custom-embedders/voyage");
            cachedImports[provider] = (model: string) => new VoyageAIEmbeddings({ model });
            break;
        case "local":
            const { LocalEmbeddings } = require("./custom-embedders/local");
            cachedImports[provider] = (model: string) => new LocalEmbeddings({ model });
            break;
        case "huggingface":
            const { HuggingFaceInferenceEmbeddings } = require("@langchain/community/embeddings/hf");
            cachedImports[provider] = (model: string) => new HuggingFaceInferenceEmbeddings({ model });
            break;
        case "google":
            const { GoogleGenerativeAIEmbeddings } = require('./custom-embedders/google');
            cachedImports[provider] = (model: string) => new GoogleGenerativeAIEmbeddings({ model });
            break;
        default:
            throw new Error(`Unsupported embedding provider: ${provider}`);
    }

    return cachedImports[provider](model);
}