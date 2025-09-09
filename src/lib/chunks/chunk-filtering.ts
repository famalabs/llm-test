import { Chunk } from "./interfaces";

export const applyChunkFiltering = (chunks: Chunk[], thresholdMultiplier: number): Chunk[] => {
    const min = chunks.reduce((acc, chunk) => Math.min(acc, chunk.distance), Infinity);
    const threshold = 1 - ((1 - min) * thresholdMultiplier);
    chunks = chunks.filter(c => c.distance <= threshold);
    
    return chunks;
};