import { readFile } from "fs/promises";
import yargs from "yargs"
import { hideBin } from "yargs/helpers"

const main = async () => {
    const { input, metric } = await yargs(hideBin(process.argv))
    .option("input", {
        alias: "i",
        type: "string",
        description: "Input table .txt file to score",
        demandOption: true
    })
    .option("metric", {
        alias: "m",
        type: "string",
        description: "JSON metric evaluation file",
        demandOption: true
    })
    .parse();

    const tableFile = await readFile(input!, 'utf-8');
    const tableLines = tableFile.trim().split('\n').filter(line => line.split('\t').length === 3);
    if (tableLines.length === 0) {
        console.error("No valid lines found in the input file.");
        process.exit(1);
    }
    const metricFile = JSON.parse(await readFile(metric!, 'utf-8'));
    const scores:number[] = [];

    const allCandidates = Object.values(metricFile).flatMap((entry: any) => entry.Candidates.map((c: any) => ({
        expected_candidate: c['Candidate'], 
        expected_main_cat: c['MainCategory'], 
        expected_sub_cat: c['SubCategory'], 
        expected_continuous: c['Continuous']
    })));
    for (let i = 0; i < allCandidates.length; i++) {
        const candidate = allCandidates[i];
        const {
            expected_main_cat,
            expected_sub_cat,
            expected_continuous
        } = candidate;
        const [main_cat, sub_cat, continuous] = tableLines[i].split('\t')

        let mainScore = 4 - Math.abs((parseFloat(main_cat) - parseFloat(expected_main_cat)));
        let subScore = 4 - Math.abs((parseFloat(sub_cat) - parseFloat(expected_sub_cat)));

        // renormalize to 0-1
        mainScore = mainScore / 4;
        subScore = subScore / 4;

        const continuousScore = 1 - Math.abs((parseFloat(continuous) - parseFloat(expected_continuous)));


        const finalScore = (mainScore + subScore + continuousScore) / 3;
        scores.push(finalScore);
    }

    const finalScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    console.log(`Final score: ${finalScore}`);
}

main().catch(console.error).then(() => process.exit(0));