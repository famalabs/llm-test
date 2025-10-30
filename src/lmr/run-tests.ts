import { createOutputFolderIfNeeded, PATH_NORMALIZATION_MARK } from '../utils';
import { LmrInput, LmrOutput } from './interfaces';
import { readFile, writeFile } from 'fs/promises';
import { hideBin } from 'yargs/helpers';
import { Lmr } from './lmr';
import yargs from 'yargs';
import path from 'path';
import 'dotenv/config';

type LmrTestCase = { input: LmrInput, expected_output: LmrOutput };

const main = async () => {
	const { test: testFile, config: configFile, parallel, verbose } = await yargs(hideBin(process.argv))
		.option('test', { alias: 't', type: 'string', demandOption: true, description: 'Path to LMR evaluation test JSON' })
		.option('config', { alias: 'c', type: 'string', demandOption: true, description: 'Path to LMR config JSON' })
		.option('parallel', { alias: 'p', type: 'boolean', default: false, description: 'Run test cases in parallel (default: false)' })
		.option('verbose', { alias: 'v', type: 'boolean', default: false, description: 'Enable verbose logging' })
		.help()
		.parse() as { test: string, config: string, parallel: boolean, verbose: boolean };

	if (
		testFile?.includes('_') || configFile?.includes('_') ||
		testFile?.includes(PATH_NORMALIZATION_MARK) || configFile?.includes(PATH_NORMALIZATION_MARK)
	) {
		throw new Error(`Filenames cannot contain underscores or '${PATH_NORMALIZATION_MARK}'`);
	}

	const normalizedTestPath = path.normalize(testFile);
	const normalizedConfigPath = path.normalize(configFile);

	const tests: LmrTestCase[] = await JSON.parse(await readFile(normalizedTestPath, 'utf-8'));
	const lmrConfig = await JSON.parse(await readFile(normalizedConfigPath, 'utf-8'));

	const lmr = new Lmr(lmrConfig);

	const predictions: LmrOutput[] = [];
	const expectedOutputs: LmrOutput[] = [];

	const runOne = async ({ input, expected_output }: LmrTestCase) => {
		const start = performance.now();
		const prediction = await lmr.mainCall(input);
		const elapsed = performance.now() - start;
		if (verbose) console.log(`Test completed in ${elapsed.toFixed(2)} ms`);
		return { prediction, expected_output };
	};

	if (parallel) {
		console.log('Running LMR tests in parallel...');
		const results = await Promise.all(tests.map(tc => runOne(tc)));
		for (const r of results) {
			predictions.push(r.prediction);
			expectedOutputs.push(r.expected_output);
		}
	} else {
		console.log('Running LMR tests sequentially...');
		for (const tc of tests) {
			const r = await runOne(tc);
			predictions.push(r.prediction);
			expectedOutputs.push(r.expected_output);
		}
	}

	const normalizedTestFile = normalizedTestPath.replaceAll(path.sep, PATH_NORMALIZATION_MARK);
	const normalizedConfigFile = normalizedConfigPath.replaceAll(path.sep, PATH_NORMALIZATION_MARK);
	const outDir = createOutputFolderIfNeeded('output', 'lmr', 'candidates');
	const outPath = path.join(outDir, `${normalizedTestFile}_${normalizedConfigFile}.json`);

	await writeFile(outPath, JSON.stringify({ predictions, expectedOutputs }, null, 2), 'utf-8');
	console.log('LMR output written to', outPath);
}

main().catch(console.error).then(_ => process.exit(0));