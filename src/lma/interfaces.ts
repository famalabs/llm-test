import { SentimentScores } from "./sentiment-analysis";

export type Sender = 'agent' | 'user';

export type ChatStatus = 'open' | 'close' | 'normal' | 'request';

export interface InputTask {
    name: string;
    type: 'number' | 'string' | 'boolean';
    description: string;
}

export interface LMAInput {
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

export interface LMAOutput {
    user_request?: string | null;
    request_satisfied?: boolean | null;
    sentiment: {
        single: SentimentScores;
        cumulative: SentimentScores;
    };
    summary?: { text: string; span: number } | null;
    task?: OutputTask | null;
}