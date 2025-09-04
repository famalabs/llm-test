import { generateObject } from "ai";
import { Chunk, PromptDocument } from "../types";
import { rerankingPrompt } from "./prompt/reranking";
import { mistral } from "@ai-sdk/mistral";
import z from "zod";

export const rerankRetrievedChunks = async (
    retrievedChunks: Chunk[],
    userQuery: string,
    llm: string,
    reasoning: boolean = false,
    fewShots: boolean = false,
    llmEvaluationWeight: number = 0.7,
    batchSize: number = 5
): Promise<(Chunk & { reasoning?: string })[]> => {
    const groupedChunks: Chunk[][] = [];
    for (let i = 0; i < retrievedChunks.length; i += batchSize) {
        groupedChunks.push(retrievedChunks.slice(i, i + batchSize));
    }

    for (const group of groupedChunks) {
        const promptDocuments: PromptDocument[] = group.map(c => ({ content: c.pageContent, source: c.metadata.source }));
        const prompt = rerankingPrompt(promptDocuments, userQuery, reasoning, fewShots);


        const rankingSchema: Record<string, z.ZodTypeAny> = {
            index: z.number(),
            score: z.number().min(0).max(1)
        } 

        if (reasoning) {
            rankingSchema.reasoning = z.string();
        }

        const { object: result } = await generateObject({
            model: mistral(llm),
            prompt,
            schema: z.object({
                rankings: z.array(
                    z.object(rankingSchema)      
                ),
            })
        });

        const { rankings } = result;

        for (const ranking of rankings as ({ index: number, score: number, reasoning?: string})[]) {
            const { index, score } = ranking;
            // Since we're scoring distance, we invert the score (1 - score)
            group[index].distance = (1 - llmEvaluationWeight) * group[index].distance + llmEvaluationWeight * (1 - score);

            if (reasoning) {
                console.log('Ill add reasoning ->', ranking.reasoning);
            }
        }
    }

    const rerankedResults = [...groupedChunks.flat()].sort((a, b) => a.distance - b.distance);

    return rerankedResults;
}