export interface Citation {
    chunkIndex: number;
    startLine: number;
    endLine: number;
    source?: string;
    lines?: { from?: number; to?: number; };
}

export declare type Chunk = { 
    pageContent: string;
    metadata: { 
        source: string;
        loc?: { 
            lines: { 
                from: number;
                to: number;
            };
        };
        [key: string]: any;
    };
    distance: number;
};

export interface PromptDocument {
    content: string;
    source: string;
}