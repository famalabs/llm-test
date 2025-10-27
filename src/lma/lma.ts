import {
    SINGLE_USER_MESSAGE_PROMPT, WHOLE_CONVERSATION_PROMPT,
    TASK_ANALYSIS_PROMPT,
    USER_REQUEST_SATISFIED_PROMPT, USER_REQUEST_DETECTION_PROMPT, USER_REQUEST_AND_TOOLS_DETECTION_PROMPT,
    LAST_USER_MESSAGE_CONVERSATION_PROMPT,
    CHAT_HISTORY_SUMMARIZATION_PROMPT
} from './prompts';
import {
    SENTIMENT_ANALYSIS_SCHEMA,
    SUMMARIZATION_SCHEMA,
    USER_REQUEST_AND_TOOLS_DETECTION_SCHEMA,
    USER_REQUEST_DETECTION_SCHEMA,
    USER_SATISFACTION_DETECTION_SCHEMA,
    TASK_ANALYSIS_SCHEMA
} from './schemas';
import { getLLMProvider, LLMConfigProvider } from '../llm';
import { LmaConfig, LmaInput, LmaOutput, SentimentScores, Tool } from './interfaces';
import { resolveConfig } from './lma.config';
import { generateObject } from 'ai';
import z from 'zod';

export class Lma {
    private readonly config: LmaConfig;

    constructor(lmaConfig: Partial<LmaConfig>) {
        this.config = resolveConfig(lmaConfig);
    }

    private async callLLM<Schema extends z.ZodTypeAny>(params: { model: string, provider: LLMConfigProvider, prompt: string, schema: Schema }): Promise<z.infer<Schema>> {
        const { model, provider, prompt, schema } = params;
        const llmModel = (await getLLMProvider(provider))(model);
        const { object: response } = await generateObject({ model: llmModel, prompt: prompt, schema: schema });
        return response as z.infer<Schema>;
    }

    private stringifyHistory(lmaInput: LmaInput, summarizationSpan: number | null = null) {
        const startIndex = lmaInput.summary?.span ?? 0;
        const span: number = summarizationSpan ? summarizationSpan : lmaInput.history.length;
        const partialHistory = lmaInput.history.slice(startIndex, span);
        return (
            lmaInput.summary ?
                `Previous Conversation Summary: ${lmaInput.summary.text}\n\n` : ''
        ) + partialHistory.map(h => `${h.sender.toUpperCase()}: ${h.message}`).join('\n');
    }

    private stringifyTools(tools: Tool[], includeToolsParams: boolean) {
        const toStringify = includeToolsParams
            ? tools
            : tools.map(tool => ({
                name: tool.name,
                description: tool.description
            }));
        return JSON.stringify(toStringify, null, 2);
    }

    private stringifyTask(task: LmaInput['task']) {
        if (!task) return '';
        return `Name: ${task.name}\nType: ${task.type}\nDescription: ${task.description}\n`;
    }

    private stringifyScoreSet() {
        return `[${this.config.sentimentAnalysisConfig.scoreSet.join(', ')}]`;
    }

    public async mainCall(input: LmaInput): Promise<LmaOutput> {

        const output: LmaOutput = {
            user_request: null,
            request_satisfied: null,
            sentiment: {
                single: {} as SentimentScores,
                cumulative: {} as SentimentScores
            },
            summary: null,
            task: null,
            useful_tools: null
        };

        const summarizationPromise = this.summarizeChatHistory(input);
        const sentimentSinglePromise = this.getSingleMessageSentiment(input);
        const sentimentCumulativePromise = this.getCumulativeSentiment(input);
        const requestPromise = this.detectUserRequest(input);
        const taskPromise = this.analyzeTask(input);

        if (this.config.baseConfig.parallel) {
            const [
                summaryResult,
                sentimentSingleResult,
                sentimentCumulativeResult,
                requestResult,
                taskResult
            ] = await Promise.all([summarizationPromise, sentimentSinglePromise, sentimentCumulativePromise, requestPromise, taskPromise]);
            output.summary = summaryResult;
            output.sentiment.single = sentimentSingleResult;
            output.sentiment.cumulative = sentimentCumulativeResult;
            output.user_request = requestResult.user_request;
            output.request_satisfied = requestResult.request_satisfied;
            output.useful_tools = requestResult.useful_tools;
            output.task = taskResult;
        }

        else {
            output.summary = await summarizationPromise;
            output.sentiment.single = await sentimentSinglePromise;
            output.sentiment.cumulative = await sentimentCumulativePromise;
            const userReq = await requestPromise;
            output.user_request = userReq.user_request;
            output.request_satisfied = userReq.request_satisfied;
            output.useful_tools = userReq.useful_tools; // [TODO] : CHIEDERE
            output.task = await taskPromise;
        }

        return output;
    }


    // --------------------------------
    // SENTIMENT ANALYSIS
    // --------------------------------



    public async getSingleMessageSentiment(input: LmaInput) {
        const { provider, model } = this.config.sentimentAnalysisConfig;

        const inputScoreSet = this.stringifyScoreSet();
        const prompt = SINGLE_USER_MESSAGE_PROMPT(input.message, inputScoreSet);
        const schema = SENTIMENT_ANALYSIS_SCHEMA();

        return await this.callLLM({ model, provider, prompt, schema });
    }

    public async getCumulativeSentiment(input: LmaInput) {
        const { provider, model } = this.config.sentimentAnalysisConfig;

        const inputHistory = this.stringifyHistory(input);
        const inputScoreSet = this.stringifyScoreSet();
        const prompt = WHOLE_CONVERSATION_PROMPT(inputHistory, inputScoreSet);
        const schema = SENTIMENT_ANALYSIS_SCHEMA();

        return await this.callLLM({ model, provider, prompt, schema });
    }

    public async getLastMessageSentimentLookingAtHistory(input: LmaInput) {
        const { provider, model } = this.config.sentimentAnalysisConfig;

        const inputHistory = this.stringifyHistory(input);
        const inputScoreSet = this.stringifyScoreSet();
        const prompt = LAST_USER_MESSAGE_CONVERSATION_PROMPT(inputHistory, input.message, inputScoreSet);
        const schema = SENTIMENT_ANALYSIS_SCHEMA();

        return await this.callLLM({ model, provider, prompt, schema });
    }


    // --------------------------------
    // TASK ANALYSIS
    // --------------------------------

    public shouldAnalyzeTask(input: LmaInput) {
        return input.task != undefined;
    }

    public async analyzeTask(input: LmaInput) {
        if (!this.shouldAnalyzeTask(input)) {
            console.error("Input task is undefined");
            return;
        }


        const { provider, model } = this.config.taskAnalysisConfig;

        const schema = TASK_ANALYSIS_SCHEMA(input.task!.type);
        const inputHistory = this.stringifyHistory(input);
        const inputTask = this.stringifyTask(input.task);
        const prompt = TASK_ANALYSIS_PROMPT(inputHistory, input.message, inputTask);

        return await this.callLLM({ model, provider, prompt, schema });
    }

    // --------------------------------
    // USER REQUEST DETECTION
    // --------------------------------

    public async detectUserRequest(input: LmaInput) {
        const { requestDetection, satisfactionDetection } = this.config.userRequestConfig;
        const { model: requestDetectionModel, mode: requestDetectionMode, provider: requestDetectionProvider, tools } = requestDetection;
        const { model: satisfactionDetectionModel, provider: satisfactionDetectionProvider } = satisfactionDetection;

        if (requestDetectionMode == 'simple' && tools && tools.length > 0) {
            console.warn("Tools provided in configuration will be ignored in 'simple' detection mode.");
        }

        const inputHistory = this.stringifyHistory(input);

        if (requestDetectionMode == 'simple') {
            const requestDetectionSchema = USER_REQUEST_DETECTION_SCHEMA();
            const satisfactionDetectionSchema = USER_SATISFACTION_DETECTION_SCHEMA();

            const userRequestPrompt = USER_REQUEST_DETECTION_PROMPT(inputHistory, input.message);
            const requestSatisfiedPrompt = USER_REQUEST_SATISFIED_PROMPT(inputHistory, input.message);

            const promises = [];

            promises.push(this.callLLM({
                model: requestDetectionModel, provider: requestDetectionProvider,
                prompt: userRequestPrompt, schema: requestDetectionSchema
            }));
            promises.push(this.callLLM({
                model: satisfactionDetectionModel, provider: satisfactionDetectionProvider,
                prompt: requestSatisfiedPrompt, schema: satisfactionDetectionSchema
            }));

            if (this.config.baseConfig.parallel) {
                const results = await Promise.all(promises) as [
                    { user_request?: string },
                    { request_satisfied?: boolean }
                ];

                return {
                    user_request: results[0].user_request,
                    request_satisfied: results[1].request_satisfied,
                    useful_tools: undefined
                }
            }

            else {
                const results = [];
                for (const p of promises) {
                    results.push(await p as any);
                }

                return {
                    user_request: results[0].user_request,
                    request_satisfied: results[1].request_satisfied,
                    useful_tools: undefined
                }
            }
        }

        else {
            if (!tools || tools.length == 0) throw new Error("Tools must be provided in configuration for 'tools' or 'tools-params' detection mode.");

            const includeToolsParams = requestDetectionMode == 'tools-params';
            const userRequestAndToolsSchema = USER_REQUEST_AND_TOOLS_DETECTION_SCHEMA(includeToolsParams);
            const userRequestAndToolsPrompt = USER_REQUEST_AND_TOOLS_DETECTION_PROMPT(inputHistory, input.message, includeToolsParams, this.stringifyTools(tools, includeToolsParams));

            const { user_request, useful_tools } = await this.callLLM({
                model: requestDetectionModel,
                provider: requestDetectionProvider,
                prompt: userRequestAndToolsPrompt,
                schema: userRequestAndToolsSchema
            });

            return {
                user_request: user_request,
                request_satisfied: undefined, // [TODO] CHIEDERE
                useful_tools
            }
        }
    }

    // --------------------------------
    // SUMMARIZATION
    // --------------------------------

    private getInputLengthForSummarization(input: LmaInput) {
        const span = input.summary?.span ?? 0;
        const historyLength = input.history.slice(span).reduce((acc, msg) => acc + msg.message.length, 0);
        const messageLength = input.message.length;
        return historyLength + messageLength;
    };

    private getSpanForSummarization(history: LmaInput["history"], startIndex: number) {
        const { C_MIN } = this.config.summarizationConfig;
        let chars = 0;
        let i = startIndex;

        for (; i < history.length; i++) {
            chars += history[i].message.length;
            if (chars >= C_MIN) break;
        }

        if (i >= history.length) return history.length;
        return i + 1;
    }

    public shouldSummarize(input: LmaInput) {
        return this.getInputLengthForSummarization(input) <= this.config.summarizationConfig.C_MAX;
    }

    public async summarizeChatHistory(input: LmaInput) {
        if (!this.shouldSummarize(input)) {
            return;
        }
        const { provider, model } = this.config.summarizationConfig;
        const startIndex = input.summary?.span ?? 0;
        const endIndex = this.getSpanForSummarization(input.history, startIndex);
        const historyChunkText = input.history.slice(startIndex, Math.min(endIndex, input.history.length)).map(h => `${h.sender.toUpperCase()}: ${h.message}`).join('\n');
        const prompt = CHAT_HISTORY_SUMMARIZATION_PROMPT(historyChunkText, input.summary?.text ?? "");
        const schema = SUMMARIZATION_SCHEMA();

        const { summary: text } = await this.callLLM({ model, provider, prompt, schema });

        return { text, span: Math.min(endIndex, input.history.length) };
    }
}