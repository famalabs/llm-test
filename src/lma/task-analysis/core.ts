import z from "zod";
import { getLLMProvider, LLMConfigProvider } from "../../llm"
import { LMAInput, OutputTask } from "../interfaces"
import { TASK_ANALYSIS_PROMPT } from "./prompt";
import { generateObject } from "ai";

export const shouldAnalyzeTask = (input: LMAInput): boolean => input.task != undefined;

export const analyzeTask = async ({ input, model, provider } : {
    input: LMAInput,
    model: string,
    provider: LLMConfigProvider
}): Promise<OutputTask> => {

    if (!input.task) throw new Error("Input task is undefined");

    const schema = z.object({
        status: z.enum(['answered', 'ignored', 'negated', 'wait']).describe("Task status"),
        answer: z.union([z.string(), z.number(), z.boolean()]).optional().nullable().describe("Task answer, present only if status is 'answered'"),
        notes: z.string().optional().nullable().describe("Additional notes, present only if status is 'answered'")
    });

    const llmModel = (await getLLMProvider(provider))(model);

    const { object: response } = await generateObject({
        model: llmModel,
        prompt:  TASK_ANALYSIS_PROMPT(input.message, input.task, input.history),
        schema
    });

    return response;
}

