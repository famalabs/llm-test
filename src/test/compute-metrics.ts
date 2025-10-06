import { createOutputFolderIfNeeded, mean } from '../utils';
import { readFile, writeFile } from "fs/promises"
import { customLLMAsAJudge } from './evaluations/llm-as-a-judge';
import { tqdm } from "node-console-progress-bar-tqdm";
import { hideBin } from "yargs/helpers";
import yargs from "yargs";
import path from 'path';

const allMetrics = { customLLMAsAJudge };

const main = async () => {
    const { input } = await yargs(hideBin(process.argv))
        .option('input', { alias: 'i', type: 'string', demandOption: true, description: 'Path to candidates JSON produced by run-test' })
        .help()
        .parse();

    const normalizedInputPath = path.normalize(input!);
    const resultsContent = JSON.parse(await readFile(normalizedInputPath, 'utf-8'));
    const baseName = path.basename(normalizedInputPath, path.extname(normalizedInputPath));
    const outputFileName = `${baseName}.csv`;

    const evaluations : Record<string, number[]> = {};

    for (const metric of tqdm(Object.keys(allMetrics))) {
        const { name, execute } = (allMetrics)[metric as keyof typeof allMetrics];
        const scores: number[] = [];
        for (const { candidate, fullRef, keyRef } of resultsContent.results) {
            const args: { fullRef: string; keyRef: string; prediction: string; query?: string; llm?: string } = { 
                fullRef, 
                keyRef,  
                prediction: candidate,
            };

            if (name === 'llm-as-a-judge') {
                args.query = resultsContent.results[0].question;
                args.llm = 'mistral-small-latest';
            }

            const { score }= await execute(args);
            scores.push(score);
        }
        evaluations[name] = scores;
    }

    let out = `llm, ${mean(evaluations['llm-as-a-judge'])}\n`;
    out += "#,query,fullref,keyref,candidate,llm\n";
    for (let i = 0; i < resultsContent.results.length; i++) {
        const { question, fullRef, keyRef, candidate } = resultsContent.results[i];
        out += `${i + 1},"${question.replaceAll('"', '""')}","${fullRef.replaceAll('"', '""')}","${keyRef.replaceAll('"', '""')}","${candidate.replaceAll('"', '""')}",${evaluations['llm-as-a-judge'][i]}\n`;
    }

    const fileName = path.join(createOutputFolderIfNeeded('output','scores'), outputFileName);
    await writeFile(fileName, out);
    console.log('Report written to', fileName);

}


main().catch(console.error).then(_ => process.exit(0));