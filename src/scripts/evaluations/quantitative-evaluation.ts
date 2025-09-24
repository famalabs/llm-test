import { tqdm } from "node-console-progress-bar-tqdm";
import { readFile, writeFile } from "fs/promises"
import yargs from "yargs"
import { Rag } from "../../rag";
import ragTestSuiteQuestions from '../../../data/rag-test-suite.json';
import { AnswerFormatInterface, getRagAgentToolFunction } from "../../rag/rag-tool";
import { customLLMAsAJudge, Metric, MetricArguments } from "./metrics";
import { extractKeywords } from "../../lib/nlp";
import { createOutputFolderIfNeeded } from "../../utils";
import { hideBin } from "yargs/helpers";
import Redis from "ioredis";
import { VectorStore } from "../../vector-store";
import { ensureIndex } from "../../lib/redis-index";
import { Chunk } from "../../lib/chunks";

const allMetrics = { customLLMAsAJudge };

const main = async () => {
    const { json, indexName } = await yargs(hideBin(process.argv))
        .option('json', { alias: 'j', type: 'string', demandOption: true, description: 'Path to RAG config JSON' })
        .option('indexName', { alias: 'v', type: 'string', demandOption: true, description: 'Name of the index of the document store' })
        .help()
        .parse();

    const fileContent = await readFile(json!, 'utf-8');
    const config = JSON.parse(fileContent);
    
    const docStoreRedisClient = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
    await ensureIndex(docStoreRedisClient, indexName, [
        "pageContent", "TEXT",
        "source", "TAG",
        "metadata", "TEXT",
    ]);
    const docStore = new VectorStore<Chunk>({
        client: docStoreRedisClient,
        indexName,
        fieldToEmbed: 'pageContent'
    });
    const rag = new Rag(config, docStore);

    await rag.init();
    const summary = rag.printSummary();
    const start = performance.now();
    const getRagAnswer = getRagAgentToolFunction(rag);


    console.log('Generating answers for evaluation questions...');
    const evaluationSamples = [];
    for (const { question, expectedAnswer } of tqdm(ragTestSuiteQuestions.questions)) {
        const { answer } = await getRagAnswer(question) as AnswerFormatInterface;
        const keywords = extractKeywords(expectedAnswer);
        evaluationSamples.push({ question, expectedAnswer, answer, keywords });
    }

    console.log('Evaluating metrics...');
    const evaluationResults: Record<string, { score: number }[]> = {};
    for (const metricName of tqdm(Object.keys(allMetrics))) {
        const metric: Metric = (allMetrics)[metricName as keyof typeof allMetrics];
        for (const { question, answer, expectedAnswer } of evaluationSamples) {
            const args: MetricArguments = {
                reference: expectedAnswer,
                prediction: answer,
                query: question
            }

            if (metricName == 'customLLMAsAJudge') {
                args.llm = 'mistral-small-latest';
            }

            const { score } = await metric.execute(args);

            if (!evaluationResults[metricName]) evaluationResults[metricName] = [];
            evaluationResults[metricName].push({ score });
        }
    }

    const metricAverages: Record<string, number> = {};
    for (const metricName in evaluationResults) {
        const results = evaluationResults[metricName];
        const total = results.reduce((acc, r) => acc + r.score, 0);
        metricAverages[metricName] = total / results.length;
    }

    let globalSum = 0;
    for (const metricName in evaluationResults) {
        for (const { score } of evaluationResults[metricName]) {
            globalSum += score;
        }
    }
    const cumulativeScore = globalSum / Object.keys(evaluationResults).length;

    let reportFile = ('='.repeat(50)) + "\nQuantitative Evaluation Report\n" + ('='.repeat(50)) + "\n\n";
    reportFile += `Cumulative Score: ${cumulativeScore.toFixed(4)}\n\n`;
    reportFile += "Scores per Metric:\n";
    for (const metricName in metricAverages) {
        reportFile += `- ${metricName}: ${metricAverages[metricName].toFixed(4)}\n`;
    }
    reportFile += "\n\n" + ('='.repeat(50)) + "\n";
    reportFile += "RAG Configuration:\n";
    reportFile += ('='.repeat(50)) + "\n";
    reportFile += summary

    const fileName = `${createOutputFolderIfNeeded('output/evaluations/quantitative')}/quantitative-evaluation-${Date.now()}.txt`;
    await writeFile(fileName, reportFile, 'utf-8');

    const elapsed = performance.now() - start;

    console.log('Report written to', fileName);
    console.log('Elapsed time:', elapsed, 'ms');
}

main().catch(console.error).then(_ => process.exit(0));