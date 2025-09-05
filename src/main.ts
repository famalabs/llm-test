import { ModelMessage, stepCountIs, streamText, tool } from 'ai';
import { getUserInput } from './lib/cli';
import { Rag } from './rag';
import { mistral } from '@ai-sdk/mistral';
import { allPrompts } from './lib/prompt';
import { dummyTools } from './lib/utils';

const rag = new Rag({
    vectorStoreName: 'vector_store_index_agentic',
    llm: 'mistral-medium-latest',
    numResults: 3,
});

const messages: ModelMessage[] = [];

const main = async () => {
    await rag.init();

    rag.printSummary();

    while (true) {
        const userQuery = await getUserInput('>> ');
        messages.push({ role: 'user', content: userQuery });

        const result = streamText({
            model: mistral(rag.getLLM()),
            messages,
            system: allPrompts.ragChatbotSystemPrompt,
            tools: {
                getInformation: rag.getAgentTool(),
                // ...dummyTools
            },
            stopWhen: stepCountIs(5),
            onStepFinish: async ({ toolResults }) => {
                console.log('Tool calls:', toolResults.map(el => el.toolName).join(', '));
            }
        });

        let fullResponse = '';
        process.stdout.write('\nAssistant: ');
        for await (const delta of result.textStream) {
            fullResponse += delta;
            process.stdout.write(delta);
        }
        process.stdout.write('\n\n');

        messages.push({ role: 'assistant', content: fullResponse });
    }
}

main().catch(console.error).then(() => process.exit());