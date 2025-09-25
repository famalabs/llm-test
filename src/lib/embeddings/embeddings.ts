import { Embedder } from "./interfaces";
const cachedImports: { [key: string]: (id: string) => Embedder } = {};

export const EMBEDDING_DIMENSION = 1024; // mistral-embed output dimension

export function createEmbedder(model: string, provider: "mistral" | "openai" | "voyage"): Embedder {

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
            const { VoyageAIEmbeddings } = require("./voyage-embedder");
            cachedImports[provider] = (model: string) => new VoyageAIEmbeddings({ model });
            break;
        default:
            throw new Error(`Unsupported embedding provider: ${provider}`);
    }

    return cachedImports[provider](model);
}