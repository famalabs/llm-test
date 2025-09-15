import { tqdm } from "node-console-progress-bar-tqdm";
import { readFile, writeFile } from "fs/promises"
import { parseCliArgs } from "../../lib/cli"
import { Rag } from "../../rag";
import ragTestSuiteQuestions from '../../../data/rag-test-suite.json';
import { AnswerFormatInterface, getRagAgentToolFunction } from "../../rag/rag-tool";
import { existsSync, mkdirSync } from "fs";
import { customLLMAsAJudge, Metric, testSpecific } from "./metrics";
import { extractKeywords } from "../../lib/nlp";
import { startChronometer, stopChronometer } from "../../lib/chronometer";
import { softmax } from "@huggingface/transformers";

const allMetrics = { customLLMAsAJudge, testSpecific };
const TRIALS = 3;

const createOutputFolderIfNeeded = () => {
    const outputFolder = 'output/evaluations/quantitative';
    if (!existsSync(outputFolder)) mkdirSync(outputFolder, { recursive: true });
    return outputFolder;
}

const main = async () => {
    const { json } = parseCliArgs(['json']);
    const fileContent = await readFile(json!, 'utf-8');
    const config = JSON.parse(fileContent);
    const rag = new Rag(config);

    await rag.init();
    const summary = rag.printSummary();
    startChronometer();
    const getRagAnswer = getRagAgentToolFunction(rag);

    // remapping weights so that they sum to 1
    softmax(Object.values(allMetrics).map(m => m.weight)).forEach((w, i) => {
        (Object.values(allMetrics)[i] as Metric).weight = w;
    });


    console.log('Generating answers for evaluation questions...');
    const evaluationSamples = [];
    for (const { question, expectedAnswer } of tqdm(ragTestSuiteQuestions.questions)) {
        const { answer } = await getRagAnswer(question) as AnswerFormatInterface;
        const keywords = extractKeywords(expectedAnswer);
        evaluationSamples.push({ question, expectedAnswer, answer, keywords });
    }

    console.log('Evaluating metrics...');
    const evaluationResults: Record<string, { score: number, weight: number }[]> = {};
    for (const metricName of tqdm(Object.keys(allMetrics))) {
        const metric: Metric = (allMetrics as any)[metricName];
        for (const { question, answer, expectedAnswer, keywords } of evaluationSamples) {
            const args: Record<string, any> = {
                reference: expectedAnswer,
                prediction: answer,
                query: question
            }

            if (metricName == 'testSpecific') {
                args.keywords = keywords;
            }

            if (metricName == 'customLLMAsAJudge') {
                args.llm = 'mistral-small-latest';
            }

            const { score } = await metric.execute(args);

            if (!evaluationResults[metricName]) evaluationResults[metricName] = [];
            evaluationResults[metricName].push({ score, weight: metric.weight });
        }
    }

    const metricAverages: Record<string, number> = {};
    for (const metricName in evaluationResults) {
        const results = evaluationResults[metricName];
        const totalWeighted = results.reduce((acc, r) => acc + r.score * r.weight, 0);
        const totalWeight = results.reduce((acc, r) => acc + r.weight, 0);
        metricAverages[metricName] = totalWeighted / totalWeight;
    }

    let globalWeightedSum = 0;
    let globalWeight = 0;
    for (const metricName in evaluationResults) {
        for (const { score, weight } of evaluationResults[metricName]) {
            globalWeightedSum += score * weight;
            globalWeight += weight;
        }
    }
    const cumulativeScore = globalWeightedSum / globalWeight;

    let reportFile = ('='.repeat(50)) + "\nQuantitative Evaluation Report\n" + ('='.repeat(50)) + "\n\n";
    reportFile += `Cumulative Weighted Score: ${cumulativeScore.toFixed(4)}\n\n`;
    reportFile += "Scores per Metric:\n";
    for (const metricName in metricAverages) {
        reportFile += `- ${metricName}: ${metricAverages[metricName].toFixed(4)}\n`;
    }
    reportFile += "\n\n" + ('='.repeat(50)) + "\n";
    reportFile += "RAG Configuration:\n";
    reportFile += ('='.repeat(50)) + "\n";
    reportFile += summary

    const fileName = `${createOutputFolderIfNeeded()}/quantitative-evaluation-${Date.now()}.txt`;
    await writeFile(fileName, reportFile, 'utf-8');

    const elapsed = stopChronometer();

    console.log('Report written to', fileName);
    console.log('Elapsed time:', elapsed, 'ms');
}

main().catch(console.error).then(_ => process.exit(0));