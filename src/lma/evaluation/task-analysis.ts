import { TASK_ANSWER_EVALUATION_PROMPT, TASK_NOTES_EVALUATION_PROMPT } from './prompts';
import { getLLMProvider, LLMConfigProvider } from "../../llm";
import { LmaOutput } from "../interfaces";
import { generateObject } from "ai";
import z from "zod";

export const evalauteTaskAnalysis = async ({
    expectedOutputs,
    generatedOutputs,
    model = 'mistral-small-latest',
    provider = 'mistral'
}: {
    expectedOutputs: LmaOutput[],
    generatedOutputs: LmaOutput[],
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

            // STATUS
            totalTaskStatus += 1;
            if (expected.task.status == generated.task?.status) {
                correctTaskStatus += 1;
            }
            else {
                console.log('Mismatch. Expected status:', expected.task.status, 'Generated status:', generated.task?.status);  
            }

            // ANSWER CHECK
            totalTaskAnswer += 1;
            if (expected.task.answer == generated.task?.answer) {
                correctTaskAnswer += 1;
            }
            else {
                if (typeof expected.task.answer == 'string') { // va valutato con llm
                    const { object: response } = await generateObject({
                        model: (await getLLMProvider(provider))(model),
                        prompt: TASK_ANSWER_EVALUATION_PROMPT(
                            expected.task.answer.toString(),
                            generated.task?.answer?.toString() ?? ''
                        ),
                        temperature: 0,
                        seed: 42,
                        schema: z.object({
                            reasoning: z.string(),
                            score: z.number().min(0).max(1)
                        })
                    });

                    if (response.score > 0.5) {
                        correctTaskAnswer += 1;
                    }
                }
            }

            // NOTES
            if (expected.task.notes != undefined) {
                const { object: response } = await generateObject({
                    model: (await getLLMProvider(provider))(model),
                    prompt: TASK_NOTES_EVALUATION_PROMPT(
                        expected.task.notes,
                        generated.task?.notes ?? ''
                    ),
                    temperature: 0,
                    seed: 42,
                    schema: z.object({
                        reasoning: z.string(),
                        score: z.number().min(0).max(1)
                    })
                });

                scores.push(response.score);
            }
        }
    }

    const taskAnswerAccuracy = totalTaskAnswer == 0 ? null : correctTaskAnswer / totalTaskAnswer;
    const taskStatusAccuracy = totalTaskStatus == 0 ? null : correctTaskStatus / totalTaskStatus;
    const taskNotesAverageScore = scores.length == 0 ? null : scores.reduce((a, b) => a + b, 0) / scores.length;

    return {
        taskAnswerAccuracy,
        taskStatusAccuracy,
        taskNotesAverageScore, 
        taskNotesScores: scores.length > 0 ? scores : null
    };
}