import { LLMConfigProvider } from "../llm"
import { LmaOutput } from "./interfaces";
import { hideBin } from "yargs/helpers"
import { readFile } from "fs/promises";
import { evaluate } from "./evaluation";
import yargs from "yargs"
import 'dotenv/config';

const main = async ()=> {
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
        
    const data = JSON.parse(await readFile(input, 'utf-8')) as { predictions: LmaOutput[], expectedOutputs: LmaOutput[] };
    console.log('Evaluations:');
    console.log(await evaluate({
        expectedOutputs: data.expectedOutputs, 
        generatedOutputs: data.predictions, 
        model, 
        provider
    }));
}

main();