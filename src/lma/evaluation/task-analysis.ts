import { TASK_NOTES_EVALUATION_PROMPT } from './prompts';
import { getLLMProvider, LLMConfigProvider } from "../../llm";
import { LMAOutput } from "../interfaces";
import { generateObject } from "ai";
import z from "zod";

export const evalauteTaskAnalysis = async ({
    expectedOutputs,
    generatedOutputs,
    model = 'mistral-small-latest',
    provider = 'mistral'
}: {
    expectedOutputs: LMAOutput[],
    generatedOutputs: LMAOutput[],
    model?: string,
    provider?: LLMConfigProvider
}) => {

    const scores: number[] = [];

    let correctTaskAnswer = 0;
    let totalTaskAnswer = 0;

    let correctTaskStatus = 0;
    let totalTaskStatus = 0;

    for (let i = 0; i < expectedOutputs.length; i++) {
        const expected = expectedOutputs[i];
        const generated = generatedOutputs[i];

        if (expected.task) {
            if (expected.task.answer != undefined) {
                totalTaskAnswer += 1;
                if (generated.task?.answer != undefined && generated.task.answer === expected.task.answer) {
                    correctTaskAnswer += 1;
                }
            }

            if (expected.task.status != undefined) {
                totalTaskStatus += 1;
                if (generated.task?.status != undefined && generated.task.status === expected.task.status) {
                    correctTaskStatus += 1;
                }
            }

            if (expected.task.notes != undefined) {
                const { object: response } = await generateObject({
                    model: (await getLLMProvider(provider))(model),
                    prompt: TASK_NOTES_EVALUATION_PROMPT(expected.task.notes, generated.task?.notes ?? ''),
                    temperature: 0,
                    seed: 42,
                    schema: z.object({
                        score: z.number().min(0).max(1)
                    })
                })
                scores.push(response.score);
            }
        }
    }

    const taskAnswerAccuracy = totalTaskAnswer == 0 ? 0 : correctTaskAnswer / totalTaskAnswer;
    const taskStatusAccuracy = totalTaskStatus == 0 ? 0 : correctTaskStatus / totalTaskStatus;
    const taskNotesAverageScore = scores.length == 0 ? 0 : scores.reduce((a, b) => a + b, 0) / scores.length;

    return {
        taskAnswerAccuracy,
        taskStatusAccuracy,
        taskNotesAverageScore
    };
}