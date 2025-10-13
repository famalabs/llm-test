import { RecursiveCharacterTextSplitter, TextSplitter } from 'langchain/text_splitter';
import { AgenticChunker } from '../lib/chunks/agentic-chunker';
import { VectorStore, ensureIndex } from "../vector-store";
import { hideBin } from 'yargs/helpers';
import { readFile } from 'fs/promises';
import Redis from 'ioredis';
import yargs from 'yargs';
import { LLMConfigProvider } from '../llm';
import { getUserInput } from '../utils';

const tokenToCharRatio = 4; // approx

async function main() {
    const argv = await yargs(hideBin(process.argv))
        .option('files', { alias: 'f', type: 'string', demandOption: true, description: 'Comma-separated list of text file paths' })
        .option('chunking', { alias: 'c', type: 'string', choices: ['fixed-size', 'agentic'], demandOption: true, description: 'Chunking strategy' })
        .option('indexName', { alias: 'i', type: 'string', description: 'Name of the vector store index', demandOption: true })
        .option('chunkerModel', { type: 'string', demandOption: false, description: 'LLM to use for agentic chunking', default: 'mistral-small-latest' })
        .option('chunkerProvider', { type: 'string', choices: ['openai', 'mistral', 'google'], demandOption: false, description: 'Provider for agentic chunking', default: 'mistral' })
        .option('tokenLength', { alias: 't', type: 'number', description: 'Token length for fixed-size chunking (default: 300)', default: 300 })
        .option('tokenOverlap', { alias: 'o', type: 'number', description: 'Token overlap for fixed-size chunking (default: 50)', default: 50 })
        .option('embeddingsModel', { type: 'string', description: 'Model to use for embeddings', demandOption: true })
        .option('embeddingsProvider', { type: 'string', choices: ['openai', 'mistral', 'google'], description: 'Provider for embeddings', demandOption: true })
        .option('debug', { alias: 'd', type: 'boolean', description: 'Enable debug mode to review chunks before storing', default: false })
        .help()
        .parse();

    const { files, chunking, indexName, chunkerModel, chunkerProvider, embeddingsModel, embeddingsProvider, tokenLength, tokenOverlap } = argv;
    const filesPath = files!.split(',');
    let splitter: TextSplitter | AgenticChunker;

    if (chunking == 'fixed-size') {
        splitter = new RecursiveCharacterTextSplitter({
            chunkSize: tokenLength * tokenToCharRatio,
            chunkOverlap: tokenOverlap * tokenToCharRatio,
        });
    }

    else if (chunking == 'agentic') {
        splitter = new AgenticChunker({
            model: chunkerModel!,
            provider: chunkerProvider as LLMConfigProvider,
            minChunkLines: 5,
        });
    }

    else {
        console.error('Invalid chunking strategy. Available options: fixed-size, agentic');
        process.exit(1);
    }

    const client = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
    const indexSchema = [
        "pageContent", "TEXT",
        "source", "TAG",
        "metadata", "TEXT",
    ];
    await ensureIndex(client, indexName, indexSchema);

    const vectorStore = new VectorStore({
        client,
        indexName,
        fieldToEmbed: 'pageContent',
        embeddingsModel,
        embeddingsProvider: embeddingsProvider as LLMConfigProvider
    });
    await vectorStore.load();

    const docs = await Promise.all(
        filesPath.map(async (path) => {
            const content = await readFile(path, 'utf-8');
            return {
                pageContent: content,
                metadata: {
                    source: path
                }
            };
        })
    );

    const allSplits = await splitter.splitDocuments(docs);

    if (argv.debug) {
        console.log(`Generated ${allSplits.length} chunks from ${docs.length} documents.`);

        for (const split of allSplits) {
            console.log(split.metadata.loc)
            console.log('---');
            console.log(split.pageContent);
            console.log('======================');
            await getUserInput('Press Enter to continue...');
        }
    }


    await vectorStore.add(allSplits);


    console.log(allSplits.length, 'document chunks embedded and stored');
}

main().catch(console.error).then(() => process.exit());