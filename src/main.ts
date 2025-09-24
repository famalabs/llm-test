import { getRagAgentToolFunction, ragAnswerToString } from './rag/rag-tool';
import { ModelMessage, stepCountIs, streamText, tool } from 'ai';
import { ragChatbotSystemPrompt } from './lib/prompt';
import { getUserInput } from './utils';
import { mistral } from '@ai-sdk/mistral';
import { sleep } from './utils';
import { Rag } from './rag';
import Redis from 'ioredis';
import z from 'zod';
import { VectorStore } from './vector-store';
import { ensureIndex } from './lib/redis-index';
import { Chunk } from './lib/chunks';

const docStoreRedisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const INDEX_NAME = 'vector_store_index_fixed_size';
const INDEX_SCHEMA = [
    'pageContent', 'TEXT',
    'source', 'TAG',
    'metadata', 'TEXT',
];

const docStore = new VectorStore<Chunk>({
    client: docStoreRedisClient,
    indexName: INDEX_NAME,
    fieldToEmbed: 'pageContent'
});

const rag = new Rag({
    provider: 'mistral',
    llm: 'mistral-medium-latest',
    numResults: 5,
    reasoningEnabled: true,
    chunksOrAnswerFormat: 'answer',
    includeCitations: false,
    fewShotsEnabled: false,
    verbose: true
}, docStore);

const messages: ModelMessage[] = [];

const main = async () => {

    await ensureIndex(docStoreRedisClient, INDEX_NAME, INDEX_SCHEMA);
    await rag.init();
    rag.printSummary();
    const ragAgentToolFunction = getRagAgentToolFunction(rag);

    while (true) {
        const userQuery = await getUserInput('>> ');
        messages.push({ role: 'user', content: userQuery });

        const start = performance.now();

        const result = streamText({
            model: mistral(rag.getConfig().llm!),
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
                        let out = 'No answer could be found.';
                        try {
                            const ragAgentToolFunctionOutput = await ragAgentToolFunction(`Informazioni sul farmaco ${medicineName}: ${textualQuery}`);
                            console.log(ragAgentToolFunctionOutput);
                            out = await ragAnswerToString(
                                ragAgentToolFunctionOutput,
                                rag
                            );
                        }
                        catch (error) {
                            console.error('Error during RAG processing:', error);
                        }
                        return out;
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

        const elapsed = performance.now() - start;
        console.log(`\n\n=== Response completed in ${(elapsed / 1000).toFixed(2)} seconds.\n\n===`);

        messages.push({ role: 'assistant', content: fullResponse });

        await sleep(2);
    }
}

main().catch(console.error).then(() => process.exit());