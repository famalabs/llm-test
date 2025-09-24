import yargs from 'yargs';
import { VectorStore } from '../vector-store';
import { readFile } from 'fs/promises';
import { RecursiveCharacterTextSplitter, TextSplitter } from 'langchain/text_splitter';
import { Document } from 'langchain/document';
import { hideBin } from 'yargs/helpers';
import { Chunk } from '../lib/chunks';
import Redis from 'ioredis';
import { ensureIndex } from '../lib/redis-index';

async function main() {
    const argv = await yargs(hideBin(process.argv))
        .option('files', { alias: 'f', type: 'string', demandOption: true, description: 'Comma-separated list of text file paths' })
        .option('chunking', { alias: 'c', type: 'string', choices: ['fixed-size', 'agentic'], demandOption: true, description: 'Chunking strategy' })
        .help()
        .parse();
        
    const { files, chunking } = argv;
    const filesPath = files!.split(',');
    let splitter: TextSplitter;

    if (chunking == 'fixed-size') {
        const tokenLength = 300;
        const tokenOverlap = 50;
        const tokenToCharRatio = 4; // approx
        
        splitter = new RecursiveCharacterTextSplitter({
            chunkSize: tokenLength * tokenToCharRatio,
            chunkOverlap: tokenOverlap * tokenToCharRatio,
        });
    }

    else if (chunking == 'agentic') {
        // da vedere
        throw new Error('AgenticChunking not implemented yet!')
    }

    else {
        console.error('Invalid chunking strategy. Available options: fixed-size, agentic');
        process.exit(1);
    }

    const client = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
    const indexName = `vector_store_index_${chunking}`;
    const indexSchema = [
        "pageContent", "TEXT",
        "source", "TAG",
        "metadata", "TEXT",
    ];
    await ensureIndex(client, indexName, indexSchema);

    const vectorStore = new VectorStore({
        client,
        indexName,
        fieldToEmbed : 'pageContent',
    });
    await vectorStore.load();

    const docs = await Promise.all(
        filesPath.map(async (path) => {
            const content = await readFile(path, 'utf-8');
            return new Document({
                pageContent: content,
                metadata: { source: path }
            });
        })
    );

    const allSplits = await splitter.splitDocuments(docs);    
    
    await vectorStore.add(allSplits as Chunk[]);

    console.log(allSplits.length, 'document chunks embedded and stored');
}

main().catch(console.error).then(() => process.exit());