import { Document } from '../core';

export interface Citation {
    chunkIndex: number;
    startLine: number;
    endLine: number;
    source?: string;
    lines?: { from?: number; to?: number; };
}

export interface Chunk extends Document<{
    source: string;
    loc?: {
        lines: {
            from: number;
            to: number;
        };
    };
    [key: string]: any;
}> {
    distance: number;
};

export interface PromptDocument {
    content: string;
    source: string;
}