import { readFile, writeFile } from "fs/promises"
import yargs from "yargs"
import { Rag } from "../../rag";
import { AnswerFormatInterface, getRagAgentToolFunction } from "../../rag/rag-tool";
import { tqdm } from "node-console-progress-bar-tqdm";
import { PATH_NORMALIZATION_MARK } from "../../lib/nlp";
import { createOutputFolderIfNeeded } from "../../utils";
import { hideBin } from "yargs/helpers";
import Redis from "ioredis";
import { VectorStore } from "../../vector-store";
import { ensureIndex } from "../../lib/redis-index";
import { Chunk } from "../../lib/chunks";

const main = async () => {
    const { test: testFile, config: configFile, indexName } = await yargs(hideBin(process.argv))
        .option('test', { alias: 't', type: 'string', demandOption: true, description: 'Path to evaluation test JSON' })
        .option('config', { alias: 'c', type: 'string', demandOption: true, description: 'Path to RAG config JSON' })
        .option('indexName', { alias: 'v', type: 'string', demandOption: true, description: 'Name of the index of the document store' })
        .help()
        .parse();

    if (
        testFile?.includes('_') || configFile?.includes('_') ||
        testFile?.includes(PATH_NORMALIZATION_MARK) || configFile?.includes(PATH_NORMALIZATION_MARK)
    ) {
        throw new Error('Filenames cannot contain underscores or colons');
    }

    const test: { questions: { question: string; expectedAnswer: string }[] } = await JSON.parse(await readFile(testFile!, 'utf-8'));
    const config = await JSON.parse(await readFile(configFile!, 'utf-8'));
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

    const rag = new Rag(config, docStore);

    await rag.init();

    const output: {
        results: { question: string; reference: string; candidate: string }[],
        config: object
    } = {
        results: [],
        config
    }
    const getRagAnswer = getRagAgentToolFunction(rag);

    for (const { question, expectedAnswer: reference } of tqdm(test.questions)) {
        const { answer: candidate } = await getRagAnswer(question) as AnswerFormatInterface;
        output.results.push({ question, reference, candidate });
    }

    const normalizedTestFile = (testFile!).replaceAll('/', PATH_NORMALIZATION_MARK);
    const normalizedConfigFile = (configFile!).replaceAll('/', PATH_NORMALIZATION_MARK);

    const fileName = `${createOutputFolderIfNeeded('output/candidates')}/${normalizedTestFile}_${normalizedConfigFile}.json`;
    await writeFile(fileName, JSON.stringify(output, null, 2));
    console.log('Report written to', fileName);
}

main().catch(console.error).then(_ => process.exit(0));