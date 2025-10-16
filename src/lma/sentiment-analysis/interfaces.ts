export type SentimentAnalysisMode = 'single-message' | 'last-message' | 'full-conversation';

export interface SentimentScores {
    polarity: number;      // -1 (negative) to 1 (positive)
    involvement: number;   // -1 (apathetic) to 1 (collaborative)
    energy: number;        // -1 (annoyed) to 1 (enthusiastic)
    temper: number;        // -1 (angry) to 1 (calm)
    mood: number;          // -1 (sad) to 1 (happy)
    empathy: number;       // -1 (cold) to 1 (warm)
    tone: number;          // -1 (concise) to 1 (talkative)
    registry: number;      // -1 (formal) to 1 (informal)
}