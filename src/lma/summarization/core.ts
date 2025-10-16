import { generateObject } from "ai";
import { LMAInput } from "../interfaces";
import { CHAT_HISTORY_SUMMARIZATION_PROMPT } from "./prompt";
import z from "zod";
import { getLLMProvider, LLMConfigProvider } from "../../llm";

const C_MAX = 2000;
const C_MIN = 1000;

const getInputLength = (input: LMAInput): number => {
    const span = input.summary?.span ?? 0;
    const historyLength = input.history.slice(span).reduce((acc, msg) => acc + msg.message.length, 0);
    const messageLength = input.message.length;
    const summaryLength = input.summary?.text.length ?? 0;
    return historyLength + messageLength + summaryLength;
};

const getSpanForSummarization = (history: LMAInput["history"], startIndex: number): number => {
    let acc = 0;
    let span = startIndex;
    for (; span < history.length; span++) {
        acc += history[span].message.length;
        if (acc >= C_MIN) break;
    }
    return span + 1;
};

export const shouldSummarize = (input: LMAInput): boolean => getInputLength(input) > C_MAX;

export const summarize = async ({
    input,
    model = 'mistral-small-latest', 
    provider = 'mistral'
}: {
    input: LMAInput;
    model?: string;
    provider?: LLMConfigProvider;
}): Promise<{ text: string; span: number }> => {
    const startIndex = input.summary?.span ?? 0;

    const span = getSpanForSummarization(input.history, startIndex);
    const partialHistory = input.history.slice(startIndex, span);

    const prompt = CHAT_HISTORY_SUMMARIZATION_PROMPT(
        partialHistory,
        input.summary?.text
    );

    const schema = z.object({
        summary: z.string()
    });

    const llmProvider = await getLLMProvider(provider);

    let { object: response } = await generateObject({
        prompt,
        model: llmProvider(model),
        schema
    });

    return {
        text: response.summary.trim(),
        span
    };
};
