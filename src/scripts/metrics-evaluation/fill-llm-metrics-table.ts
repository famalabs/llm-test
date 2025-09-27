import { writeFileSync } from 'fs';
import { hideBin } from 'yargs/helpers';
import yargs from 'yargs';
import { readFile } from 'fs/promises';
const separator = '\t';
const nextline = '\n';

const groupOrder = [
    'Battery',
    'Pizza',
    'Aspirina',
    'Medicine',
    'Unknown',
    'xanax',
    'controOki',
    'dosaggio',
    'cibo_aspirina',
    'gravidanza',
];

const merged = new Map<string, Record<string, any>>();

async function printTable() {



    const { mainSubMerged } = await yargs(hideBin(process.argv))
        .option("mainSubMerged", {
            alias: "m",
            type: "boolean",
            default: false,
            describe: "If true, read results version where main and sub are merged",
        })
        .parse();


    const path = `output/evaluations/metrics/v2/results${mainSubMerged ? '-main-sub-merged' : ''}-llm.json`;
    const data = JSON.parse(await readFile(path, "utf-8"));

    const keyOf = (x: any) => `${x.group}||${x.test}||${x.candidate}`;

    for (const r of data.metrics.llm_main) {
        const k = keyOf(r);
        if (!merged.has(k))
            merged.set(k, { group: r.group, test: r.test, candidate: r.candidate });
        merged.get(k)!.llm_main = r.result_continuous;
    }

    for (const r of data.metrics.llm_sub) {
        const k = keyOf(r);
        if (!merged.has(k))
            merged.set(k, { group: r.group, test: r.test, candidate: r.candidate });
        merged.get(k)!.llm_sub = r.result_continuous;
    }

    for (const r of data.metrics.llm_full) {
        const k = keyOf(r);
        if (!merged.has(k))
            merged.set(k, { group: r.group, test: r.test, candidate: r.candidate });
        merged.get(k)!.llm_full = r.result_continuous;
    }

    let table = '';

    for (const group of groupOrder) {
        const rows = Array.from(merged.values()).filter((x) => x.group === group);
        if (rows.length === 0) continue;

        for (const row of rows) {
            table += [
                row.llm_main?.toFixed(2),
                row.llm_sub?.toFixed(2),
                row.llm_full?.toFixed(2),
            ].join(separator);
            table += nextline;
        }

        table += nextline;
        table += nextline;
    }

    writeFileSync(`output/evaluations/metrics/v2/metrics-table-llm-merged=${mainSubMerged}.txt`, table);
    console.log(`Output written in output/evaluations/metrics/v2/metrics-table-llm-merged=${mainSubMerged}.txt`);
}

printTable();
