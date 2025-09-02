import { getUserInput, parseCliArgs } from "./lib/cli";
import { VectorStore } from "./lib/vector-store";
import { addLineNumbers, computeTokenNumber } from './lib/nlp';
import { LargeLanguageModels } from "./constants/llms";
import { generateObject } from "ai";
import { mistral } from "@ai-sdk/mistral";
import { corpusInContext } from "./lib/prompt/corpus-in-context";
import z from "zod";

const vectorStore = new VectorStore("vector_store_index");

const main = async () => {
    await vectorStore.load();
    const { llm } = parseCliArgs(['llm']);

    while (true) {
        const userQuery = await getUserInput('Enter your query: ');
        const results = await vectorStore.retrieveFromText(userQuery, 20);
        const textualResults = results.map(el => el.pageContent);

        console.log("Search results length:", textualResults.length);
        console.log("Number of tokens", await computeTokenNumber(textualResults.join('\n'), LargeLanguageModels.Mistral.Small));

        const { object: result } = await generateObject({
            model: mistral(llm!),
            prompt: corpusInContext(
                textualResults.map(addLineNumbers),
                userQuery
            ),
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
        console.log('\n\n[=== Answer ===]');
        console.log(answer);
    }
}

main().catch(console.error).then(_ => process.exit());