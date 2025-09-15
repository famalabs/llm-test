import { ModelMessage, stepCountIs, streamText, tool } from 'ai';
import { getUserInput } from './lib/cli';
import { Rag } from './rag';
import { mistral } from '@ai-sdk/mistral';
import { sleep } from './lib/utils';
import { startChronometer, stopChronometer } from './lib/chronometer';
import z from 'zod';
import { getRagAgentToolFunction, ragAnswerToString } from './rag/rag-tool';
import { ragChatbotSystemPrompt } from './lib/prompt';

const rag = new Rag({
    vectorStoreName: 'vector_store_index_fixed_size',
    llm: 'mistral-medium-latest',
    numResults: 5,
    output: {
        reasoningEnabled: true,
        chunksOrAnswerFormat: 'answer',
        includeCitations: false,
        fewShotsEnabled: false,
    },
    parentPageRetrieval : {
        enabled: true,
        offset: 2,
    },
    chunkFiltering: {
        enabled: true,
        thresholdMultiplier: 0.5,
    },
    reranking: {
        enabled: true,
        llm: 'mistral-medium-latest',
        chunkFiltering:  {
            enabled: true,
            thresholdMultiplier: 0.5,
        },
        reasoningEnabled : true, 
        fewShotsEnabled: true,
    },
    verbose: true
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
            temperature: 0,
            system: ragChatbotSystemPrompt,
            tools: {
                getInformation: tool({
                    description: "This tool searches for information in drug package inserts. It accepts the medicine name and a textual query as input. It returns a response based on the content of the leaflet in clear language, optionally citing the section or page of reference.",
                    inputSchema: z.object({
                        medicineName: z.string().describe('the name of the medicine, e.g., Aspirina'),
                        textualQuery: z.string().describe('the information to search for, e.g., What are the side effects?'),
                    }),
                    execute: async ({ medicineName, textualQuery }) => {
                        return await ragAnswerToString(
                            await ragAgentToolFunction(`Informazioni sul farmaco ${medicineName}: ${textualQuery}`),
                            rag
                        );
                    },
                }),
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

        await sleep(2);
    }
}

main().catch(console.error).then(() => process.exit());