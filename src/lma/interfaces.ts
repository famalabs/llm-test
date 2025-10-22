import { LLMConfig } from "../rag";

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

export type Sender = 'agent' | 'user';

export type ChatStatus = 'open' | 'close' | 'normal' | 'request';

export interface InputTask {
    name: string;
    type: 'number' | 'string' | 'boolean';
    description: string;
}

export interface LmaInput {
    message: string;
    chat_status: ChatStatus;
    history: Array<{ sender: Sender; message: string }>;
    summary?: { text: string; span: number } | null;
    task?: InputTask;
}

export interface OutputTask {
    status: 'answered' | 'ignored' | 'negated' | 'wait';
    answer?: string | number | boolean | null;
    notes?: string | null;
};

export interface LmaOutput {
    user_request?: string | null;
    request_satisfied?: boolean | null;
    sentiment: {
        single: SentimentScores;
        cumulative: SentimentScores;
    };
    summary?: { text: string; span: number } | null;
    task?: OutputTask | null;
}

export interface LmaConfig {
    baseConfig: LLMConfig,
    sentimentAnalysisConfig: LLMConfig & {
        scoreSet: number[];
    },
    taskAnalysisConfig: LLMConfig,
    userRequestDetectionConfig: LLMConfig,
    summarizationConfig: LLMConfig & {
        C_MIN: number;
        C_MAX: number;
    },
};