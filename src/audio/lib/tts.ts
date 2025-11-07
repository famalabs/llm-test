import { experimental_generateSpeech, Experimental_SpeechResult } from "ai";
import { openai } from "@ai-sdk/openai";

export async function generateVoice(input: string, voice = 'sage', guidelines?: string): Promise<Experimental_SpeechResult> {
    const result = await experimental_generateSpeech({
        model: openai.speech("gpt-4o-mini-tts"),
        text: input,
        voice,
        outputFormat: "mp3",
        instructions: guidelines,
    });
    return result;
}
