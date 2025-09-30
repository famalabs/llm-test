import { readFile, writeFile } from "fs/promises"
import { tqdm } from "node-console-progress-bar-tqdm";
import yargs from "yargs";
import { customLLMAsAJudge, meteor, rouge1 } from "../scripts/evaluations/metrics";
import { createOutputFolderIfNeeded, mean } from '../utils';
import { hideBin } from "yargs/helpers";
import path from 'path';
const allMetrics = { customLLMAsAJudge, meteor, rouge1 };

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
        for (const { reference, candidate } of resultsContent.results) {
            const args: { reference: string; prediction: string; query?: string; llm?: string } = { reference, prediction: candidate };

            if (name === 'llm-as-a-judge') {
                args.query = resultsContent.results[0].question;
                args.llm = 'mistral-small-latest';
            }

            const { score }= await execute(args);
            scores.push(score);
        }
        evaluations[name] = scores;
    }

    let out = `llm, ${mean(evaluations['llm-as-a-judge'])}, meteor, ${mean(evaluations['meteor'])}, rouge1, ${mean(evaluations['rouge1'])}\n`;
    out += "#,query,reference,candidate,llm,meteor,rouge1\n";
    for (let i = 0; i < resultsContent.results.length; i++) {
        const { question, reference, candidate } = resultsContent.results[i];
        out += `${i + 1},"${question.replaceAll('"', '""')}","${reference.replaceAll('"', '""')}","${candidate.replaceAll('"', '""')}",${evaluations['llm-as-a-judge'][i]},${evaluations['meteor'][i]},${evaluations['rouge1'][i]}\n`;
    }

    const fileName = path.join(createOutputFolderIfNeeded('output','scores'), outputFileName);
    await writeFile(fileName, out);
    console.log('Report written to', fileName);

}


main().catch(console.error).then(_ => process.exit(0));