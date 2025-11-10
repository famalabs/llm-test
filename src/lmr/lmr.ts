import { OPENER_PROMPT, CLOSER_PROMPT, FIRST_TIME_TASK_REQUEST_PROMPT, PRECEDENTLY_IGNORED_TASK_REQUEST_PROMPT, WAITED_TASK_REQUEST_PROMPT, ANSWER_USER_REQUEST_PROMPT, LMR_SYSTEM_PROMPT } from "./prompts";
import { LmrConfig, LmrInput, LmrOutput } from "./interfaces";
import { getLLMProvider, LLMConfigProvider } from "../llm";
import { generateObject, generateText, stepCountIs } from "ai";
import { lmrToolbox } from "./lmr.tools";
import { resolveConfig } from "./lmr.config";
import { z } from "zod/v4";

export class Lmr {
    private config: LmrConfig;

    constructor(config: Partial<LmrConfig>) {
        this.config = resolveConfig(config);
    }

    private stringifyHistory(lmrInput: LmrInput, summarizationSpan: number | null = null) {
        const startIndex = lmrInput.summary?.span ?? 0;
        const span: number = summarizationSpan ? summarizationSpan : lmrInput.history.length;
        const partialHistory = lmrInput.history.slice(startIndex, span);
        return (
            lmrInput.summary ?
                `Previous Conversation Summary: ${lmrInput.summary.text}\n\n` : ''
        ) + partialHistory.map(h => `${h.sender.toUpperCase()}: ${h.message}`).join('\n');
    }

    private stringifyTask(task: LmrInput['task_due']) {
        if (!task) return '';
        return `Task Name: ${task.name}\nTask Description: ${task.description}`;
    }

    private stringifyUserInfo(userInfo: LmrInput['user_info'] | undefined) {
        if (!userInfo) return 'No user information available.';
        const parts: string[] = [];
        if (userInfo.name) parts.push(`Name: ${userInfo.name}`);
        if (userInfo.surname) parts.push(`Surname: ${userInfo.surname}`);
        if (userInfo.gender) parts.push(`Gender: ${userInfo.gender == 'M' ? 'Male' : 'Female'}`);
        if (userInfo.language) parts.push(`Preferred Language: ${userInfo.language}`);
        return parts.join('\n');
    }

    private getSchema() {
        return z.object({
            agent_message: z.string().min(0),
        });
    }

    private async callLLM<Schema extends z.ZodTypeAny>(params: { model: string, provider: LLMConfigProvider, prompt: string, schema: Schema, style: string }): Promise<z.infer<Schema>> {
        const { model, provider, prompt, schema, style } = params;
        const llmModel = (await getLLMProvider(provider))(model);
        const { object: response } = await generateObject({
            system: LMR_SYSTEM_PROMPT(style),
            model: llmModel, prompt: prompt, schema: schema,
        });
        return response as z.infer<Schema>;
    }

    public async mainCall(input: LmrInput): Promise<LmrOutput> {

        const model = this.config.baseConfig.model;
        const provider = this.config.baseConfig.provider;
        const llmModel = (await getLLMProvider(provider))(model);

        if (input.user_request) {

            if (input.chat_status != 'request') {
                console.warn('LMR input has user_request but chat_status is not "request". Proceeding anyway.');
            }

            const userInfo = this.stringifyUserInfo(input.user_info);
            const history = this.stringifyHistory(input);

            // Prefer caller-provided tools (filtered), fallback to the default toolbox
            const tools = input.tools ?? lmrToolbox;

            const metadata = { tool_calls: [] as Array<{ toolName: string, input: any, output: any }> };
            const { text } = await generateText({
                model: llmModel,
                tools: tools,
                system: LMR_SYSTEM_PROMPT(input.style),
                prompt: ANSWER_USER_REQUEST_PROMPT(
                    history,
                    input.user_request!,
                    userInfo,
                    input.user_info?.language ?? 'italian'
                ),
                onStepFinish: ({ toolResults }) => {
                    if (toolResults.length == 0) return;
                    for (const { toolName, input, output } of toolResults) {
                        metadata.tool_calls.push({ toolName, input, output });
                    }
                },
                stopWhen: stepCountIs(5)
            });

            return {
                agent_message: text,
                metadata
            };
        }

        else {

            let prompt = '';

            // 1) Closer has priority if we're closing the conversation
            if (input.chat_status == 'close') {
                prompt = CLOSER_PROMPT(
                    input.user_info,
                    this.stringifyHistory(input)
                );
            }

            // 2) Task in wait state: acknowledge and nudge
            else if (input.task_due && input.task_due.waited) {
                prompt = WAITED_TASK_REQUEST_PROMPT(
                    this.stringifyTask(input.task_due),
                    this.stringifyHistory(input),
                    input.user_info?.language
                );
            }

            // 3) Previously ignored task: gentle reminder
            else if (input.task_due && input.task_due.ignored && !input.task_due.waited) {
                prompt = PRECEDENTLY_IGNORED_TASK_REQUEST_PROMPT(
                    this.stringifyTask(input.task_due),
                    this.stringifyHistory(input),
                    input.user_info?.language
                );
            }

            // 4) First-time task request: task_due present with neither ignored nor waited
            else if (input.task_due && !input.task_due.ignored && !input.task_due.waited) {
                const opener = input.chat_status == 'open' ? OPENER_PROMPT(input.user_info) : undefined;
                prompt = FIRST_TIME_TASK_REQUEST_PROMPT(
                    this.stringifyTask(input.task_due),
                    this.stringifyHistory(input),
                    opener,
                    input.user_info?.language
                );
            }

            // 5) We just open the chat with the user
            else if (input.chat_status == 'open') {
                prompt = OPENER_PROMPT(
                    input.user_info,
                );
            }

            return this.callLLM({
                schema: this.getSchema(),
                style: input.style, 
                model: this.config.baseConfig.model,
                provider: this.config.baseConfig.provider,
                prompt: prompt
            })
        }
    }

}