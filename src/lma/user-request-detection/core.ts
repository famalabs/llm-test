import { USER_REQUEST_DETECTION_PROMPT, REQUEST_SATISFIED_PROMPT } from "./prompts";
import { getLLMProvider, LLMConfigProvider } from "../../llm";
import { LMAInput } from "../interfaces";
import z from "zod";
import { generateObject } from "ai";

const callLLM = async ({ llmModel, prompt, schema }: {
    llmModel: any;
    prompt: string;
    schema: z.ZodTypeAny;
}) => {

    const { object: response } = await generateObject({
        model: llmModel,
        prompt,
        temperature: 0,
        seed: 42,
        schema
    });

    return response;
}

export const detectUserRequest = async ({
    input,
    model = 'mistral-small-latest',
    provider = 'mistral',
    parallel = false
}: {
    input: LMAInput,
    model?: string,
    provider?: LLMConfigProvider,
    parallel?: boolean
}): Promise<{
    user_request?: string,
    request_satisfied?: boolean
}> => { // user_request | undefined
    const output: {
        user_request?: string,
        request_satisfied?: boolean
    } = {};
    const inputMessage = input.message;

    const userRequestSchema = z.object({
        user_request: z.string().optional()
    });
    const requestSatisfiedSchema = z.object({
        request_satisfied: z.boolean().optional()
    });

    const userRequestPrompt = USER_REQUEST_DETECTION_PROMPT(inputMessage);
    const requestSatisfiedPrompt = REQUEST_SATISFIED_PROMPT(inputMessage, input.history);

    const promises = [];

    const llmModel = (await getLLMProvider(provider))(model);

    promises.push(callLLM({ llmModel, prompt: userRequestPrompt, schema: userRequestSchema }));

    if (input.chat_status == 'request') {
        promises.push(callLLM({ llmModel, prompt: requestSatisfiedPrompt, schema: requestSatisfiedSchema }));
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