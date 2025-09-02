import { generateObject } from 'ai';
import 'dotenv/config';
import { corpusInContext } from './lib/prompt/corpus-in-context';
import * as readline from 'node:readline/promises';
import { readFile } from 'node:fs/promises';
import z from 'zod';
import { addLineNumbers, getCitationText } from './lib/nlp'
import { mistral } from '@ai-sdk/mistral';

const LLM = 'mistral-small-latest';

console.log('[LLM] ', LLM, '\n\n');

const terminal = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const main = async () => {
    const documents = [await readFile('data/document_1.txt', 'utf-8')];

    while (true) {
        const userQuery = await terminal.question('>> ')
        const { object: result } = await generateObject({
            model: mistral(LLM),
            prompt: corpusInContext(documents.map(addLineNumbers), userQuery),
            schema: z.object({
                answer: z.string(),
                citations: z.array(
                    z.object({
                        documentIdx: z.number(),
                        startLine: z.number(),
                        endLine: z.number()
                    })
                )
            })
        });

        const { answer, citations } = result;

        console.log('\n\n');
        console.log(answer);
        console.log('\n\nCitations:');
        console.log(citations.map(({ startLine, endLine, documentIdx }) => `\t[${documentIdx} / {${startLine}-${endLine}}] ${getCitationText(documents[documentIdx], startLine, endLine)}`).join('\n'));
        console.log('\n\n');
    }
}

main().catch(console.error);