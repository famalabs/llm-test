import z from "zod";
import { sleep } from "../../../utils";
import { generateObject } from "ai";
import { llmAsAJudgePrompt } from "./prompt";
import { getLLMProvider, LLMConfigProvider } from "../../../llm";

const execute = async ({
    prediction,
    keyRef,
    fullRef,
    query,
    model, 
    provider
}: {
    prediction: string,
    keyRef: string,
    fullRef: string,
    query?: string,
    model?: string,
    provider?: LLMConfigProvider
}) => {

    if (!query || !model || !provider) {
        throw new Error("Missing required arguments: query, model, provider");
    }

    const schema = z.object({
        score: z.number().min(0).max(1),
        explanation: z.string()
    });

    const prompt = llmAsAJudgePrompt(query, keyRef, fullRef, prediction);
    const getResponse = async () => {
        const { object: result } = await generateObject({
            model: (await getLLMProvider(provider))(model),
            prompt,
            temperature: 0,
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

export const customLLMAsAJudge = {
    name: 'llm-as-a-judge',
    execute,
}