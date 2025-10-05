import { Embedder } from "./interfaces";
const cachedImports: { [key: string]: (args: { model: string, dimensions?: number }) => Embedder } = {};

export const EMBEDDING_DIMENSION = 1024; // mistral-embed output dimension

export function createEmbedder(model: string, provider: "mistral" | "google" | "openai" | "voyage" | "local" | "huggingface", embeddingDim?: number): Embedder {

    const args = { model };

    if (embeddingDim) {
        (args as any).dimensions = embeddingDim;
    }

    if (cachedImports[provider]) {
        return cachedImports[provider](args);
    }

    switch (provider) {
        case "voyage":
            const { VoyageAIEmbeddings } = require("./custom-embedders/voyage");
            cachedImports[provider] = (args: { model: string, dimensions?: number }) => new VoyageAIEmbeddings(args);
            break;
        case "local":
            const { LocalEmbeddings } = require("./custom-embedders/local");
            if (embeddingDim) console.warn("Local embeddings do not support dimension reduction. The provided dimension will be used to truncate the embeddings.");
            cachedImports[provider] = (args: { model: string, dimensions?: number }) => new LocalEmbeddings(args);
            break;
        case "huggingface":
            const { HuggingFaceInferenceEmbeddings } = require("@langchain/community/embeddings/hf");
            if (embeddingDim) console.warn("There's not a direct way to set output dimensions for HuggingFace embeddings. The provided dimension will be ignored.");
            cachedImports[provider] = (args: { model: string, dimensions?: number }) => new HuggingFaceInferenceEmbeddings({ model: args.model });
            break;
        case "mistral":
            const { AiSdkEmbeddings : MistralAIEmbeddings } = require("./custom-embedders/ai-sdk");
            cachedImports[provider] = (args: { model: string, dimensions?: number }) => new MistralAIEmbeddings({ model: args.model, providerName: "mistral" });
            break;
        case "openai":
            const { AiSdkEmbeddings : OpenAIEmbeddings } = require("./custom-embedders/ai-sdk");
            cachedImports[provider] = (args: { model: string, dimensions?: number }) => new OpenAIEmbeddings({...args, providerName: "openai" });
            break;
        case "google":
            const { AiSdkEmbeddings : GoogleGenerativeAIEmbeddings } = require("./custom-embedders/ai-sdk");
            cachedImports[provider] = (args: { model: string, dimensions?: number }) => new GoogleGenerativeAIEmbeddings({...args, providerName: "google" });
            break;
        default:
            throw new Error(`Unsupported embedding provider: ${provider}`);
    }

    return cachedImports[provider](args);
}