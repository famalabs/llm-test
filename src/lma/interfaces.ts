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
    summary?: { text: string; span: number };
    task?: InputTask;
}

export interface OutputTask {
    status: 'answered' | 'ignored' | 'negated' | 'wait';
    answer?: string | number | boolean;
    notes?: string;
};

export interface LMAOutput {
    user_request?: string;
    request_satisfied?: boolean;
    sentiment: {
        single: SentimentScores;
        cumulative: SentimentScores;
    };
    summary?: { text: string; span: number };
    task?: OutputTask;
}