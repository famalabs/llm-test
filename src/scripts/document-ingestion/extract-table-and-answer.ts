import { createOutputFolderIfNeeded, getFileExtension } from '../../utils';
import { generateObject, ModelMessage } from 'ai';
import { readFile, writeFile } from "fs/promises";
import path from 'path';
import { TABLE_QA_PROMPT } from '../../lib/prompt';
import { hideBin } from 'yargs/helpers';
import { parseDoc } from '../../lib/ingestion';
import { mistral } from '@ai-sdk/mistral';
import { tqdm } from 'node-console-progress-bar-tqdm';
import { z } from 'zod';
import questions from '../../../data/rag-table-tests.json';
import yargs from "yargs";
import 'dotenv/config';

const answerQuestion = async (table: string, format: string, question: string, llm: string) => {

    const { object: result } = await generateObject({
        model: mistral(llm),
        schema: z.object({
            answer: z.string().describe('The answer to the question, based solely on the data present in the table. If the data is not present, say so. Answer in the same language as the question.'),
        }),
        temperature: 0,
        messages: [
            { role: "system", content: TABLE_QA_PROMPT(format) },
            { role: "user", content: `Here is the ${format.toUpperCase()} table: """\n\n${table}"""\n\nHere is the question:"""\n\n${question}\n\n"""Provide a concise answer in a complete sentence that includes the answer.` }
        ] as ModelMessage[]
    });

    const { answer } = result;
    return answer;
};

const main = async () => {
    const argv = await yargs(hideBin(process.argv))
        .option('source', { alias: 's', type: 'string', demandOption: true, description: 'Path to the source .docx file' })
        .option('llm', { alias: 'l', type: 'string', demandOption: true, description: 'LLM model id, e.g., mistral-small-latest' })
        .option('format', { alias: 'f', choices: ['html', 'markdown', 'text'], type: 'string', demandOption: true, description: 'Output table format' })
        .help()
        .parse();

    const { source, llm, format } = argv;

    const sourceExtension = getFileExtension(source!);
    let parsed: string | undefined = undefined;

    if (sourceExtension === 'docx') {
        console.log('Will parse .docx file');
        const inputBuffer = await readFile(source!);
        const output = await parseDoc(inputBuffer, format! as 'html' | 'markdown' | 'text');
        parsed = output;
    }
    else {
        console.error('Unsupported file type. Only .docx is supported.');
        process.exit(1);
    }

    if (!parsed) { throw new Error('No conversion result returned.') };

    const outDir = createOutputFolderIfNeeded('output','document-ingestion','table');
    await writeFile(path.join(outDir, `raw-table.${format}`), parsed);

    let output = '=============== RAG Table Extraction and QA ===============\n\n';
    output += '========================================================\n\n';

    for (const { question, expectedAnswer } of tqdm(questions.questions)) {
        output += `### Question: ${question}\n\n`;
        output += `### Expected Answer: ${expectedAnswer}\n\n`;
        const answer = await answerQuestion(parsed, format!, question, llm!);
        output += `### Actual Answer: ${answer}\n\n`;
        output += '========================================================\n\n';
    }

    await writeFile(path.join(outDir, `table-extraction-${format}-${llm}.txt`), output);
}


main().catch(console.error).then(() => process.exit(0));