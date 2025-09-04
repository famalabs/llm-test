import { CliSessionRecording, getUserInput, parseCliArgs } from "./lib/cli";
import { VectorStore } from "./lib/vector-store";
import { addLineNumbers, computeTokenNumber } from './lib/nlp';
import { LargeLanguageModels } from "./constants/llms";
import { generateObject } from "ai";
import { mistral } from "@ai-sdk/mistral";
import { corpusInContext } from "./lib/prompt/corpus-in-context";
import { resolveCitations } from "./lib/citations";
import z from "zod";
import { Chunk, PromptDocument, RAGSystemConfig } from "./types";
import { ChunkingStrategy, RagMode } from "./constants/rag";
import { getParentPageAugmentedChunks } from "./lib/parent-retrieval";
import { rerankRetrievedChunks } from "./lib/reranking";

const main = async () => {

    const { llm, chunking } = parseCliArgs(['llm', 'chunking']);

    const vectorStore = new VectorStore(`vector_store_index_${chunking}`);
    await vectorStore.load();

    const CONFIG: RAGSystemConfig = {
        parentPageRetrieval: false,
        parentPageRetrievalOffset: 5, // number of lines before and after the chunk
        reranking: false,
        reasoning: false,
        fewShots: true,
        llm: llm!,
        ragMode: RagMode.RetrievalBased,
        chunkingStrategy: chunking! as ChunkingStrategy, // this of course it's just for recording. Chunking is done offline.
    }

    const session = new CliSessionRecording(CONFIG);

    while (true) {
        const userQuery = await getUserInput('>> ');
        session.print(`\n\n[=== User Query: ${userQuery} ===]\n`);
        let chunks: Chunk[] = await vectorStore.retrieveFromText(userQuery, 5);

        if (CONFIG.reranking) {
            const time = Date.now();
            session.print('Before reranking:', chunks.map(c => c.pageContent.substring(0, 30) + ' -> ' + c.distance));  
            chunks = await rerankRetrievedChunks(chunks, userQuery, llm!, CONFIG.reasoning, CONFIG.fewShots);
            session.print('After reranking:', (chunks).map(c => c.pageContent.substring(0, 30) + ' -> ' + c.distance));
            session.print(`Reranking took ${Date.now() - time} ms`);
        }

        const textualChunks: string[] = chunks.map(c => c.pageContent);

        let promptReadyChunks: PromptDocument[];

        if (CONFIG.parentPageRetrieval) {
            promptReadyChunks = await getParentPageAugmentedChunks(chunks, CONFIG.parentPageRetrievalOffset!);
        }
        else {
            promptReadyChunks = chunks.map(c => ({
                content: c.pageContent,
                source: c.metadata.source
            }))
        }

        session.print("Search results length:", textualChunks.length);
        session.print("Number of tokens", await computeTokenNumber(
            textualChunks.join('\n'),
            LargeLanguageModels.Mistral.Small
        ));

        const { object: result } = await generateObject({
            model: mistral(llm!),
            prompt: corpusInContext(
                promptReadyChunks.map((document) => ({
                    ...document,
                    content: addLineNumbers(document.content)
                })),
                userQuery,  
                CONFIG.fewShots,
            ),
            schema: z.object({
                answer: z.string(),
                citations: z.array(
                    z.object({
                        chunkIndex: z.number(),
                        startLine: z.number(),
                        endLine: z.number()
                    })
                )
            })
        });

        const { answer, citations } = result;

        session.print('\n\n[=== Answer ===]\n');
        session.print(answer);
        session.print(await resolveCitations(citations, chunks));
        session.print('\n\n');
    }
}

main().catch(console.error).then(_ => process.exit());