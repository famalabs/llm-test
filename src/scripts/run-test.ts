/**
 * Example use with glob:
 * npx tsx src/scripts/run-test.ts -c "data/example.rag-config*" -t data/tests/rag-suite-01.json -i vector_store_index_fixed_size
 */

import { createOutputFolderIfNeeded, PATH_NORMALIZATION_MARK } from "../utils";
import { VectorStore, ensureIndex } from "../vector-store";
import { readFile, writeFile } from "fs/promises"
import { Chunk, Citation } from "../lib/chunks";
import { tqdm } from "node-console-progress-bar-tqdm";
import { hideBin } from "yargs/helpers";
import { Rag } from '../rag';
import { glob } from "glob";
import Redis from "ioredis";
import yargs from "yargs"
import path from 'path';

async function runSingleTest(testFile: string, configFile: string) {

    if (
        testFile?.includes('_') || configFile?.includes('_') ||
        testFile?.includes(PATH_NORMALIZATION_MARK) || configFile?.includes(PATH_NORMALIZATION_MARK)
    ) {
        throw new Error('Filenames cannot contain underscores or colons');
    }

    const normalizedTestPath = path.normalize(testFile!);
    const normalizedConfigPath = path.normalize(configFile!);
    const test: { questions: { question: string; fullRef: string, keyRef: string }[] } = await JSON.parse(await readFile(normalizedTestPath, 'utf-8'));
    const joinedConfig = await JSON.parse(await readFile(normalizedConfigPath, 'utf-8'));
    const { rag: ragConfig, docStore: docStoreConfig } = joinedConfig;
    if (!ragConfig || !docStoreConfig) {
        throw new Error('Config file must contain both "rag" and "docStore" sections');
    }

    const indexName = docStoreConfig.indexName;
    if (!indexName) {
        throw new Error('docStore config must contain an indexName');
    }

    const docStoreRedisClient = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
    await ensureIndex(docStoreRedisClient, docStoreConfig.indexName, [
        "pageContent", "TEXT",
        "source", "TAG"
    ]);
    const docStore = new VectorStore<Chunk>({
        client: docStoreRedisClient,
        fieldToEmbed: 'pageContent',
        indexName
    });

    const rag = new Rag({ ...ragConfig, docStore });

    await rag.init();

    const output: {
        results: { question: string; keyRef: string; fullRef: string; candidate: string, citations: Citation[], chunks: Chunk[] }[],
        ragConfig: object,
        docStoreConfig: object
    } = {
        results: [],
        ragConfig,
        docStoreConfig
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


const main = async () => {
    const { test: testFile, config: configFile } = await yargs(hideBin(process.argv))
        .option('test', { alias: 't', type: 'string', demandOption: true, description: 'Path to evaluation test JSON' })
        .option('config', { alias: 'c', type: 'string', demandOption: true, description: 'Path to RAG/docStore config JSON' })
        .help()
        .parse();

    const multipleFiles = await glob(configFile!);
    if (multipleFiles.length > 1) {
        console.log(`Found ${multipleFiles.length} config files matching the pattern. Running tests for each file...`);
        for (const file of multipleFiles) {
            console.log(`Running test for: ${file}`);
            await runSingleTest(testFile!, file);
        }
        return;
    }

    await runSingleTest(testFile!, configFile!);
}

main().catch(console.error).then(_ => process.exit(0));