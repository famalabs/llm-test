import { TASK_ANSWER_EVALUATION_PROMPT, TASK_NOTES_EVALUATION_PROMPT } from './prompts';
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


            if (expected.task.answer == undefined && generated.task?.answer == undefined) {
                // none è comunque una risposta.
                correctTaskAnswer += 1;
                totalTaskAnswer += 1;
            }

            if (expected.task.answer != undefined) {
                totalTaskAnswer += 1;

                if (typeof expected.task.answer != 'string' && expected.task.answer === generated.task?.answer) {
                    // number or boolean
                    correctTaskAnswer += 1;
                }
                else {
                    // sono stringhe -> comparison con llm as a judge
                    const { object: response } = await generateObject({
                        model: (await getLLMProvider(provider))(model),
                        prompt: TASK_ANSWER_EVALUATION_PROMPT(expected.task.answer.toString(), generated.task?.answer?.toString() ?? ''),
                        temperature: 0,
                        seed: 42,
                        schema: z.object({
                            reasoning: z.string(),
                            score: z.number().min(0).max(1)
                        })
                    })
                    if (response.score > 0.5) {
                        correctTaskAnswer += 1;
                    }
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
                        reasoning: z.string(),
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