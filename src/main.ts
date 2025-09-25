import { ModelMessage, stepCountIs, streamText, tool } from 'ai';
import { ragChatbotSystemPrompt } from './lib/prompt';
import { getUserInput } from './utils';
import { mistral } from '@ai-sdk/mistral';
import { sleep } from './utils';
import { Rag, RagAnswer } from './rag';
import Redis from 'ioredis';
import z from 'zod';
import { VectorStore, ensureIndex } from './vector-store';
import { Chunk, resolveCitations } from './lib/chunks';

const docStoreRedisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const docStoreIndexName = 'vector_store_index_fixed_size';
const docStoreIndexSchema = [ 'pageContent', 'TEXT', 'source', 'TAG' ]; // metadata non va indicizzato.
const docStore = new VectorStore<Chunk>({
    client: docStoreRedisClient,
    indexName: docStoreIndexName,
    fieldToEmbed: 'pageContent'
});

const cacheStoreRedisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const cacheStoreIndexName = 'cache_store_index';
const cacheStoreIndexSchema: string[] = []; // Non dobbiamo indicicazzare niente
const cacheStore = new VectorStore<RagAnswer>({
    client: cacheStoreRedisClient,
    indexName: cacheStoreIndexName,
});

const rag = new Rag({
    provider: 'mistral',
    llm: 'mistral-medium-latest',
    numResults: 5,
    reasoningEnabled: true,
    includeCitations: false,
    fewShotsEnabled: false,
    verbose: true,
    docStore, 
    semanticCache: {
        cacheStore,
        distanceThreshold: 0.5,
    }
});

const messages: ModelMessage[] = [];

const main = async () => {

    await ensureIndex(docStoreRedisClient, docStoreIndexName, docStoreIndexSchema);
    await ensureIndex(cacheStoreRedisClient, cacheStoreIndexName, cacheStoreIndexSchema);

    await rag.init();
    rag.printSummary();

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
                            const { answer, citations, reasoning, chunks } = await rag.search(
                                `Informazioni sul farmaco ${medicineName}: ${textualQuery}`
                            );
                            out = `Answer: ${answer}\n\n` + 
                            (citations && citations.length > 0 ? 'Citations:\n' + await resolveCitations(citations, chunks) + '\n\n' : '') +
                            (reasoning ? 'Reasoning:\n\n' + reasoning : '');
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