import { hideBin } from 'yargs/helpers';
import yargs from "yargs"
import { readFile } from 'fs/promises';
import { LMAInput, LMAOutput } from './interfaces';
import { analyzeSentiment, SentimentScores } from './sentiment-analysis';
import { shouldSummarize, summarize } from './summarization';
import { LLMConfigProvider } from '../llm';
import 'dotenv/config';
import { analyzeTask, shouldAnalyzeTask } from './task-analysis';
import { detectUserRequest } from './user-request-detection/core';
import { evaluate } from './evaluation/core';

const main = async () => {
    const { input, model, provider, debug } = await yargs(hideBin(process.argv))
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
        .parse() as {
            input: string,
            model: string,
            provider: LLMConfigProvider,
            debug: boolean
        };

    const data = JSON.parse(await readFile(input, 'utf-8')) as { input: LMAInput, expected_output: LMAOutput }[];
    const predictions: LMAOutput[] = [];
    const expectedOutputs: LMAOutput[] = [];

    for (const { input, expected_output } of data) {
        const prediction = {} as LMAOutput;

        let start = performance.now();
        console.log('Analyzing sentiment...');
        prediction.sentiment = await analyzeSentiment({ input, model, provider });
        console.log(`Sentiment analysis took ${(performance.now() - start).toFixed(2)} ms`);

        if (shouldSummarize(input) || debug) {
            start = performance.now();
            console.log('Summarizing conversation...');
            prediction.summary = await summarize({ input, model, provider });
            console.log(`Summarization took ${(performance.now() - start).toFixed(2)} ms`);
        }

        if (shouldAnalyzeTask(input) || debug) {
            start = performance.now();
            console.log('Analyzing task...');
            prediction.task = await analyzeTask({ input, model, provider });
            console.log(`Task analysis took ${(performance.now() - start).toFixed(2)} ms`);
        }

        start = performance.now();
        console.log('Detecting user request...');
        const { user_request, request_satisfied } = await detectUserRequest({ input, model, provider });
        console.log(`User request detection took ${(performance.now() - start).toFixed(2)} ms`);

        prediction.user_request = user_request;
        prediction.request_satisfied = request_satisfied;

        predictions.push(prediction);
        expectedOutputs.push(expected_output);
    }

    console.log('Evaluation results:');
    console.log(await evaluate({
        expectedOutputs,
        generatedOutputs: predictions,
        model,
        provider
    }));
}

main();