import { Document } from 'langchain/document';

export interface Citation {
    chunkIndex: number;
    startLine: number;
    endLine: number;
}

export declare type Chunk = Document & { 
    pageContent: string;
    metadata: { 
        source: string;
        [key: string]: any;
    };
    distance: number;
};

export interface PromptDocument {
    content: string;
    source: string;
}