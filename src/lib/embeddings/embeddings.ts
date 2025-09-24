import { MistralAIEmbeddings } from "@langchain/mistralai";
import { Embedder } from "./interfaces";

export const EMBEDDING_DIMENSION = 1024; // mistral-embed output dimension

export function createEmbedder(model?: string): Embedder {
    const name = model ?? "mistral-embed";
    return new MistralAIEmbeddings({ model: name });
}
