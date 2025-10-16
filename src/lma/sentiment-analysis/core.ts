import { SINGLE_USER_MESSAGE_PROMPT, WHOLE_CONVERSATION_PROMPT } from "./prompts";
import { getLLMProvider, LLMConfigProvider } from "../../llm";
import { generateObject, LanguageModel } from "ai";
import z from "zod";
import { LMAInput } from "../interfaces";
import { SentimentScores } from "./interfaces";

const schema = z.object({
    polarity: z.number().min(-1).max(1).describe("Sentiment polarity from -1 (negative) to 1 (positive)"),
    involvement: z.number().min(-1).max(1).describe("Level of involvement from -1 (apathetic) to 1 (collaborative)"),
    energy: z.number().min(-1).max(1).describe("Energy level from -1 (annoyed) to 1 (enthusiastic)"),
    temper: z.number().min(-1).max(1).describe("Temper level from -1 (angry) to 1 (calm)"),
    mood: z.number().min(-1).max(1).describe("Mood level from -1 (sad) to 1 (happy)"),
    empathy: z.number().min(-1).max(1).describe("Empathy level from -1 (cold) to 1 (warm)"),
    tone: z.number().min(-1).max(1).describe("Tone level from -1 (concise) to 1 (talkative)"),
    registry: z.number().min(-1).max(1).describe("Registry level from -1 (formal) to 1 (informal)"),
});

const callLLM = async ({ llmModel, prompt }: {
    llmModel: LanguageModel;
    prompt: string;
}) => {

    const { object: response } = await generateObject({
        model: llmModel,
        prompt,
        temperature: 0,
        seed: 42,
        schema
    });

    return { scores: { ...response } };
}

export const analyzeSentiment = async ({
    input,
    model = 'mistral-small-latest',
    provider = 'mistral',
    parallel = false
}: {
    input: LMAInput,
    model: string,
    provider?: LLMConfigProvider,
    parallel?: boolean
}): Promise<{
    single: SentimentScores,
    cumulative: SentimentScores
}> => {

    const llmProvider = await getLLMProvider(provider);

    const singleAnalysisPrompt = SINGLE_USER_MESSAGE_PROMPT(input.message);
    const cumulativeAnalysisPrompt = WHOLE_CONVERSATION_PROMPT(input.history);

    const singlePromise = callLLM({ llmModel: llmProvider(model), prompt: singleAnalysisPrompt });
    const cumulativePromise = callLLM({ llmModel: llmProvider(model), prompt: cumulativeAnalysisPrompt });

    let single: SentimentScores | null = null;
    let cumulative: SentimentScores | null = null;

    if (parallel) {
        const [singleOutput, cumulativeOutput] = await Promise.all([singlePromise, cumulativePromise]);
        single = singleOutput.scores;
        cumulative = cumulativeOutput.scores;
    }

    else {
        single = (await singlePromise).scores;
        cumulative = (await cumulativePromise).scores;
    }

    return {
        single: single!,
        cumulative: cumulative!
    };
}