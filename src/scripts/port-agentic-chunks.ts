import { VectorStore, ensureIndex } from '../vector-store';
import { readFile } from 'fs/promises';
import { Chunk } from '../lib/chunks';
import Redis from 'ioredis';

const sources = {
    agentic: [
        { chunkFile: 'other/oki_full_chunks[agentic].json', source: 'data/oki_full.txt' },
        { chunkFile: 'other/aspirina_full_chunks[agentic].json', source: 'data/aspirina_full.txt' },
    ],
};

async function main() {

    const client = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
    for (const [chunkType, files] of Object.entries(sources)) {
        const indexName = `vector_store_index_${chunkType}`;
        await ensureIndex(client, indexName, [
            "pageContent", "TEXT",
            "source", "TAG",
            "metadata", "TEXT",
        ]);
        const vectorStore = new VectorStore({
            client,
            indexName,
            fieldToEmbed: 'pageContent',
        });
        await vectorStore.load();

        const docs: Chunk[] = [];
        let globalLineOffset = 0;

        for (const { source, chunkFile } of files) {
            const raw = await readFile(chunkFile, 'utf-8');
            const chunks: string[] = JSON.parse(raw);

            for (let i = 0; i < chunks.length; i++) {
                const chunkText = chunks[i];

                const lineCount = chunkText.split('\n').length;
                const fromLine = globalLineOffset;
                const toLine = globalLineOffset + lineCount - 1;

                docs.push({
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
                    distance: 0
                });

                globalLineOffset += lineCount;
            }

            globalLineOffset = 0;
        }

        await vectorStore.add(docs);

        console.log(`Vector store for "${chunkType}" saved with ${docs.length} chunks`);
    }
}

main().catch(console.error).then(() => process.exit());