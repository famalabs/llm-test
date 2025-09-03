import { readDocument } from "./documents";
import { Citation, Chunk } from "../types";
export const resolveCitations = async (citations: Citation[], retrievedChunks: Chunk[]):Promise<string> => {
    let output = '\n[=== Citations ===]\n';

    for (const citation of citations) {
        const { chunkIndex, startLine, endLine } = citation;
        const chunk = retrievedChunks[chunkIndex];
        const parentPage = chunk.metadata.source;
        const offset = chunk.metadata.loc.lines.from;
        const startLineInParentPage = offset+startLine;
        const endLineInParentPage = offset+endLine;

        const fileLines = (await readDocument(parentPage)).split('\n')
        const citedText = fileLines.slice(startLineInParentPage - 1, endLineInParentPage).join('\n');

        output += `\n[Source: ${parentPage} | Lines: ${startLineInParentPage}-${endLineInParentPage}]\n`;
        output += citedText + '\n';
    }

    return output;
}