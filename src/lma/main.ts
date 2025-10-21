import { hideBin } from 'yargs/helpers';
import yargs from "yargs"
import { readFile, writeFile } from 'fs/promises';
import { LMAInput, LMAOutput } from './interfaces';
import { analyzeSentiment } from './sentiment-analysis';
import { shouldSummarize, summarize } from './summarization';
import { LLMConfigProvider } from '../llm';
import 'dotenv/config';
import { analyzeTask, shouldAnalyzeTask, analyzeTaskAndDetectUserRequest } from './task-analysis';
import { detectUserRequest } from './user-request-detection';
import path from 'path';
import { createOutputFolderIfNeeded } from '../utils';

const main = async () => {
    const { input, model, provider, debug, verbose, tests, taur } = await yargs(hideBin(process.argv))
        .option('input', {
            alias: 'i',
            type: 'string',
            description: 'Path to LMA input JSON file',
            demandOption: true
        })
        .option('model', {
            alias: 'm',
            type: 'string',
            description: 'LLM model',
            demandOption: true
        })
        .option('provider', {
            alias: 'p',
            type: 'string',
            description: 'LLM provider',
            demandOption: true,
            choices: ['openai', 'mistral', 'google']
        })
        .option('debug', {
            alias: 'd',
            type: 'boolean',
            description: 'Enable debug mode to force summarization',
            default: false
        })
        .option('verbose', {
            alias: 'v',
            type: 'boolean',
            description: 'Enable verbose logging',
            default: false
        })
        .option('tests', {
            alias: 't',
            type: 'array',
            description: 'Specific tests to run (by index -- 0 -> sentiment, 1 -> summarization, 2 -> task analysis, 3 -> user request detection), if not specified, all tests will be run',
            default: []
        })
        .option('taur', {
            alias: 'a',
            type: 'boolean',
            description: 'Whether to merge task analysis and user request detection into a single test',
            default: false
        })
        .parse() as {
            input: string,
            model: string,
            provider: LLMConfigProvider,
            debug: boolean,
            verbose: boolean,
            tests: number[],
            taur: boolean
        };

    if (tests.length == 0) {
        console.log('No tests specified. Running all tests.');
    }

    else {
        const inTests = (i: number) => tests.includes(i);
        const testStrings = [];
        if (inTests(0)) testStrings.push('sentiment analysis');
        if (inTests(1)) testStrings.push('summarization');
        if (inTests(2)) testStrings.push('task analysis');
        if (inTests(3)) testStrings.push('user request detection');

        if (taur && (!inTests(2) || !inTests(3))) {
            throw new Error('When using --taur, both task analysis and user request detection tests must be specified.');
        }
        else {
            const last = testStrings.pop();
            testStrings[testStrings.length - 1] += ` + ${last} (taur mode)`;
        }

        console.log(`Running specified tests: ${testStrings.join(', ')}`);
    }

    const data = JSON.parse(await readFile(input, 'utf-8')) as { input: LMAInput, expected_output: LMAOutput }[];
    const predictions: LMAOutput[] = [];
    const expectedOutputs: LMAOutput[] = [];

    for (const { input, expected_output } of data) {
        const prediction = {} as LMAOutput;

        let start = performance.now();

        if (tests.length == 0 || tests.includes(0)) {
            console.log('Analyzing sentiment...');
            prediction.sentiment = await analyzeSentiment({ input, model, provider });
            console.log(`Sentiment analysis took ${(performance.now() - start).toFixed(2)} ms`);
        }

        if (tests.length == 0 || tests.includes(1)) {
            if (shouldSummarize(input) || debug) {
                start = performance.now();
                console.log('Summarizing conversation...');
                prediction.summary = await summarize({ input, model, provider });
                console.log(`Summarization took ${(performance.now() - start).toFixed(2)} ms`);
            }
        }

        if (taur) {
            if (tests.length == 0 || (tests.includes(2) && tests.includes(3))) {
                start = performance.now();
                console.log('Analyzing task and detecting user request (taur mode)...');
                const { task, user_request, request_satisfied } = await analyzeTaskAndDetectUserRequest({ input, model, provider });
                console.log(`Task analysis and user request detection took ${(performance.now() - start).toFixed(2)} ms`);

                prediction.task = task;
                prediction.user_request = user_request;
                prediction.request_satisfied = request_satisfied;
            }
        }
        else {
            if (tests.length == 0 || tests.includes(2)) {
                if (shouldAnalyzeTask(input) || debug) {
                    start = performance.now();
                    console.log('Analyzing task...');
                    prediction.task = await analyzeTask({ input, model, provider });
                    console.log(`Task analysis took ${(performance.now() - start).toFixed(2)} ms`);
                }
            }

            if (tests.length == 0 || tests.includes(3)) {
                start = performance.now();
                console.log('Detecting user request...');
                const { user_request, request_satisfied } = await detectUserRequest({ input, model, provider });
                console.log(`User request detection took ${(performance.now() - start).toFixed(2)} ms`);

                prediction.user_request = user_request;
                prediction.request_satisfied = request_satisfied;
            }
        }

        predictions.push(prediction);
        expectedOutputs.push(expected_output);

        if (verbose) {
            console.log('Input:', JSON.stringify(input, null, 2));
            console.log('Expected Output:', JSON.stringify(expected_output, null, 2));
            console.log('Prediction:', JSON.stringify(prediction, null, 2));
        }
    }


    const outputFolder = path.join('output', 'lma');
    createOutputFolderIfNeeded(outputFolder);
    const output = path.join(outputFolder, `evaluation_model=${model}_provider=${provider}_taur=${taur}.json`);
    await writeFile(output, JSON.stringify({
        predictions,
        expectedOutputs
    }, null, 2), 'utf-8');

    console.log(`LMA processing completed. Results saved to ${output}`);
}

main();