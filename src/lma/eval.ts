import { LLMConfigProvider } from "../llm"
import { LmaInput, LmaOutput } from "./interfaces";
import { hideBin } from "yargs/helpers"
import { readFile, writeFile } from "fs/promises";
import { evaluate } from "./evaluation";
import yargs from "yargs"
import 'dotenv/config';
import { createOutputFolderIfNeeded } from "../utils";
import path from "path";

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

    const data = JSON.parse(await readFile(input, 'utf-8')) as {
        results: {
            candidate: LmaOutput,
            expected_output: LmaOutput,
            input: LmaInput, 
            metadata?: Record<string, any>
        }[]
    };
    const results = await evaluate({
        results: data.results,
        model,
        provider
    });

    const outputFile = path.join(createOutputFolderIfNeeded('output', 'lma'), 'scores.json');
    await writeFile(outputFile, JSON.stringify(results, null, 2), 'utf-8');
    console.log('Evaluation results written to', outputFile);
}

main();