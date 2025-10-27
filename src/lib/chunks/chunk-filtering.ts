import { Chunk } from "./interfaces";

export const applyChunkFiltering = (
    chunks: Chunk[],
    thresholdMultiplier: number,
    baseThreshold: number,
    maxChunks?: number
): Chunk[] => {
    if (baseThreshold != undefined) {
        chunks = chunks.filter(c => c.distance != undefined && c.distance <= baseThreshold);
    }

    if (chunks.length == 0) return [];

    if (thresholdMultiplier != undefined) {
        const min = chunks.reduce((acc, chunk) => Math.min(acc, chunk.distance), Infinity);
        const threshold = 1 - ((1 - min) * thresholdMultiplier);
        chunks = chunks.filter(c => c.distance <= threshold);
    }

    if (maxChunks && maxChunks >= 1) {
        chunks = chunks.slice(0, Math.floor(maxChunks));
    }

    return chunks;
};