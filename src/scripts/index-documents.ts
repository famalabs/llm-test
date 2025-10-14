import { AgenticChunker, ProgressiveAgenticChunker, SectionAgenticChunker } from '../lib/chunks';
import { RecursiveCharacterTextSplitter, TextSplitter } from 'langchain/text_splitter';
import { createOutputFolderIfNeeded, getUserInput } from '../utils';
import { VectorStore, ensureIndex } from "../vector-store";
import { readFile, writeFile } from 'fs/promises';
import { hideBin } from 'yargs/helpers';
import { LLMConfigProvider } from '../llm';
import Redis from 'ioredis';
import yargs from 'yargs';
import path from 'path';

const tokenToCharRatio = 4; // approx

async function main() {
    const argv = await yargs(hideBin(process.argv))
        .option('files', { alias: 'f', type: 'string', demandOption: true, description: 'Comma-separated list of text file paths' })
        .option('chunking', { alias: 'c', type: 'string', choices: ['fixed-size', 'agentic', 'progressive-agentic', 'section-agentic'], demandOption: true, description: 'Chunking strategy' })
        .option('indexName', { alias: 'i', type: 'string', description: 'Name of the vector store index', demandOption: true })
        .option('chunkerModel', { alias: 'cm', type: 'string', demandOption: false, description: 'LLM to use for agentic chunking', default: 'mistral-small-latest' })
        .option('chunkerProvider', { alias: 'cp', type: 'string', choices: ['openai', 'mistral', 'google'], demandOption: false, description: 'Provider for agentic chunking', default: 'mistral' })
        .option('tokenLength', { alias: 't', type: 'number', description: 'Token length for fixed-size chunking (default: 300)', default: 300 })
        .option('tokenOverlap', { alias: 'o', type: 'number', description: 'Token overlap for fixed-size chunking (default: 50)', default: 50 })
        .option('embeddingsModel', { alias: 'em', type: 'string', description: 'Model to use for embeddings (default: text-embedding-3-large)', demandOption: false, default: 'text-embedding-3-large' })
        .option('embeddingsProvider', { alias: 'ep', type: 'string', choices: ['openai', 'mistral', 'google'], description: 'Provider for embeddings (default: openai)', demandOption: false, default: 'openai' })
        .option('debug', { alias: 'd', type: 'boolean', description: 'Enable debug mode to review chunks before storing', default: false })
        .option('minChunkLines', { type: 'number', description: 'Minimum number of lines per chunk for agentic chunking (default: 0)', default: 0 })
        .option('batchSize', { alias: 'b', type: 'number', description: 'Batch size for progressive agentic chunking (default: 5)', default: 5 })
        .option('prefix', { alias: 'p', type: 'string', description: 'Optional prefix to add to the "source" field of each chunk' })
        .help()
        .parse();

    const { 
        files, chunking, indexName, 
        chunkerModel, chunkerProvider, 
        embeddingsModel, embeddingsProvider, 
        tokenLength, tokenOverlap, 
        minChunkLines, 
        batchSize,
        prefix 
    } = argv;
    const filesPath = files!.split(',');
    let splitter: TextSplitter | AgenticChunker | ProgressiveAgenticChunker | SectionAgenticChunker;

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
            minChunkLines: minChunkLines!,
        });
    }

    else if (chunking == 'progressive-agentic') {
        splitter = new ProgressiveAgenticChunker({
            model: chunkerModel!,
            provider: chunkerProvider as LLMConfigProvider,
            batchSize: batchSize!,
        });
    }

    else if (chunking == 'section-agentic') {
        splitter = new SectionAgenticChunker({
            model: chunkerModel!,
            provider: chunkerProvider as LLMConfigProvider,
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

    const startTime = performance.now();
    const allSplits = await splitter.splitDocuments(docs);
    console.log(`Chunking completed in ${(performance.now() - startTime).toFixed(2)} ms`);

    if (argv.debug) {
        console.log(`Generated ${allSplits.length} chunks from ${docs.length} documents.`);

        for (const split of allSplits) {
            console.log(split.metadata.loc)
            console.log('---');
            console.log(split.pageContent);
            console.log('======================');
            await getUserInput('Press Enter to continue...');
        }

        const folder = path.join('output', 'chunking');
        createOutputFolderIfNeeded(folder);
        const outputPath = path.join(folder, `debug-chunks-${chunking}.json`);
        await writeFile(outputPath, JSON.stringify(allSplits, null, 2));
        console.log(`All chunks written to ${outputPath}`);
    }

    // await vectorStore.add(allSplits, prefix ? { prefix: () => prefix } : {});
    
    console.log(allSplits.length, 'document chunks embedded and stored');
}

main().catch(console.error).then(() => process.exit());