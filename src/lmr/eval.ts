import { LLMConfigProvider } from "../llm"
import { LmrInput, LmrOutput } from "./interfaces";
import { hideBin } from "yargs/helpers"
import { readFile, writeFile } from "fs/promises";
import { evaluate } from "./evaluation";
import yargs from "yargs"
import 'dotenv/config';
import path from "path";
import { createOutputFolderIfNeeded } from "../utils";

const main = async () => {
    const { input, model, provider } = await yargs(hideBin(process.argv))
        .option('input', {
            alias: 'i',
            type: 'string',
            description: 'Path to LMA output JSON file',
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
        .parse() as {
            input: string,
            model: string,
            provider: LLMConfigProvider
        };

    const data = JSON.parse(await readFile(input, 'utf-8')) as { results: { expected_output: { key_ref: string, full_ref: string }, input: LmrInput, candidate: LmrOutput }[] };
    const evaluations = await evaluate({
        results: data.results,
        model,
        provider
    });

    const outputFile = path.join(createOutputFolderIfNeeded('output', 'lmr'), 'scores.json');
    await writeFile(outputFile, JSON.stringify(evaluations, null, 2), 'utf-8');
    console.log('Evaluation results written to', outputFile);
}

main();