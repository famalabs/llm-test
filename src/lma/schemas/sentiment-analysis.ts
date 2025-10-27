import z from "zod";

export const SENTIMENT_ANALYSIS_SCHEMA = () => {
    return z.object({
        polarity: z.number().min(-1).max(1).describe("Sentiment polarity from -1 (negative) to 1 (positive)"),
        involvement: z.number().min(-1).max(1).describe("Level of involvement from -1 (apathetic) to 1 (collaborative)"),
        energy: z.number().min(-1).max(1).describe("Energy level from -1 (annoyed) to 1 (enthusiastic)"),
        temper: z.number().min(-1).max(1).describe("Temper level from -1 (angry) to 1 (calm)"),
        mood: z.number().min(-1).max(1).describe("Mood level from -1 (sad) to 1 (happy)"),
        empathy: z.number().min(-1).max(1).describe("Empathy level from -1 (cold) to 1 (warm)"),
        tone: z.number().min(-1).max(1).describe("Tone level from -1 (concise) to 1 (talkative)"),
        registry: z.number().min(-1).max(1).describe("Registry level from -1 (formal) to 1 (informal)"),
    });
}