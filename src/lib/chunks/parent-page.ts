import { getDocumentLines } from "../documents";
import { Chunk } from "./interfaces";

const mergeLineIntervals = (chunks: Chunk[]): Chunk[] => {
    const sorted = [...chunks].sort((a, b) => a.metadata.loc.lines.from - b.metadata.loc.lines.from);
    const merged: Chunk[] = [];

    for (const curr of sorted) {
        if (merged.length === 0) {
            merged.push(curr);
            continue;
        }

        const prev = merged[merged.length - 1];
        if (curr.metadata.loc.lines.from <= prev.metadata.loc.lines.to) {
            prev.metadata.loc.lines.to = Math.max(prev.metadata.loc.lines.to, curr.metadata.loc.lines.to);
        } else {
            merged.push(curr);
        }
    }

    return merged;
}

const extendChunkLines = (chunk: Chunk, offset: number, totalLines: number): Chunk => {
    const from = Math.max(1, chunk.metadata.loc.lines.from - offset);
    const to = Math.min(totalLines, chunk.metadata.loc.lines.to + offset);
    return {
        ...chunk,
        metadata: {
            ...chunk.metadata,
            loc: {
                ...chunk.metadata.loc,
                lines: { from, to }
            }
        }
    };
}

export const retrieveParentPage = async (chunks: Chunk[], offset: number): Promise<Chunk[]> => {


    const chunksBySource: Record<string, Chunk[]> = {};
    for (const c of chunks) {
        if (!chunksBySource[c.metadata.source]) {
            chunksBySource[c.metadata.source] = [];
        }
        chunksBySource[c.metadata.source].push(c);
    }

    const result: Chunk[] = [];

    for (const [source, sourceChunks] of Object.entries(chunksBySource)) {
        const lines = await getDocumentLines(source);
        const totalLines = lines.length;

        const extended = sourceChunks.map(c => extendChunkLines(c, offset, totalLines));
        const merged = mergeLineIntervals(extended);

        // Restore order (distance based...smallest distance first)
        merged.sort((a, b) => a.distance - b.distance);

        for (const { metadata, distance } of merged) {
            const { from, to } = metadata.loc.lines;
            const content = lines.slice(from - 1, to).join("\n");

            result.push({
                pageContent: content,
                metadata,
                distance
            });
        }
    }

    return result;
}