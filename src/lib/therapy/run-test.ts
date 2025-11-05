import { createOutputFolderIfNeeded, PATH_NORMALIZATION_MARK } from '../../utils';
import { readFile, writeFile } from 'fs/promises';
import { hideBin } from 'yargs/helpers';
import yargs from "yargs";
import path from 'path';
import 'dotenv/config';
import { extractStructuredTherapy, extractTherapyAsMarkdownTable } from './core';
import { LLMConfigProvider } from '../../llm';
import { tqdm } from 'node-console-progress-bar-tqdm';

const main = async () => {
    const { test: testFile, parallel, model, provider } = await yargs(hideBin(process.argv))
        .option('test', { alias: 't', type: 'string', demandOption: true, description: 'Path to LMA evaluation test JSON' })
        .option('parallel', { alias: 'p', type: 'boolean', default: false, description: 'Run test cases in parallel (default: false)' })
        .option('model', { alias: 'm', type: 'string', description: 'LLM model id, e.g., mistral-small-latest', demandOption: true })
        .option('provider', { alias: 'l', type: 'string', description: 'LLM provider, e.g., mistral', demandOption: true, choices: ['mistral', 'openai', 'google'] })
        .help()
        .parse() as {
            test: string,
            parallel: boolean,
            model: string,
            provider: LLMConfigProvider
        };

    const normalizedTestPath = path.normalize(testFile);

    const testsData = (JSON.parse(await readFile(normalizedTestPath, 'utf-8'))).therapies;

    const tests = [];

    const runOne = async ({ prompt, expected_therapies }: {
        prompt: string,
        expected_therapies: any
    }) => {
        const mdTable = await extractTherapyAsMarkdownTable(prompt, model, provider);
        const candidate = await extractStructuredTherapy(mdTable, model, provider);

        return { candidate, expected_therapies, prompt };
    };

    if (parallel) {
        console.log('Running Therapy tests in parallel...');
        const results = await Promise.all(testsData.map((tc: any) => runOne(tc)));
        for (const r of results) {
            tests.push({
                candidate: r.candidate,
                expectedTherapies: r.expected_therapies,
                prompt: r.prompt
            });
        }
    }

    else {
        console.log('Running Therapy tests sequentially...');
        for (const tc of tqdm(testsData)) {
            const r = await runOne(tc as { prompt: string, expected_therapies: any });
            tests.push({
                candidate: r.candidate,
                expectedTherapies: r.expected_therapies,
                prompt: r.prompt
            });
        }
    }
    const normalizedTestFile = normalizedTestPath.replaceAll(path.sep, PATH_NORMALIZATION_MARK);
    const outDir = createOutputFolderIfNeeded('output', 'therapy', 'candidates');
    const outPath = path.join(outDir, `${normalizedTestFile}.json`);

    await writeFile(outPath, JSON.stringify(tests, null, 2), 'utf-8');
    console.log('Therapy output written to', outPath);
};

main().catch(console.error).then(_ => process.exit(0));
