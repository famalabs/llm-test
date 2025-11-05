import { createOutputFolderIfNeeded } from "../../utils";
import { readFile, writeFile } from "fs/promises";
import { TherapyDrug } from "./interfaces";
import { evaluate } from "./evaluation";
import { hideBin } from "yargs/helpers";
import yargs from "yargs";
import path from "path";
import 'dotenv/config';

const main = async () => {
    const { input } = await yargs(hideBin(process.argv))
        .option('input', {
            alias: 'i',
            type: 'string',
            description: 'Path to Therapy candidates JSON file',
            demandOption: true
        })
        .help()
        .parse() as { input: string };

    const { results } = JSON.parse(await readFile(input, 'utf-8')) as { results: { input: string, expected_output: TherapyDrug[], candidate: TherapyDrug[] }[] };

    const scores = await evaluate({
        results
    });

    const outputFile = path.join(createOutputFolderIfNeeded('output', 'therapy'), 'scores.json');
    await writeFile(outputFile, JSON.stringify(scores, null, 2), 'utf-8');
    console.log('Evaluation results written to', outputFile);
};

main();