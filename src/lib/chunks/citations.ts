/*
Possiamo evitare di leggere il file, considerando che possiamo tranquillamente 
retrievare righe, e citedText direttamente dal chunk.
*/


import { readDocument } from "../../utils/files";
import { Citation, Chunk } from "./interfaces";
export const resolveCitations = async (citations: Citation[], retrievedChunks: Chunk[]): Promise<string> => {
    let output = '\n[=== Citations ===]\n';

    for (const citation of citations) {
        const { chunkIndex, startLine, endLine } = citation;
        const chunk = retrievedChunks[chunkIndex];
        const parentPage = chunk.metadata.source;

        const offset = chunk.metadata.loc!.lines.from;
        const startLineInParentPage = offset + startLine;
        const endLineInParentPage = offset + endLine;
        const citedText = (await readDocument(parentPage)).split('\n').slice(
            startLineInParentPage - 1,
            endLineInParentPage + 1
        ).join('\n');

        output += `\n[Source: ${parentPage} | Lines: ${startLineInParentPage}-${endLineInParentPage}]\n`;
        output += citedText.trim();
    }

    return output;
}