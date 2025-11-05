import { createOutputFolderIfNeeded, mean } from '../utils';
import { readFile, writeFile } from "fs/promises";
import { customLLMAsAJudge } from './evaluations/llm-as-a-judge';
import { tqdm } from "node-console-progress-bar-tqdm";
import { hideBin } from "yargs/helpers";
import yargs from "yargs";
import path from 'path';
import { glob } from 'glob';
import { LLMConfigProvider } from '../llm';
import 'dotenv/config';

const allMetrics = { customLLMAsAJudge };

type InputCandidates = {
    results: {
        candidate: string;
        expected_output: {
            key_ref: string;
            full_ref: string;
        };
        input: string;
        metadata: { time_ms : number }
    }[];
}

const computeMetric = async (
    metricName: string,
    execute: Function,
    resultsContent: InputCandidates,
    model: string,
    provider: LLMConfigProvider,
    parallel: boolean
) => {
    const argsBuilder = (candidate: string, expectedOutput: { key_ref: string; full_ref: string }, input: string) => ({
        fullRef: expectedOutput.full_ref,
        keyRef: expectedOutput.key_ref,
        candidate,
        query: metricName == "llm-as-a-judge" ? input : undefined,
        model: metricName == "llm-as-a-judge" ? model : undefined,
        provider: metricName == "llm-as-a-judge" ? provider : undefined,
    });

    const mapResults = async (results: InputCandidates['results']) => {
        if (parallel) {
            return await Promise.all(
                results.map(async ({ candidate, expected_output, input }) => {
                    const args = argsBuilder(candidate, expected_output, input);
                    return await execute(args);
                })
            );
        } else {
            const resultsArray: { score: number; explanation: string }[] = [];
            for (const { candidate, expected_output, input } of results) {
                const args = argsBuilder(candidate, expected_output, input);
                const { score, explanation } = await execute(args);
                resultsArray.push({ score, explanation });
            }
            return resultsArray;
        }
    };

    return await mapResults(resultsContent.results);
};

const main = async () => {
    const { input, model, provider, parallel } = await yargs(hideBin(process.argv))
        .option('input', { alias: 'i', type: 'string', demandOption: true, description: 'Path to candidates JSON produced by run-test' })
        .option('model', { alias: 'm', type: 'string', demandOption: true, description: 'Model to use for llm-as-a-judge' })
        .option('provider', { alias: 'p', type: 'string', choices: ['openai', 'mistral', 'google'], demandOption: true, description: 'Provider for llm-as-a-judge' })
        .option('parallel', { alias: 'P', type: 'boolean', default: false, description: 'Run evaluations in parallel (default: false)' })
        .help()
        .parse();

    const multipleFiles = await glob(input!);
    if (multipleFiles.length > 1) {
        console.log(`Found ${multipleFiles.length} input files matching the pattern. Computing metrics for each file...`);
        for (const file of multipleFiles) {
            console.log(`\nRunning metrics computation for: ${file}`);
            await computeMetricsForFile(file, model, provider as LLMConfigProvider, parallel);
        }
        return;
    }

    await computeMetricsForFile(input!, model, provider as LLMConfigProvider, parallel);
};

export async function computeMetricsForFile(
    input: string,
    model: string = "mistral-small-latest",
    provider: LLMConfigProvider = "mistral",
    parallel: boolean = false
) {
    const normalizedInputPath = path.normalize(input);
    const resultsContent = JSON.parse(await readFile(normalizedInputPath, "utf-8")) as InputCandidates;
    const baseName = path.basename(normalizedInputPath, path.extname(normalizedInputPath));
    const outputFileName = `${baseName}.csv`;

    const evaluations: Record<string, { score: number; explanation: string }[]> = {};

    for (const metric of tqdm(Object.keys(allMetrics))) {
        const { name, execute } = allMetrics[metric as keyof typeof allMetrics];
        const scoresAndExplanations = await computeMetric(name, execute, resultsContent, model, provider, parallel);
        evaluations[name] = scoresAndExplanations;
    }

    const llmMean = mean(evaluations["llm-as-a-judge"].map(e => e.score));
    const times = resultsContent.results.map((r) => r.metadata.time_ms);
    const meanTimeMs = times.length > 0 ? mean(times) : NaN;

    let out = `llm, ${llmMean}, time_ms, ${meanTimeMs}\n`;
    out += "#,query,fullref,keyref,candidate,llm_score,llm_explanation\n";

    for (let i = 0; i < resultsContent.results.length; i++) {
        const { input, expected_output: { key_ref: keyRef, full_ref: fullRef }, candidate } = resultsContent.results[i];
        out += `${i + 1},"${input.replaceAll('"', '""')}","${
            fullRef.replaceAll('"', '""')
        }","${
            keyRef.replaceAll('"', '""')
        }","${
            candidate.replaceAll('"', '""')
        }",${
            evaluations["llm-as-a-judge"][i].score
        },"${evaluations["llm-as-a-judge"][i].explanation.replaceAll('"', '""')}"\n`;
    }

    const fileName = path.join(createOutputFolderIfNeeded("output", "scores"), outputFileName);
    await writeFile(fileName, out);
    console.log("Report written to", fileName);
}

main().catch(console.error).then(_ => process.exit(0));
