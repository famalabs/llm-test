import { AgenticChunker, Chunk, ProgressiveAgenticChunker, SectionAgenticChunker } from '../lib/chunks';
import { RecursiveCharacterTextSplitter } from '../lib/core';
import { createOutputFolderIfNeeded } from '../utils';
import { VectorStore, ensureIndex } from "../vector-store";
import { readFile, writeFile } from 'fs/promises';
import { LLMConfigProvider } from '../llm';
import { hideBin } from 'yargs/helpers';
import Redis from 'ioredis';
import yargs from 'yargs';
import path from 'path';
import { FixedSizeChunker } from '../lib/chunks/fixed-size';

const tokenToCharRatio = 1; // approx

async function main() {
    const argv = await yargs(hideBin(process.argv))
        .option('files', { alias: 'f', type: 'string', demandOption: true, description: 'Comma-separated list of text file paths' })
        .option('chunking', { alias: 'c', type: 'string', choices: ['fixed-size', 'ported-fixed-size', 'agentic', 'progressive-agentic', 'section-agentic'], demandOption: true, description: 'Chunking strategy' })
        .option('indexName', { alias: 'i', type: 'string', description: 'Name of the vector store index', demandOption: true })
        .option('chunkerModel', { alias: 'cm', type: 'string', demandOption: false, description: 'LLM to use for agentic chunking', default: 'mistral-small-latest' })
        .option('chunkerProvider', { alias: 'cp', type: 'string', choices: ['openai', 'mistral', 'google'], demandOption: false, description: 'Provider for agentic chunking', default: 'mistral' })
        .option('tokenLength', { alias: 't', type: 'number', description: 'Token length for fixed-size chunking' })
        .option('tokenOverlap', { alias: 'o', type: 'number', description: 'Token overlap for fixed-size'})
        .option('embeddingsModel', { alias: 'em', type: 'string', description: 'Model to use for embeddings (default: text-embedding-3-large)', demandOption: false, default: 'text-embedding-3-large' })
        .option('embeddingsProvider', { alias: 'ep', type: 'string', choices: ['openai', 'mistral', 'google'], description: 'Provider for embeddings (default: openai)', demandOption: false, default: 'openai' })
        .option('minChunkLines', { type: 'number', description: 'Minimum number of lines per chunk for agentic chunking (default: 0)', default: 0 })
        .option('batchSize', { alias: 'b', type: 'number', description: 'Batch size for progressive agentic chunking (default: 5)', default: 5 })
        .option('prefix', { alias: 'p', type: 'string', description: 'Optional prefix to add to the "source" field of each chunk' })
        .option('purge', { type: 'boolean', description: 'Purge existing index and create a new one', default: false })
        .option('debug', { alias: 'd', type: 'boolean', description: 'Enable debug mode to review chunks before storing', default: false })
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
    let splitter: FixedSizeChunker | AgenticChunker | ProgressiveAgenticChunker | SectionAgenticChunker | RecursiveCharacterTextSplitter;

    console.log('chunking', chunking);
    
    if (chunking == 'fixed-size') {
        if (!tokenLength || !tokenOverlap) { throw new Error('tokenLength and tokenOverlap are required for fixed-size chunking'); } 
        splitter = new FixedSizeChunker({
            chunkSize: tokenLength * tokenToCharRatio,
            chunkOverlap: tokenOverlap * tokenToCharRatio,
        });
    }

    else if (chunking == 'ported-fixed-size') {
        if (!tokenLength || !tokenOverlap) { throw new Error('tokenLength and tokenOverlap are required for ported-fixed-size chunking'); }
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
        if (!tokenLength || !tokenOverlap) { throw new Error('tokenLength and tokenOverlap are required for section-agentic chunking'); }
        splitter = new SectionAgenticChunker({
            model: chunkerModel!,
            provider: chunkerProvider as LLMConfigProvider,
            secondPass: {
                chunkSize : tokenLength * tokenToCharRatio, 
                chunkOverlap : tokenOverlap * tokenToCharRatio,
            }
        });
    }

    else {
        console.error('Invalid chunking strategy. Available options: fixed-size, ported-fixed-size, agentic, progressive-agentic, section-agentic');
        process.exit(1);
    }

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

    const allSplits = await splitter.splitDocuments(docs) as Chunk[];

    console.log(`Chunking completed in ${(performance.now() - startTime).toFixed(2)} ms`);
    const log_message = `\n\n [${new Date().toISOString()}] Indexed files: ${argv.files}` +
            `\n Params: ${JSON.stringify(argv)}` +
            `\n Time taken: ${(performance.now() - startTime).toFixed(2)} ms` +
            `\n Total sections: ${allSplits.reduce((a, b) => a + (b.childId == null ? 1 : 0), 0)}` +
            `\n Average sections per document: ${(allSplits.reduce((a, b) => a + (b.childId == null ? 1 : 0), 0) / docs.length).toFixed(2)}` +
            `\n Total chunks: ${allSplits.length}` +
            `\n Average chunks per document: ${(allSplits.length / docs.length).toFixed(2)}` +
            `\n Average chunk length: ${(allSplits.reduce((a, b) => a + b.pageContent.length, 0) / allSplits.length).toFixed(2)} characters` +
            `\n Min chunk length: ${Math.min(...allSplits.map(c => c.pageContent.length))} characters` +
            `\n Max chunk length: ${Math.max(...allSplits.map(c => c.pageContent.length))} characters`;

    if (argv.debug == true) {
        console.log(`Generated ${allSplits.length} chunks from ${docs.length} documents.`);

        let lengths = [];
        for (let i = 0; i < allSplits.length; i++) {
            const split = allSplits[i];
            lengths.push(split.pageContent.length);
            console.log(`Chunk ${i + 1}/${allSplits.length} | Lines: ${split.metadata.loc?.lines.from}-${split.metadata.loc?.lines.to} | len: ${split.pageContent.length}`);
            console.log('----------------------');
            console.log(split.pageContent);
            console.log('======================');
            // if (process.stdin.isTTY) {
            //     await getUserInput('Press Enter to continue...');
            // }
        }

        const folder = path.join('output', 'chunking');
        createOutputFolderIfNeeded(folder);
        const outputPath = path.join(folder, `debug-chunks-${chunking}.json`);
        await writeFile(outputPath, JSON.stringify(allSplits, null, 2));
        console.log(`All chunks written to ${outputPath}`);
        console.log(log_message);
        return;
    }
    
    const client = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
    const indexSchema = [
        "pageContent", "TEXT",
        "source", "TAG",
        "id", "TAG",
        "childId", "TAG"
    ];
    const log_folder = path.join('output', 'chunking', 'indexes');
    createOutputFolderIfNeeded(log_folder);
    const log_file = `${log_folder}/log_${indexName}.txt`;
    if (argv.purge) {
        try {
            await client.call('FT.DROPINDEX', indexName, 'DD');
            await writeFile(log_file, '');
            console.log(`Dropped existing index ${indexName}`);
        } catch (err: any) {
            const msg = String(err?.message || err);
            // Ignore "index does not exist" errors; rethrow others
            if (!/unknown index|no such index|index does not exist/i.test(msg)) {
                throw err;
            }
        }
    }
    await ensureIndex(client, indexName, indexSchema);

    const vectorStore = new VectorStore({
        client,
        indexName,
        fieldToEmbed: 'pageContent',
        embeddingsModel,
        embeddingsProvider: embeddingsProvider as LLMConfigProvider
    });
    await vectorStore.load();

    await vectorStore.add(
        (
            chunking == 'section-agentic'
                ? (allSplits as Chunk[]).map((el) => {
                    const cp = { ...el };
                    delete cp.metadata.description;

                    if (cp.childId != undefined) { // it's a sub-chunk
                        delete cp.metadata.title;
                    }

                    /*
                    Section / Parent:
                    {  pageContent, metadata: { loc, title  }, id, source }

                    Sub-section / Child:
                    { pageContent, metadata: { loc }, childId, id, source }
                    */

                    return cp;
                })
                : allSplits
        ),

        {

            prefix: (chunk) => {

                // passed prefix has priority
                if (prefix) return prefix;

                // if not passed, we use the file name as prefix if not section-chunking, else a specific logic
                if (chunking == 'section-agentic') {
                    if (chunk.childId != undefined) { // it's a sub-chunk
                        const parentId = chunk.id;

                        const parent = allSplits.find(c => c.id == parentId && c.source === chunk.source);
                        if (!parent) throw new Error("Parent chunk not found for sub-chunk.");

                        return (chunk.source + ' > ' + parent.metadata.title);
                    }

                    else { // it's a parent chunk
                        return chunk.source;
                    }

                }

                else {
                    return chunk.source;
                }
            }
        }
    );

    console.log(allSplits.length, 'document chunks embedded and stored');
    await writeFile(log_file, log_message, { flag: 'a' });
    console.log('Log written to', log_file);
    console.log(log_message);
}

main().catch(console.error).then(() => process.exit());