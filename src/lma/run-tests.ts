import { createOutputFolderIfNeeded, PATH_NORMALIZATION_MARK } from '../utils';
import { readFile, writeFile } from 'fs/promises';
import { LmaInput, LmaOutput, SentimentScores } from './interfaces';
import { hideBin } from 'yargs/helpers';
import { Lma } from './lma';
import yargs from "yargs";
import path from 'path';
import 'dotenv/config';

type LmaTestCase = { input: LmaInput, expected_output: LmaOutput, focus_on?: string };

const main = async () => {
    const { test: testFile, config: configFile, parallel, verbose, testSelection, debug } = await yargs(hideBin(process.argv))
        .option('test', { alias: 't', type: 'string', demandOption: true, description: 'Path to LMA evaluation test JSON' })
        .option('config', { alias: 'c', type: 'string', demandOption: true, description: 'Path to LMA config JSON' })
        .option('parallel', { alias: 'p', type: 'boolean', default: false, description: 'Run test cases in parallel (default: false)' })
        .option('verbose', { alias: 'v', type: 'boolean', default: false, description: 'Enable verbose logging' })
        .option('debug', { alias: 'd', type: 'boolean', default: false, description: 'Force summarization/task even if not needed' })
        .option('testSelection', {
            alias: 'T',
            type: 'string',
            description: 'Specific tests to run (by index: 0=sentiment, 1=summarization, 2=task analysis, 3=user request detection). Default: all. Example: --testSelection 0,2',
        })
        .help()
        .parse() as {
            test: string,
            config: string,
            parallel: boolean,
            verbose: boolean,
            debug: boolean,
            testSelection: string
        };

    if (
        testFile?.includes('_') || configFile?.includes('_') ||
        testFile?.includes(PATH_NORMALIZATION_MARK) || configFile?.includes(PATH_NORMALIZATION_MARK)
    ) {
        throw new Error(`Filenames cannot contain underscores or '${PATH_NORMALIZATION_MARK}'`);
    }

    const normalizedTestPath = path.normalize(testFile);
    const normalizedConfigPath = path.normalize(configFile);

    const testsData: LmaTestCase[] = await JSON.parse(await readFile(normalizedTestPath, 'utf-8'));
    const lmaConfig = await JSON.parse(await readFile(normalizedConfigPath, 'utf-8'));

    // in run-test.ts  (this script) summarization is always run on whole chat history.

    if (lmaConfig.summarizationConfig.C_MAX || lmaConfig.summarizationConfig.C_MIN ) {
        console.warn('Overriding LMA config summarization C_MAX and C_MIN to Infinity for this test run.');
    }

    const lma = new Lma({
        ...lmaConfig,
        summarizationConfig: {
            ...lmaConfig.summarizationConfig,
            C_MAX: Infinity,
            C_MIN: Infinity,
        }
    });

    let parsedTestSelection: number[] = [];
    const runAllTests = (testSelection ?? []).length == 0;

    if (runAllTests) {
        console.log('No tests specified. Running all tests.');
    } 
    
    else {
        parsedTestSelection = testSelection.split(',').map(s => parseInt(s.trim())).filter(i => !isNaN(i));
        if (parsedTestSelection.length == 0) {
            throw new Error('No valid test indices found in testSelection.');
        }

        const inTests = (i: number) => parsedTestSelection.includes(i);
        const testStrings = [];
        if (inTests(0)) testStrings.push('sentiment analysis');
        if (inTests(1)) testStrings.push('summarization');
        if (inTests(2)) testStrings.push('task analysis');
        if (inTests(3)) testStrings.push('user request detection');
        console.log(`Running specified tests: ${testStrings.join(', ')}`);
    }

    const predictions: LmaOutput[] = [];
    const expectedOutputs: LmaOutput[] = [];

    const runOne = async ({ input, expected_output }: LmaTestCase) => {
        const start = performance.now();
        let prediction = {} as LmaOutput & { sentiment: { lastMessageLookingAtHistory?: SentimentScores } };

        if (runAllTests) {
            prediction = await lma.mainCall(input);
            prediction.sentiment.lastMessageLookingAtHistory = await lma.getLastMessageSentimentLookingAtHistory(input);
        }
        
        else {
            // --- Selective tests ---
            if (parsedTestSelection.includes(0)) {
                console.log('Analyzing sentiment...');
                prediction.sentiment = {
                    single: await lma.getSingleMessageSentiment(input),
                    cumulative: await lma.getCumulativeSentiment(input), 
                    lastMessageLookingAtHistory: await lma.getLastMessageSentimentLookingAtHistory(input)
                };
            }

            if (parsedTestSelection.includes(1)) {
                if (lma.shouldSummarize(input) || debug) {
                    console.log('Summarizing conversation...');
                    prediction.summary = await lma.summarizeChatHistory(input);
                }
            }

            if (parsedTestSelection.includes(2)) {
                if (lma.shouldAnalyzeTask(input) || debug) {
                    console.log('Analyzing task...');
                    prediction.task = await lma.analyzeTask(input);
                }
            }

            if (parsedTestSelection.includes(3)) {
                console.log('Detecting user request...');
                const { user_request, request_satisfied } = await lma.detectUserRequest(input);
                prediction.user_request = user_request;
                prediction.request_satisfied = request_satisfied;
            }
        }

        const elapsed = performance.now() - start;
        if (verbose) {
            console.log(`Test completed in ${elapsed.toFixed(2)} ms`);
            console.log('Input:', JSON.stringify(input, null, 2));
            console.log('Expected Output:', JSON.stringify(expected_output, null, 2));
            console.log('Prediction:', JSON.stringify(prediction, null, 2));
        }

        return { prediction, expected_output };
    };

    if (parallel) {
        console.log('Running LMA tests in parallel...');
        const results = await Promise.all(testsData.map(tc => runOne(tc)));
        for (const r of results) {
            predictions.push(r.prediction);
            expectedOutputs.push(r.expected_output);
        }
    } 
    
    else {
        console.log('Running LMA tests sequentially...');
        for (const tc of testsData) {
            const r = await runOne(tc);
            predictions.push(r.prediction);
            expectedOutputs.push(r.expected_output);
        }
    }

    const normalizedTestFile = normalizedTestPath.replaceAll(path.sep, PATH_NORMALIZATION_MARK);
    const normalizedConfigFile = normalizedConfigPath.replaceAll(path.sep, PATH_NORMALIZATION_MARK);
    const outDir = createOutputFolderIfNeeded('output', 'lma', 'candidates');
    const outPath = path.join(outDir, `${normalizedTestFile}_${normalizedConfigFile}.json`);

    await writeFile(outPath, JSON.stringify({ predictions, expectedOutputs, lmaConfig }, null, 2), 'utf-8');
    console.log('LMA output written to', outPath);
};

main().catch(console.error).then(_ => process.exit(0));
