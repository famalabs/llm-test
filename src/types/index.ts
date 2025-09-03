import { Document } from "langchain/document";
import { ChunkingStrategy, RagMode } from "../constants/rag";

export interface Citation {
    chunkIndex: number;
    startLine: number;
    endLine: number;
}

export declare type Chunk = Document & { distance: number };

export interface PromptDocument {
    content: string;
    source: string;
}

export interface RAGSystemConfig {
    llm: string;
    ragMode: RagMode;
    chunkingStrategy?: ChunkingStrategy | null;
    corpusInContextFiles?: string[] | null;
    parentPageRetrieval?: boolean;
    parentPageRetrievalOffset?: number | null;
    reranking?: boolean;
    reasoning?: boolean;
    fewShots?: boolean;
}