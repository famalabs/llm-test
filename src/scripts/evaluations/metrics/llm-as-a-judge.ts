import z from "zod";
import { Metric } from "./interfaces";
import { sleep } from "langchain/util/time";
import { generateObject } from "ai";
import { mistral } from "@ai-sdk/mistral";
import { llmAsAJudgePrompt } from "../../../lib/prompt"

const execute = async ({
    prediction,
    reference,
    query,
    llm
}: {
    prediction: string,
    reference: string,
    query?: string,
    llm?: string
}) => {

    if (!query || !llm) {
        throw new Error("Missing required arguments: query, llm");
    }

    const schema = z.object({
        score: z.number().min(0).max(1),
        explanation: z.string()
    });

    const prompt = llmAsAJudgePrompt(query, /*expectedAnswer*/ reference, /*givenAnswer*/ prediction);
    const getResponse = async () => {
        const { object: result } = await generateObject({
            model: mistral(llm),
            prompt,
            temperature:0,
            seed: 42,
            schema
        });

        return result.score;
    }

    let score = 0;

    try {
        score = await getResponse();
    } catch (error) {
        await sleep(10);
        score = await getResponse();
    }

    return { score };
}

export const customLLMAsAJudge: Metric = {
    name: 'llm-as-a-judge',
    execute,
}