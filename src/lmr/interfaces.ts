import { Tool as AiSdkTool } from "ai";
import { LLMConfig } from "../llm";

export interface LmrConfig {
    baseConfig: LLMConfig;
};

export interface TaskDue {
    name: string;
    description: string;
    ignored?: boolean;
    waited?: boolean;
}

export interface LmrInput {
    task_due?: TaskDue | null;
    
    chat_status: 'open' | 'close' | 'normal' | 'request';
    
    user_request?: string;
    
    style: string;

    user_info?: {
        name?: string;
        surname?: string;
        gender?: 'M' | 'F';
        language?: string;
    };

    history: {
        sender: 'agent' | 'user';
        message: string;
    }[];

    summary?: {
        text: string;
        span: number;
    };

    tools?: Record<string, AiSdkTool>;
}

export interface LmrOutput {
    agent_message: string;
}
