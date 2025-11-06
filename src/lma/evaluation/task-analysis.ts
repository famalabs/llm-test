import { TASK_ANSWER_EVALUATION_PROMPT, TASK_NOTES_EVALUATION_PROMPT } from './prompts';
import { getLLMProvider, LLMConfigProvider } from "../../llm";
import { LmaOutput } from "../interfaces";
import { generateObject } from "ai";
import z from "zod";

export const evaluateTaskAnalysis = async ({
    expectedOutput,
    generatedOutput,
    model = 'mistral-small-latest',
    provider = 'mistral'
}: {
    expectedOutput: LmaOutput,
    generatedOutput: LmaOutput,
    model?: string,
    provider?: LLMConfigProvider
}) => {
    let score = 0;
    let correctTaskAnswer = false;
    let correctTaskStatus = false;

    const expected = expectedOutput;
    const generated = generatedOutput;

    if (expected.task && generated.task) {

        // STATUS
        if (expected.task.status == generated.task.status) {
            correctTaskStatus = true;
        } else {
            console.log('Mismatch. Expected status:', expected.task.status, 'Generated status:', generated.task.status);
        }

        // ANSWER CHECK
        if (expected.task.answer == generated.task.answer) {
            correctTaskAnswer = true;
        } 
        else {
            if (typeof expected.task.answer === 'string') { // Valutato con LLM
                try {
                    const { object: response } = await generateObject({
                        model: (await getLLMProvider(provider))(model),
                        prompt: TASK_ANSWER_EVALUATION_PROMPT(
                            expected.task.answer.toString(),
                            generated.task.answer?.toString() ?? ''
                        ),
                        temperature: 0,
                        seed: 42,
                        schema: z.object({
                            reasoning: z.string(),
                            score: z.number().min(0).max(1)
                        })
                    });

                    if (response?.score > 0.5) {
                        correctTaskAnswer = true;
                    }
                } catch (error) {
                    console.error('Error evaluating answer:', error);
                }
            }
        }

        // NOTES
        if (!expected.task.notes && !generated.task.notes) {
            score = 1;
        }
        else if (expected.task.notes == generated.task.notes) {
            score = 1;
        }
        else if (expected.task.notes != undefined) {
            try {
                const { object: response } = await generateObject({
                    model: (await getLLMProvider(provider))(model),
                    prompt: TASK_NOTES_EVALUATION_PROMPT(
                        expected.task.notes ?? '',
                        generated.task?.notes ?? ''
                    ),
                    temperature: 0,
                    seed: 42,
                    schema: z.object({
                        reasoning: z.string(),
                        score: z.number().min(0).max(1)
                    })
                });

                score = response?.score ?? 0;
            } catch (error) {
                console.error('Error evaluating notes:', error);
            }
        }
    };

    return {
        correctTaskAnswer,
        correctTaskStatus,
        taskNoteScore: score
    };
}
