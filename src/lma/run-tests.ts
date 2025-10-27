import { createOutputFolderIfNeeded } from '../utils';
import { readFile, writeFile } from 'fs/promises';
import { LmaInput, LmaOutput } from './interfaces';
import { LLMConfigProvider } from '../llm';
import { hideBin } from 'yargs/helpers';
import { Lma } from './lma';
import yargs from "yargs"
import path from 'path';
import 'dotenv/config';
import { example_lma_tools } from './example.tools';

const main = async () => {
    const { input, model, provider, debug, verbose, tests } = await yargs(hideBin(process.argv))
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
        .parse() as {
            input: string,
            model: string,
            provider: LLMConfigProvider,
            debug: boolean,
            verbose: boolean,
            tests: number[]
        };

    const runAllTests = tests.length == 0;

    if (runAllTests) {
        console.log('No tests specified. Running all tests.');
    }

    else {
        const inTests = (i: number) => tests.includes(i);
        const testStrings = [];
        if (inTests(0)) testStrings.push('sentiment analysis');
        if (inTests(1)) testStrings.push('summarization');
        if (inTests(2)) testStrings.push('task analysis');
        if (inTests(3)) testStrings.push('user request detection');

        console.log(`Running specified tests: ${testStrings.join(', ')}`);
    }

    const modelProvider = { model, provider };
    const lma = new Lma({
        baseConfig: { ...modelProvider, parallel: true },
        userRequestConfig: {
            satisfactionDetection: { ...modelProvider },
            requestDetection: { ...modelProvider, mode: 'tools-params', tools: example_lma_tools }
        }
    });

    const data = JSON.parse(await readFile(input, 'utf-8')) as { input: LmaInput, expected_output: LmaOutput }[];
    const predictions: LmaOutput[] = [];
    const expectedOutputs: LmaOutput[] = [];

    for (const { input, expected_output } of data.slice(0,1)) {
        let prediction = {} as LmaOutput;

        let start = performance.now();


        if (runAllTests) {
            prediction = await lma.mainCall(input);
            console.log(`All tests took ${(performance.now() - start).toFixed(2)} ms`);
        }

        else {
            if (tests.includes(0)) {
                console.log('Analyzing sentiment...');
                prediction.sentiment = {
                    single: await lma.getSingleMessageSentiment(input),
                    cumulative: await lma.getCumulativeSentiment(input)
                };
                console.log(`Sentiment analysis took ${(performance.now() - start).toFixed(2)} ms`);
            }
    
            if (tests.includes(1)) {
                if (lma.shouldSummarize(input) || debug) {
                    start = performance.now();
                    console.log('Summarizing conversation...');
                    prediction.summary = await lma.summarizeChatHistory(input);
                    console.log(`Summarization took ${(performance.now() - start).toFixed(2)} ms`);
                }
            }
    
            if (tests.includes(2)) {
                if (lma.shouldAnalyzeTask(input) || debug) {
                    start = performance.now();
                    console.log('Analyzing task...');
                    prediction.task = await lma.analyzeTask(input);
                    console.log(`Task analysis took ${(performance.now() - start).toFixed(2)} ms`);
                }
            }
    
            if (tests.includes(3)) {
                start = performance.now();
                console.log('Detecting user request...');
                const { user_request, request_satisfied } = await lma.detectUserRequest(input);
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
    const output = path.join(outputFolder, `evaluation_model=${model}_provider=${provider}.json`);
    await writeFile(output, JSON.stringify({
        predictions,
        expectedOutputs
    }, null, 2), 'utf-8');

    console.log(`LMA processing completed. Results saved to ${output}`);
}

main();


