import { Embedder, EmbeddingProvider } from "./interfaces";
const cachedImports: { [key: string]: (args: { model: string, dimensions?: number }) => Embedder } = {};

export const EMBEDDING_DIMENSION = 768;

export function createEmbedder(model: string, provider: EmbeddingProvider, embeddingDim?: number): Embedder {

    const args = { model };

    if (embeddingDim) {
        (args as any).dimensions = embeddingDim;
    }

    if (cachedImports[provider]) {
        return cachedImports[provider](args);
    }

    switch (provider) {
        case "local":
            const { LocalEmbeddings } = require("./custom-embedders/local");
            if (embeddingDim) console.warn("Local embeddings do not support dimension reduction. The provided dimension will be used to truncate the embeddings.");
            cachedImports[provider] = (args: { model: string, dimensions?: number }) => new LocalEmbeddings(args);
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