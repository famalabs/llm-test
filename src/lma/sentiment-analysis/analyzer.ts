import z from "zod";
import { generateObject } from "ai";
import { sentimentAnalysisPrompt } from "./prompt";
import { getLLMProvider, LLMConfigProvider } from "../../llm";

type SentimentAnalyzer = (args: {
    model: string;
    provider: LLMConfigProvider;
    sentenceOrConversation: string | string[];
}) => Promise<{
    scores: Record<string, number>
}>;

export const analyzeSentiment: SentimentAnalyzer = async ({
    model,
    provider,
    sentenceOrConversation
}) => {

    if (!sentenceOrConversation || !model || !provider) {
        throw new Error("Missing required arguments: sentenceOrConversation, model, provider");
    }

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


    const getResponse = async () => {
        const { object: result } = await generateObject({
            model: (await getLLMProvider(provider))(model),
            prompt: sentimentAnalysisPrompt(sentenceOrConversation),
            temperature: 0,
            seed: 42,
            schema
        });

        return result;
    }

    const response = await getResponse();
    return { scores: { ...response } };
}