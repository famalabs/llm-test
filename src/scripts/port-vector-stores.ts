import { VectorStore } from '../vector-store';
import { Document } from 'langchain/document';
import { readFile } from 'fs/promises';

const sources = {
    neural: [
        { chunkFile: 'other/oki_full_chunks[neural].json', source: 'data/oki_full.txt' },
        { chunkFile: 'other/aspirina_full_chunks[neural].json', source: 'data/aspirina_full.txt' },
    ],
    semantic: [
        { chunkFile: 'other/oki_full_chunks[semantic].json', source: 'data/oki_full.txt' },
        { chunkFile: 'other/aspirina_full_chunks[semantic].json', source: 'data/aspirina_full.txt' },
    ],
    agentic: [
        { chunkFile: 'other/oki_full_chunks[agentic].json', source: 'data/oki_full.txt' },
        { chunkFile: 'other/aspirina_full_chunks[agentic].json', source: 'data/aspirina_full.txt' },
    ],
};

async function main() {
    for (const [chunkType, files] of Object.entries(sources)) {
        const vectorStore = new VectorStore(`vector_store_index_${chunkType}`);
        await vectorStore.load();

        const docs: Document[] = [];
        let globalLineOffset = 0;

        for (const { source, chunkFile } of files) {
            const raw = await readFile(chunkFile, 'utf-8');
            const chunks: string[] = JSON.parse(raw);

            for (let i = 0; i < chunks.length; i++) {
                const chunkText = chunks[i];

                const lineCount = chunkText.split('\n').length;
                const fromLine = globalLineOffset;
                const toLine = globalLineOffset + lineCount - 1;

                docs.push(
                    new Document({
                        pageContent: chunkText,
                        metadata: {
                            source,
                            chunkIndex: i,
                            loc: {
                                lines: {
                                    from: fromLine,
                                    to: toLine
                                }
                            }
                        },
                    })
                );

                globalLineOffset += lineCount;
            }

            globalLineOffset = 0;
        }

        await vectorStore.add(docs);

        console.log(`Vector store for "${chunkType}" saved with ${docs.length} chunks`);
    }
}

main().catch(console.error).then(() => process.exit());