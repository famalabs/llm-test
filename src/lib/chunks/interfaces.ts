import { Document } from '../core';

export interface Citation {
    chunkIndex: number;
    startLine: number;
    endLine: number;
    source?: string;
    lines?: { from?: number; to?: number; };
}

export interface Chunk extends Document<{
    loc?: {
        lines: {
            from: number;
            to: number;
        };
    };
    [key: string]: any;
}> {
    source: string;
    
    id: string;
    childId?: string | null; // if it's a sub-chunk, we store the childId in here.

    distance: number;
};

export interface PromptDocument {
    content: string;
    source: string;
}