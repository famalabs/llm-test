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

const sentimentScores = (sentimentScores: SentimentScores, expectedScores: SentimentScores) => {
    const polarityScore = 1 - Math.abs((sentimentScores.polarity ?? 0) - (expectedScores.polarity ?? 0));
    const involvementScore = 1 - Math.abs((sentimentScores.involvement ?? 0) - (expectedScores.involvement ?? 0));
    const energyScore = 1 - Math.abs((sentimentScores.energy ?? 0) - (expectedScores.energy ?? 0));
    const temperScore = 1 - Math.abs((sentimentScores.temper ?? 0) - (expectedScores.temper ?? 0));
    const moodScore = 1 - Math.abs((sentimentScores.mood ?? 0) - (expectedScores.mood ?? 0));
    const empathyScore = 1 - Math.abs((sentimentScores.empathy ?? 0) - (expectedScores.empathy ?? 0));
    const toneScore = 1 - Math.abs((sentimentScores.tone ?? 0) - (expectedScores.tone ?? 0));
    const registryScore = 1 - Math.abs((sentimentScores.registry ?? 0) - (expectedScores.registry ?? 0));
    const sentimentScore = (polarityScore + involvementScore + energyScore + temperScore + moodScore + empathyScore + toneScore + registryScore) / 8;

    console.log('Sentiment Scores:');
    console.log(`\tOVERALL: ${sentimentScore.toFixed(2)}`);
    console.log(`\tPolarity: ${polarityScore.toFixed(2)} [{expected: ${(expectedScores.polarity ?? 0).toFixed(2)} | got: ${(sentimentScores.polarity ?? 0).toFixed(2)}]`);
    console.log(`\tMood: ${moodScore.toFixed(2)} [{expected: ${(expectedScores.mood ?? 0).toFixed(2)} | got: ${(sentimentScores.mood ?? 0).toFixed(2)}]`);
    console.log(`\tTemper: ${temperScore.toFixed(2)} [{expected: ${(expectedScores.temper ?? 0).toFixed(2)} | got: ${(sentimentScores.temper ?? 0).toFixed(2)}]`);
    console.log(`\t\tEnergy: ${energyScore.toFixed(2)} [{expected: ${(expectedScores.energy ?? 0).toFixed(2)} | got: ${(sentimentScores.energy ?? 0).toFixed(2)}]`);
    console.log(`\t\tInvolvement: ${involvementScore.toFixed(2)} [{expected: ${(expectedScores.involvement ?? 0).toFixed(2)} | got: ${(sentimentScores.involvement ?? 0).toFixed(2)}]`);
    console.log(`\t\tEmpathy: ${empathyScore.toFixed(2)} [{expected: ${(expectedScores.empathy ?? 0).toFixed(2)} | got: ${(sentimentScores.empathy ?? 0).toFixed(2)}]`);
    console.log(`\t\tTone: ${toneScore.toFixed(2)} [{expected: ${(expectedScores.tone ?? 0).toFixed(2)} | got: ${(sentimentScores.tone ?? 0).toFixed(2)}]`);
    console.log(`\t\tRegistry: ${registryScore.toFixed(2)} [{expected: ${(expectedScores.registry ?? 0).toFixed(2)} | got: ${(sentimentScores.registry ?? 0).toFixed(2)}]`);
}

const evaluate = async (output: Partial<LMAOutput>, expected: LMAOutput) => {
    // sentiment analysis evaluation:
    console.log('Sentiment Analysis Evaluation (single):');  
    sentimentScores(output.sentiment!.single, expected.sentiment.single);

    console.log('\n\nSentiment Analysis Evaluation (cumulative):');  
    sentimentScores(output.sentiment!.cumulative, expected.sentiment.cumulative);

    // summarization evaluation:
    if (output.summary) {
        console.log('\n\nExpected Summary:', expected.summary);
        console.log('\n\nGenerated Summary:', output.summary);
    }

    else {
        console.log('\n\nSummarization not provided in output.');
    }


    // task analysis evaluation:
    if (output.task) {
        console.log('\n\nExpected Task:', expected.task);
        console.log('\n\nGenerated Task:', output.task);
    }

    else {
        console.log('\n\nTask analysis not provided in output.');
    }


    // user request detection evaluation:
    if (output.user_request != undefined) {
        console.log('\n\nExpected User Request:', expected.user_request);
        console.log('\n\nGenerated User Request:', output.user_request);
    } 
    
    else {
        console.log('\n\nUser Request not provided in output.');
    }

    if (output.request_satisfied != undefined) {
        console.log('\n\nExpected Request Satisfied:', expected.request_satisfied);
        console.log('\n\nGenerated Request Satisfied:', output.request_satisfied);
    } 
    
    else {
        console.log('\n\nRequest Satisfied not provided in output.');
    }
}

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

    const data = JSON.parse(await readFile(input, 'utf-8')) as { input: LMAInput, expected: any }[];

    for (const { input, expected } of data) {
        const prediction = {} as Partial<LMAOutput>;

        prediction.sentiment = await analyzeSentiment({ input, model, provider, parallel: true });

        if (shouldSummarize(input) || debug) {
            prediction.summary = await summarize({ input, model, provider });
        }

        if (shouldAnalyzeTask(input) || debug) {
            prediction.task = await analyzeTask({ input, model, provider });
        }

        const { user_request, request_satisfied } = await detectUserRequest({ input, model, provider, parallel: true });
        prediction.user_request = user_request;
        prediction.request_satisfied = request_satisfied;

        await evaluate(prediction, expected);
    }
}

main();