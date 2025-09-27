import { writeFileSync } from 'fs';
const separator = '\t';
const nextline = '\n';
import rawData from '../../../output/evaluations/metrics/v2/results.json';

const data = rawData as {
    metrics: {
        rouge_recall: any[];
        rouge_precision: any[];
        meteor: any[];
        bertscore: any[];
        bleurt: any[];
    };
};

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

type MetricRow = {
    group: string;
    test: string;
    candidate: string;
    rouge_key_recall?: number;
    rouge_full_precision?: number; // <-- nuovo campo
    meteor_key?: number;
    meteor_full?: number;
    bert_key?: number;
    bert_full?: number;
    bleurt_key?: number;
    bleurt_full?: number;
};

const merged = new Map<string, MetricRow>();

function printTable() {
    const keyOf = (x: any) => `${x.group}||${x.test}||${x.candidate}`;

    // --- Merge per ogni metrica ---
    for (const r of data.metrics.rouge_recall) {
        const k = keyOf(r);
        if (!merged.has(k))
            merged.set(k, { group: r.group, test: r.test, candidate: r.candidate });
        merged.get(k)!.rouge_key_recall = r.result_continuous_keyref;
    }

    for (const r of data.metrics.rouge_precision) {
        const k = keyOf(r);
        if (!merged.has(k))
            merged.set(k, { group: r.group, test: r.test, candidate: r.candidate });
        merged.get(k)!.rouge_full_precision = r.result_continuous_fullref; // <-- usa fullref!
    }

    for (const r of data.metrics.meteor) {
        const k = keyOf(r);
        if (!merged.has(k))
            merged.set(k, { group: r.group, test: r.test, candidate: r.candidate });
        merged.get(k)!.meteor_key = r.result_continuous_keyref;
        merged.get(k)!.meteor_full = r.result_continuous_fullref;
    }

    for (const r of data.metrics.bertscore) {
        const k = keyOf(r);
        if (!merged.has(k))
            merged.set(k, { group: r.group, test: r.test, candidate: r.candidate });
        merged.get(k)!.bert_key = r.result_continuous_keyref;
        merged.get(k)!.bert_full = r.result_continuous_fullref;
    }

    for (const r of data.metrics.bleurt) {
        const k = keyOf(r);
        if (!merged.has(k))
            merged.set(k, { group: r.group, test: r.test, candidate: r.candidate });
        merged.get(k)!.bleurt_key = r.result_continuous_keyref;
        merged.get(k)!.bleurt_full = r.result_continuous_fullref;
    }

    // --- Costruzione tabella ---
    let table = '';

    for (const group of groupOrder) {
        const rows = Array.from(merged.values()).filter((x) => x.group === group);
        if (rows.length === 0) continue;

        for (const row of rows) {
            table += [
                row.rouge_key_recall?.toFixed(2),
                row.rouge_full_precision?.toFixed(2), // <-- ora corretto
                row.meteor_key?.toFixed(2),
                row.meteor_full?.toFixed(2),
                row.bert_key?.toFixed(2),
                row.bert_full?.toFixed(2),
                row.bleurt_key?.toFixed(2),
                row.bleurt_full?.toFixed(2),
            ].join(separator);
            table += nextline;
        }

        table += nextline;
        table += nextline;
    }

    writeFileSync('output/evaluations/metrics/v2/metrics-table.txt', table);
    console.log('Output written in in output/evaluations/metrics/v2/metrics-table.txt');
}

printTable();
