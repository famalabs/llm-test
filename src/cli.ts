import { CliSessionRecording, parseCliArgs, getUserInput } from './lib/cli';
import { corpusInContext } from './lib/prompt/corpus-in-context';
import { addLineNumbers, getCitationText } from './lib/nlp'
import { readFile } from 'node:fs/promises';
import { mistral } from '@ai-sdk/mistral';
import { RagMode } from './constants/rag';
import { generateObject } from 'ai';
import 'dotenv/config';
import z from 'zod';

const main = async () => {
    const { llm, files } = parseCliArgs(['llm', 'files']);
    const filesPath = files!.split(',');

    const session = new CliSessionRecording(llm!, RagMode.CorpusInContext, filesPath);

    console.log('\n[ === Using corpus-in-context RAG with LLM :', llm, 'on files =', filesPath, '=== ]\n');
    const documents = await Promise.all(filesPath.map(path => readFile(path, 'utf-8')))

    console.log('Loaded', documents.length, 'documents.\n');

    while (true) {
        const userQuery = await getUserInput('>> ')
        session.printSilent('\n\n[=== User Query ===]', userQuery);

        const { object: result } = await generateObject({
            model: mistral(llm!),
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