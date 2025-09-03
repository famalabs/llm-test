import { generateObject } from "ai";
import { Chunk, PromptDocument } from "../types";
import { rerankingPrompt } from "./prompt/reranking";
import { LargeLanguageModels } from "../constants/llms";
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
): Promise<Chunk[]> => {
    const groupedChunks: Chunk[][] = [];
    for (let i = 0; i < retrievedChunks.length; i += batchSize) {
        groupedChunks.push(retrievedChunks.slice(i, i + batchSize));
    }

    for (const group of groupedChunks) {
        const promptDocuments: PromptDocument[] = group.map(c => ({ content: c.pageContent, source: c.metadata.source }));
        const prompt = rerankingPrompt(promptDocuments, userQuery, reasoning, fewShots);

        const rankingObjectSchema= z.object({
            index: z.number(),
            score: z.number().min(0).max(1)
        });

        if (reasoning) {
            rankingObjectSchema.extend({
                reasoning: z.string().optional()
            });
        }   

        const { object: result } = await generateObject({
            model: mistral(llm),
            prompt,
            schema: z.object({
                rankings: z.array(
                    rankingObjectSchema      
                ),
            })
        });

        const { rankings } = result;

        for (const { index, score } of rankings) {
            // Since we're scoring distance, we invert the score (1 - score)
            group[index].distance = (1 - llmEvaluationWeight) * group[index].distance + llmEvaluationWeight * (1 - score);
        }
    }
    return [...groupedChunks.flat()].sort((a, b) => a.distance - b.distance);
}