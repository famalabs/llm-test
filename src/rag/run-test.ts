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
import { Rag } from '.';
import { glob } from "glob";
import Redis from "ioredis";
import yargs from "yargs"
import path from 'path';
import { detectLanguage } from "../lib/nlp";
import type { LanguageLabel } from "../lib/nlp/interfaces";

const ALLOWED_LANGUAGES: LanguageLabel[] = [
    'arabic', 'bulgarian', 'german', 'modern greek', 'english', 'spanish', 'french', 'hindi', 'italian', 'japanese', 'dutch', 'polish', 'portuguese', 'russian', 'swahili', 'thai', 'turkish', 'urdu', 'vietnamese', 'chinese'
];

async function runSingleTest(testFile: string, configFile: string, parallel: boolean) {

    if (
        testFile?.includes('_') || configFile?.includes('_') ||
        testFile?.includes(PATH_NORMALIZATION_MARK) || configFile?.includes(PATH_NORMALIZATION_MARK)
    ) {
        throw new Error('Filenames cannot contain underscores or colons');
    }

    const normalizedTestPath = path.normalize(testFile!);
    const normalizedConfigPath = path.normalize(configFile!);
    const tests: { input: string; expected_output: { key_ref: string, full_ref: string } }[] = JSON.parse(await readFile(normalizedTestPath, 'utf-8'));
    const joinedConfig = JSON.parse(await readFile(normalizedConfigPath, 'utf-8'));
    const { rag: ragConfig, docStore: docStoreConfig, language } = joinedConfig;

    if (!ragConfig || !docStoreConfig) {
        throw new Error('Config file must contain both "rag" and "docStore" sections');
    }

    if (language != undefined && language != 'detect' && !ALLOWED_LANGUAGES.includes(language as LanguageLabel)) {
        throw new Error(`Config "language" must be one of: ${ALLOWED_LANGUAGES.join(', ')}, or "detect"`);
    }
    console.log('Using language:', language ?? 'not specified (will use RAG in-prompt language detection system)');

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
        results: { input: string; expected_output: { key_ref: string; full_ref: string }, candidate: string, metadata: { citations: Citation[], chunks: Chunk[], time_ms: number } }[],
        config: {
            ragConfig: object,
            docStoreConfig: object,
            language?: string
        }
    } = {
        results: [],
        config: {
            ragConfig,
            docStoreConfig,
            ...(language != undefined ? { language: language } : {})
        }
    }

    const promises = tests.map(({ input, expected_output }) => async () => {
        const { key_ref, full_ref } = expected_output;
        const detectedLang: LanguageLabel = language == 'detect' ? await detectLanguage(input, true) : (language as LanguageLabel);
        const start = performance.now();
        const { answer: candidate, citations, chunks } = await rag.search(input, true, detectedLang);
        const end = performance.now();
        const time_ms = end - start;
        return { input, expected_output: { key_ref, full_ref }, candidate, metadata: { citations: citations ?? [], chunks, time_ms } };
    });

    if (parallel) {
        console.log('Running tests in parallel...');
        const results = await Promise.all(promises.map(p => p()));
        output.results.push(...results);
    }

    else {
        console.log('Running tests sequentially...');
        for (const p of tqdm(promises)) {
            const result = await p();
            output.results.push(result);
        }
    }

    const normalizedTestFile = normalizedTestPath.replaceAll(path.sep, PATH_NORMALIZATION_MARK);
    const normalizedConfigFile = normalizedConfigPath.replaceAll(path.sep, PATH_NORMALIZATION_MARK);

    const fileName = path.join(createOutputFolderIfNeeded('output', 'candidates'), `${normalizedTestFile}_${normalizedConfigFile}.json`);
    await writeFile(fileName, JSON.stringify(output, null, 2));
    console.log('Report written to', fileName);
}


const main = async () => {
    const { test: testFile, config: configFile, parallel } = await yargs(hideBin(process.argv))
        .option('test', { alias: 't', type: 'string', demandOption: true, description: 'Path to evaluation test JSON' })
        .option('config', { alias: 'c', type: 'string', demandOption: true, description: 'Path to RAG/docStore config JSON' })
        .option('parallel', { alias: 'p', type: 'boolean', default: false, description: 'Run tests in parallel (default: false)' })
        .help()
        .parse();

    const multipleFiles = await glob(configFile!);
    if (multipleFiles.length > 1) {
        console.log(`Found ${multipleFiles.length} config files matching the pattern. Running tests for each file...`);
        for (const file of multipleFiles) {
            console.log(`Running test for: ${file}`);
            await runSingleTest(testFile!, file, parallel);
        }
        return;
    }

    await runSingleTest(testFile!, configFile!, parallel);
}

main().catch(console.error).then(_ => process.exit(0));