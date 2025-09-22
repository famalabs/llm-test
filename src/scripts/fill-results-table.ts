import { writeFileSync } from 'fs';
import data from '../../output/evaluations/metrics/cache_it.json';

const separator = '	';
const nextline = '\n';

const groupOrder = [
    'Battery', 'Pizza', 'Aspirina', 'Medicine', 'Unknown'
]

function printTable() {
    const candidates: Record<string, Record<string, string>> = {}

    // collect candidates.
    const allResults = Object.keys(data).map((llm) => (data)[llm as keyof typeof data].results.map((test) => ({...test, llm}))).flat();
    for (const result of allResults) {
       if (!candidates[result.candidate]) candidates[result.candidate] = {};
       candidates[result.candidate][result.llm] = result.result_continuous.toFixed(2);
    }

    const candidateOrder: Record<string, string[]> = {}; // per group candidate order
    for (const result of data['llm_judge_custom_small'].results) {
        if (!candidateOrder[result.group]) candidateOrder[result.group] = [];
        candidateOrder[result.group].push(result.candidate);
    }


    let table = '';

    for (const group of groupOrder) {
        console.log(candidateOrder)
        for (const candidate of candidateOrder[group]) { 
            const { rouge, llm_judge_custom_small, meteor, bertscore, bleurt } = candidates[candidate];
           table += [meteor, rouge, bleurt, bertscore, llm_judge_custom_small].join(separator);

            table += nextline;
        }
        table += nextline;
        table += nextline;
    }

    writeFileSync('output/evaluations/metrics/table.txt', table);
}

printTable();