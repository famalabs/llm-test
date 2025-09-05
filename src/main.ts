import { ModelMessage, stepCountIs, streamText, tool } from 'ai';
import { getUserInput } from './lib/cli';
import { Rag } from './rag';
import { mistral } from '@ai-sdk/mistral';
import { allPrompts } from './lib/prompt';
import { dummyTools } from './lib/utils';
import { startChronometer, stopChronometer } from './lib/chonometer';
import z from 'zod';
import { getRagAgentToolFunction } from './rag/rag-tool';

const rag = new Rag({
    vectorStoreName: 'vector_store_index_agentic',
    llm: 'mistral-small-latest',
    numResults: 3,
    output: {
        chunksOrAnswerFormat: 'answer',
        reasoningEnabled: true,
        includeCitations: true,
        fewShotsEnabled: true,
    }
});

const messages: ModelMessage[] = [];

const main = async () => {
    await rag.init();
    rag.printSummary();
    const ragAgentToolFunction = getRagAgentToolFunction(rag);

    while (true) {
        const userQuery = await getUserInput('>> ');
        messages.push({ role: 'user', content: userQuery });

        startChronometer();


        const result = streamText({
            model: mistral(rag.getConfig().llm),
            messages,
            system: allPrompts.ragChatbotSystemPrompt,
            tools: {
                getInformation: tool({
                    description: `Get informations from your knowledge base to answer questions.`,
                    inputSchema: z.object({
                        question: z.string().describe('the users question'),
                    }),
                    execute: async ({ question }) => await ragAgentToolFunction(question),
                }),
                // ...dummyTools
            },
            stopWhen: stepCountIs(5),
            onStepFinish: async ({ toolResults }) => {
                if (toolResults.length === 0) return;
                console.log('\n\t[TOOL CALLS:', toolResults.map(el => el.toolName + '(' + JSON.stringify(el.input) + ')').join(', '), ']\n');
            }
        });

        let fullResponse = '';
        process.stdout.write('\nAssistant: ');
        for await (const delta of result.textStream) {
            fullResponse += delta;
            process.stdout.write(delta);
        }
        process.stdout.write('\n\n');

        const elapsed = stopChronometer();
        console.log(`\n\n=== Response completed in ${(elapsed / 1000).toFixed(2)} seconds.\n\n===`);

        messages.push({ role: 'assistant', content: fullResponse });
    }
}

main().catch(console.error).then(() => process.exit());