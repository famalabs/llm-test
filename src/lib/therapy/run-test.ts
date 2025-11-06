import { createOutputFolderIfNeeded, PATH_NORMALIZATION_MARK } from '../../utils';
import { readFile, writeFile } from 'fs/promises';
import { hideBin } from 'yargs/helpers';
import yargs from "yargs";
import path from 'path';
import 'dotenv/config';
import { extractStructuredTherapy, extractTherapyAsMarkdownTable } from './core';
import { LLMConfigProvider } from '../../llm';
import { tqdm } from 'node-console-progress-bar-tqdm';
import { TherapyDrug } from './interfaces';

const main = async () => {
    const { test: testFile, parallel, model, provider, augment } = await yargs(hideBin(process.argv))
        .option('test', { alias: 't', type: 'string', demandOption: true, description: 'Path to LMA evaluation test JSON' })
        .option('parallel', { alias: 'p', type: 'boolean', default: false, description: 'Run test cases in parallel (default: false)' })
        .option('model', { alias: 'm', type: 'string', description: 'LLM model id, e.g., mistral-small-latest', demandOption: true })
        .option('provider', { alias: 'l', type: 'string', description: 'LLM provider, e.g., mistral', demandOption: true, choices: ['mistral', 'openai', 'google'] })
        .option('augment', { alias: 'a', type: 'boolean', default: false, description: 'Whether to augment the input with model knowledge with a middle step' })
        .help()
        .parse() as {
            test: string,
            parallel: boolean,
            model: string,
            provider: LLMConfigProvider
            augment: boolean
        };

    const normalizedTestPath = path.normalize(testFile);

    const testsData = (JSON.parse(await readFile(normalizedTestPath, 'utf-8'))) as {
        input: string,
        expected_output: TherapyDrug
    }[];

    const results = [];

    const runOne = async ({ input, expected_output }: {
        input: string,
        expected_output: any
    }) => {
        const start = performance.now();
        let text = input;
        if (augment) {
            text = await extractTherapyAsMarkdownTable(input, model, provider);
        }
        const candidate = await extractStructuredTherapy(text, model, provider);
        const elapsed = performance.now() - start;

        return { candidate, expected_output, input, metadata: { time_ms: elapsed } };
    };

    if (parallel) {
        console.log('Running Therapy tests in parallel...');
        const testResults = await Promise.all(testsData.map((tc: any) => runOne(tc)));
        for (const r of testResults) {
            results.push({ ...r });
        }
    }

    else {
        console.log('Running Therapy tests sequentially...');
        for (const tc of tqdm(testsData)) {
            const r = await runOne(tc);
            results.push({ ...r });
        }
    }
    const normalizedTestFile = augment ? 'augmented_' : '' + testFile.split(/[/\\]/).pop()?.split('.').shift();
    const outDir = createOutputFolderIfNeeded('output', 'therapy', 'candidates');
    const outPath = path.join(outDir, `${normalizedTestFile}_${model}.json`);

    await writeFile(outPath, JSON.stringify({
        results, config: { therapyConfig: { baseConfig: { model, provider } } }
    }, null, 2), 'utf-8');
    console.log('Therapy output written to', outPath);
};

main().catch(console.error).then(_ => process.exit(0));
