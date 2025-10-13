/**
 * Example use with glob:
 * npx tsx src/test/compute-metrics.ts -i "output/candidates/*example*.json"
 */

import { createOutputFolderIfNeeded, mean } from '../utils';
import { readFile, writeFile } from "fs/promises"
import { customLLMAsAJudge } from './evaluations/llm-as-a-judge';
import { tqdm } from "node-console-progress-bar-tqdm";
import { hideBin } from "yargs/helpers";
import yargs from "yargs";
import path from 'path';
import { glob } from 'glob';
import { LLMConfigProvider } from '../llm';

const allMetrics = { customLLMAsAJudge };

const main = async () => {
    const { input, model, provider } = await yargs(hideBin(process.argv))
        .option('input', { alias: 'i', type: 'string', demandOption: true, description: 'Path to candidates JSON produced by run-test' })
        .option('model', { alias: 'm', type: 'string', demandOption: true, description: 'Model to use for llm-as-a-judge' })
        .option('provider', { alias: 'p', type: 'string', choices: ['openai', 'mistral', 'google'], demandOption: true, description: 'Provider for llm-as-a-judge' })
        .help()
        .parse();

    const multipleFiles = await glob(input!);
    if (multipleFiles.length > 1) {
        console.log(`Found ${multipleFiles.length} input files matching the pattern. Computing metrics for each file...`);
        for (const file of multipleFiles) {
            console.log(`\nRunning metrics computation for: ${file}`);
            await computeMetricsForFile(file, model, provider as LLMConfigProvider);
        }
        return;
    }

    await computeMetricsForFile(input!, model, provider as LLMConfigProvider);
}

async function computeMetricsForFile(input: string, model: string = 'mistral-small-latest', provider: LLMConfigProvider = 'mistral') {

    const normalizedInputPath = path.normalize(input!);
    const resultsContent = JSON.parse(await readFile(normalizedInputPath, 'utf-8'));
    const baseName = path.basename(normalizedInputPath, path.extname(normalizedInputPath));
    const outputFileName = `${baseName}.csv`;

    const evaluations : Record<string, number[]> = {};

    for (const metric of tqdm(Object.keys(allMetrics))) {
        const { name, execute } = (allMetrics)[metric as keyof typeof allMetrics];
        const scores: number[] = [];
        for (const { candidate, fullRef, keyRef } of resultsContent.results) {
            const args: { fullRef: string; keyRef: string; prediction: string; query?: string; model?: string, provider?: LLMConfigProvider } = { 
                fullRef, 
                keyRef,  
                prediction: candidate,
            };

            if (name === 'llm-as-a-judge') {
                args.query = resultsContent.results[0].question;
                args.model = model;
                args.provider = provider;
            }

            const { score }= await execute(args);
            scores.push(score);
        }
        evaluations[name] = scores;
    }

    let out = `llm, ${mean(evaluations['llm-as-a-judge'])}\n`;
    out += "#,query,fullref,keyref,candidate,llm\n";
    for (let i = 0; i < resultsContent.results.length; i++) {
        const { question, fullRef, keyRef, candidate } = resultsContent.results[i];
        out += `${i + 1},"${question.replaceAll('"', '""')}","${fullRef.replaceAll('"', '""')}","${keyRef.replaceAll('"', '""')}","${candidate.replaceAll('"', '""')}",${evaluations['llm-as-a-judge'][i]}\n`;
    }

    const fileName = path.join(createOutputFolderIfNeeded('output','scores'), outputFileName);
    await writeFile(fileName, out);
    console.log('Report written to', fileName);

}


main().catch(console.error).then(_ => process.exit(0));