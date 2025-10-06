import { createOutputFolderIfNeeded, PATH_NORMALIZATION_MARK } from "../utils";
import { VectorStore, ensureIndex } from "../vector-store";
import { readFile, writeFile } from "fs/promises"
import { Chunk, Citation } from "../lib/chunks";
import { tqdm } from "node-console-progress-bar-tqdm";
import { hideBin } from "yargs/helpers";
import { Rag } from '../rag';
import Redis from "ioredis";
import yargs from "yargs"
import path from 'path';

const main = async () => {
    const { test: testFile, config: configFile, indexName } = await yargs(hideBin(process.argv))
        .option('test', { alias: 't', type: 'string', demandOption: true, description: 'Path to evaluation test JSON' })
        .option('config', { alias: 'c', type: 'string', demandOption: true, description: 'Path to RAG config JSON' })
        .option('indexName', { alias: 'i', type: 'string', demandOption: true, description: 'Name of the index of the document store' })
        .help()
        .parse();

    if (
        testFile?.includes('_') || configFile?.includes('_') ||
        testFile?.includes(PATH_NORMALIZATION_MARK) || configFile?.includes(PATH_NORMALIZATION_MARK)
    ) {
        throw new Error('Filenames cannot contain underscores or colons');
    }

    const normalizedTestPath = path.normalize(testFile!);
    const normalizedConfigPath = path.normalize(configFile!);
    const test: { questions: { question: string; fullRef: string, keyRef: string }[] } = await JSON.parse(await readFile(normalizedTestPath, 'utf-8'));
    const config = await JSON.parse(await readFile(normalizedConfigPath, 'utf-8'));
    const docStoreRedisClient = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
    await ensureIndex(docStoreRedisClient, indexName!, [
        "pageContent", "TEXT",
        "source", "TAG",
        "metadata", "TEXT",
    ]);
    const docStore = new VectorStore<Chunk>({
        client: docStoreRedisClient,
        fieldToEmbed: 'pageContent',
        indexName
    });

    const rag = new Rag({ ...config, docStore });

    await rag.init();

    const output: {
        results: { question: string; keyRef: string; fullRef: string; candidate: string, citations: Citation[], chunks: Chunk[] }[],
        config: object
    } = {
        results: [],
        config
    }

    for (const { question, keyRef, fullRef } of tqdm(test.questions)) {
        const { answer: candidate, citations, chunks } = await rag.search(question);
        output.results.push({ question, keyRef, fullRef, candidate, citations: citations ?? [], chunks });
    }

    const normalizedTestFile = normalizedTestPath.replaceAll(path.sep, PATH_NORMALIZATION_MARK);
    const normalizedConfigFile = normalizedConfigPath.replaceAll(path.sep, PATH_NORMALIZATION_MARK);

    const fileName = path.join(createOutputFolderIfNeeded('output', 'candidates'), `${normalizedTestFile}_${normalizedConfigFile}.json`);
    await writeFile(fileName, JSON.stringify(output, null, 2));
    console.log('Report written to', fileName);
}

main().catch(console.error).then(_ => process.exit(0));