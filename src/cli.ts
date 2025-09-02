import { generateObject } from 'ai';
import 'dotenv/config';
import { corpusInContext } from './lib/prompt/corpus-in-context';
import * as readline from 'node:readline/promises';
import { readFile } from 'node:fs/promises';
import z from 'zod';
import { addLineNumbers, getCitationText } from './lib/nlp'
import { mistral } from '@ai-sdk/mistral';
import { CliSessionRecording, parseCliArgs } from './lib/cli';
import { RagMode } from './types/rag';

const terminal = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const main = async () => {
    const { llm, filesPath } = parseCliArgs();

    const session = new CliSessionRecording(llm, RagMode.CorpusInContext, filesPath);

    console.log('\n[ === Using corpus-in-context RAG with LLM :', llm, 'on files =', filesPath, '=== ]\n');
    const documents = await Promise.all(filesPath.map(path => readFile(path, 'utf-8')))

    console.log('Loaded', documents.length, 'documents.\n');

    while (true) {
        const userQuery = await terminal.question('>> ')
        session.printSilent('\n\n[=== User Query ===]', userQuery);

        const { object: result } = await generateObject({
            model: mistral(llm),
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

        console.log(citations);

        session.print('\n\n[=== Answer ===]');
        session.print(answer);
        session.print('\n\nCitations:');
        session.print(citations.map(({ startLine, endLine, documentIdx }) => `\t[${documentIdx} / {${startLine}-${endLine}}] ${documents[documentIdx].length} ${getCitationText(documents[documentIdx], startLine, endLine)}`).join('\n'));
        session.print('\n\n');
    }
}

main().catch(console.error);