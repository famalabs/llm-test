import { readFile, writeFile } from "fs/promises"
import yargs from "yargs"
import { Rag } from "../../rag";
import ragTestSuiteQuestions from '../../../data/rag-test-suite.json';
import { createOutputFolderIfNeeded } from "../../utils";
import { hideBin } from "yargs/helpers";
import Redis from "ioredis";
import path from 'path';
import { VectorStore, ensureIndex } from "../../vector-store";
import { Chunk } from "../../lib/chunks";


const main = async () => {
    const { json, indexName } = await yargs(hideBin(process.argv))
        .option('json', { alias: 'j', type: 'string', demandOption: true, description: 'Path to RAG config JSON' })
        .option('indexName', { alias: 'i', type: 'string', demandOption: true, description: 'Name of the index of the document store' })
        .help()
        .parse();

    const fileContent = await readFile(json!, 'utf-8');
    const config = JSON.parse(fileContent);
    
    const docStoreRedisClient = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
    const indexSchema = [
        "pageContent", "TEXT",
        "source", "TAG",
        "metadata", "TEXT",
    ];
    const docStore = new VectorStore<Chunk>({
        client: docStoreRedisClient,
        indexName,
        fieldToEmbed: 'pageContent',
    });
    const rag = new Rag({...config, docStore});

    await ensureIndex(docStoreRedisClient, indexName!, indexSchema);
    await rag.init();
    const summary = rag.printSummary();
    let reportFile = summary + '\n\n';

    for (const { question } of ragTestSuiteQuestions.questions) {
        console.log('[ === User\'s Question === ]:');
        console.log(question, '\n\n');
        const { answer } = await rag.search(question);
        console.log('[ === Answer === ]:');
        console.log(answer, '\n\n');
        reportFile += `Question:\n${question}\n\nAnswer:\n${answer}\n\n========================\n\n`;
    }

    console.log('-----------------------------------\n');

    const fileName = path.join(createOutputFolderIfNeeded('output','evaluations','qualitative'), `qualitative-evaluation-${Date.now()}.txt`);
    await writeFile(fileName, reportFile);
    console.log('Report written to', fileName);
}

main().catch(console.error).then(_ => process.exit(0));