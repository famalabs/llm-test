import { tqdm } from 'node-console-progress-bar-tqdm';
import { z } from 'zod';
import { mistral } from '@ai-sdk/mistral';
import yargs from "yargs";
import { generateObject, ModelMessage } from 'ai';
import {
    parseDocx,
} from './extractors';
import { createOutputFolderIfNeeded, getFileExtension } from "../../lib/utils";
import { writeFile } from "fs/promises";
import questions from '../../../data/rag-table-tests.json';
import 'dotenv/config';

const answerQuestion = async (table: string, format:string,  question: string, llm: string) => {
    const systemPrompt = `You are an expert at extracting and analyzing data from ${format.toUpperCase()} tables.

Your task: Extract the answer to the question from the provided ${format.toUpperCase()} table.
You must answer only based on the data present in the table. If the data is not present, you must say so.
You must answer in the same language as the question.
You must answer in a concise way, using a complete sentence that includes the answer.
`;
    const { object: result } = await generateObject({
        model: mistral(llm),
        schema: z.object({
            answer: z.string().describe('The answer to the question, based solely on the data present in the table. If the data is not present, say so. Answer in the same language as the question.'),
        }),
        temperature: 0,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Here is the ${format.toUpperCase()} table: """\n\n${table}"""\n\nHere is the question:"""\n\n${question}\n\n"""Provide a concise answer in a complete sentence that includes the answer.` }
        ] as ModelMessage[]
    });

    const { answer } = result;
    return answer;
};

const main = async () => {
    const argv = await yargs(process.argv.slice(2))
        .option('source', { alias: 's', type: 'string', demandOption: true, description: 'Path to the source .docx file' })
        .option('llm', { alias: 'l', type: 'string', demandOption: true, description: 'LLM model id, e.g., mistral-small-latest' })
        .option('format', { alias: 'f', choices: ['html', 'md', 'text'] as const, type: 'string', demandOption: true, description: 'Output table format' })
        .help().alias('help', 'h').argv as unknown as { source: string; llm: string; format: 'html' | 'md' | 'text' };
    const { source, llm, format } = argv;

    const sourceExtension = getFileExtension(source!);
    let parsed: string | undefined = undefined;

    if (sourceExtension === 'docx') {
        console.log('Will parse .docx file');
        parsed = await parseDocx({ source: source!, format: format!  as 'html' | 'md' | 'text' });
    }
    else {
        console.error('Unsupported file type. Only .docx is supported.');
        process.exit(1);
    }

    if (!parsed) {throw new Error('No conversion result returned.')};

    await writeFile(`${createOutputFolderIfNeeded('output/document-ingestion/table')}/raw-table.${format}`, parsed);

    let output = '=============== RAG Table Extraction and QA ===============\n\n';
    output += '========================================================\n\n';

    for (const { question, expectedAnswer } of tqdm(questions.questions)) {
        output += `### Question: ${question}\n\n`;
        output += `### Expected Answer: ${expectedAnswer}\n\n`;
        const answer = await answerQuestion(parsed, format!, question, llm!);
        output += `### Actual Answer: ${answer}\n\n`;
        output += '========================================================\n\n';
    }

    await writeFile(`${createOutputFolderIfNeeded('output/document-ingestion/table')}/table-extraction-${format}-${llm}.txt`, output);
}


main().catch(console.error).then(() => process.exit(0));