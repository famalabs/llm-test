import {
    SINGLE_USER_MESSAGE_PROMPT, WHOLE_CONVERSATION_PROMPT,
    TASK_ANALYSIS_PROMPT, TASK_ANALYSIS_AND_USER_REQUEST_PROMPT,
    REQUEST_SATISFIED_PROMPT, USER_REQUEST_DETECTION_PROMPT,
    LAST_USER_MESSAGE_CONVERSATION_PROMPT,
    CHAT_HISTORY_SUMMARIZATION_PROMPT
} from './prompts';
import z from 'zod';
import { getLLMProvider, LLMConfigProvider } from '../llm';
import { LmaConfig, LmaInput } from './interfaces';
import { resolveConfig } from './lma.config';
import { generateObject } from 'ai';

export class Lma {
    private readonly config: LmaConfig;

    constructor(lmaConfig: Partial<LmaConfig>) {
        this.config = resolveConfig(lmaConfig);
    }

    private async callLLM<T>(params: { model: string, provider: LLMConfigProvider, prompt: string, schema: z.ZodType<T> }) {
        const { model, provider, prompt, schema } = params;
        const llmModel = (await getLLMProvider(provider))(model);
        const { object: response } = await generateObject({ model: llmModel, prompt: prompt, schema: schema });
        return response;
    }

    private stringifyHistory(lmaInput: LmaInput) {
        return (
            lmaInput.summary ?
                `Previous Conversation Summary: ${lmaInput.summary}\n\n` : ''
        ) + lmaInput.history.map(h => `${h.sender.toUpperCase()}: ${h.message}`).join('\n');
    }

    private stringifyTask(task: LmaInput['task']) {
        if (!task) return '';
        return `Name: ${task.name}\nType: ${task.type}\nDescription: ${task.description}\n`;
    }

    private stringifyScoreSet() {
        return `[${this.config.sentimentAnalysisConfig.scoreSet.join(', ')}]`;
    }

    // --------------------------------
    // SENTIMENT ANALYSIS
    // --------------------------------

    private getSentimentScoresSchema() {
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
        return schema;
    }

    public async getSingleMessageSentiment(input: LmaInput) {
        const { provider, model } = this.config.sentimentAnalysisConfig;

        const inputScoreSet = this.stringifyScoreSet();
        const prompt = SINGLE_USER_MESSAGE_PROMPT(input.message, inputScoreSet);
        const schema = this.getSentimentScoresSchema();

        return await this.callLLM({ model, provider, prompt, schema });
    }

    public async getCumulativeSentiment(input: LmaInput) {
        const { provider, model } = this.config.sentimentAnalysisConfig;

        const inputHistory = this.stringifyHistory(input);
        const inputScoreSet = this.stringifyScoreSet();
        const prompt = WHOLE_CONVERSATION_PROMPT(inputHistory, inputScoreSet);
        const schema = this.getSentimentScoresSchema();

        return await this.callLLM({ model, provider, prompt, schema });
    }

    public async getLastMessageSentimentLookingAtHistory(input: LmaInput) {
        const { provider, model } = this.config.sentimentAnalysisConfig;

        const inputHistory = this.stringifyHistory(input);
        const inputScoreSet = this.stringifyScoreSet();
        const prompt = LAST_USER_MESSAGE_CONVERSATION_PROMPT(inputHistory, input.message, inputScoreSet);
        const schema = this.getSentimentScoresSchema();

        return await this.callLLM({ model, provider, prompt, schema });
    }


    // --------------------------------
    // TASK ANALYSIS
    // --------------------------------

    public shouldAnalyzeTask = (input: LmaInput): boolean => !!input.task;

    private getTaskAnalysisSchema() {
        const schema = z.object({
            status: z.enum(['answered', 'ignored', 'negated', 'wait']).describe("Task status"),
            answer: z.union([z.string(), z.number(), z.boolean()]).optional().nullable().describe("Task answer, present only if status is 'answered'"),
            notes: z.string().optional().nullable().describe("Additional notes, present only if status is 'answered'")
        });
        return schema;
    }

    public async analyzeTask(input: LmaInput) {
        if (!input.task) throw new Error("Input task is undefined");

        const { provider, model } = this.config.taskAnalysisConfig;

        const schema = this.getTaskAnalysisSchema();
        const inputHistory = this.stringifyHistory(input);
        const inputTask = this.stringifyTask(input.task);
        const prompt = TASK_ANALYSIS_PROMPT(inputHistory, input.message, inputTask);

        return await this.callLLM({ model, provider, prompt, schema });
    }


    public async analyzeTaskAndDetectUserRequest(input: LmaInput) {
        if (!input.task) throw new Error("Input task is undefined");

        const { provider, model } = this.config.taskAnalysisConfig;

        const schema = z.object({
            task: this.getTaskAnalysisSchema(),
            user_request: z.string().nullable().describe("User request detected in the input"),
            request_satisfied: z.union([z.boolean(), z.null()]).describe("Whether the user request has been satisfied, null if there is no user request")
        });
        const inputHistory = this.stringifyHistory(input);
        const inputTask = this.stringifyTask(input.task);
        const prompt = TASK_ANALYSIS_AND_USER_REQUEST_PROMPT(inputHistory, input.message, inputTask);

        return await this.callLLM({ model, provider, schema, prompt });
    }

    // --------------------------------
    // USER REQUEST DETECTION
    // --------------------------------

    public async detectUserRequest(input: LmaInput, parallel = false) {
        const output: {
            user_request?: string,
            request_satisfied?: boolean
        } = {};

        const { provider, model } = this.config.userRequestDetectionConfig;

        const userRequestSchema = z.object({ user_request: z.string().optional() });
        const requestSatisfiedSchema = z.object({ request_satisfied: z.boolean().optional() });

        const inputHistory = this.stringifyHistory(input);
        const userRequestPrompt = USER_REQUEST_DETECTION_PROMPT(input.message);
        const requestSatisfiedPrompt = REQUEST_SATISFIED_PROMPT(inputHistory, input.message);

        const promises = [];

        promises.push(this.callLLM({ model, provider, prompt: userRequestPrompt, schema: userRequestSchema }));

        if (input.chat_status == 'request') {
            promises.push(this.callLLM({ model, provider, prompt: requestSatisfiedPrompt, schema: requestSatisfiedSchema }));
        }

        if (parallel) {
            const results = await Promise.all(promises) as [
                { user_request?: string },
                { request_satisfied?: boolean }?
            ];
            output.user_request = results[0].user_request;
            if (results[1]) output.request_satisfied = results[1].request_satisfied;
        }

        else {
            const results = [];
            for (const p of promises) {
                results.push(await p as any);
            }
            output.user_request = results[0].user_request;
            if (results[1]) output.request_satisfied = results[1].request_satisfied;
        }

        return output;
    }

    // --------------------------------
    // SUMMARIZATION
    // --------------------------------

    private getInputLengthForSummarization(input: LmaInput) {
        const span = input.summary?.span ?? 0;
        const historyLength = input.history.slice(span).reduce((acc, msg) => acc + msg.message.length, 0);
        const messageLength = input.message.length;
        const summaryLength = input.summary?.text.length ?? 0;
        return historyLength + messageLength + summaryLength;
    };

    private getSpanForSummarization(history: LmaInput["history"], startIndex: number) {
        const { C_MIN } = this.config.summarizationConfig;
        let acc = 0;
        let span = startIndex;
        for (; span < history.length; span++) {
            acc += history[span].message.length;
            if (acc >= C_MIN) break;
        }
        return span + 1;
    };

    public shouldSummarize = (input: LmaInput): boolean => this.getInputLengthForSummarization(input) > this.config.summarizationConfig.C_MAX;

    public async summarizeChatHistory(input: LmaInput) {
        const { provider, model } = this.config.summarizationConfig;

        const startIndex = input.summary?.span ?? 0;
        const span = this.getSpanForSummarization(input.history, startIndex);
        const partialHistory = input.history.slice(startIndex, span);
        const inputPartialHistory = this.stringifyHistory({ history: partialHistory } as LmaInput);
        const prompt = CHAT_HISTORY_SUMMARIZATION_PROMPT(inputPartialHistory, input.summary?.text);
        const schema = z.object({ summary: z.string() });

        const text = (await this.callLLM({ model, provider, prompt, schema })).summary;
        return { text, span };
    };

}