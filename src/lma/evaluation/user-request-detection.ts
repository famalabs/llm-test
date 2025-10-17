import { generateObject } from "ai";
import { LMAOutput } from "../interfaces";
import { getLLMProvider, LLMConfigProvider } from "../../llm";
import z from "zod";
import { USER_REQUEST_EVALUATION_PROMPT } from "./prompts";

export const evaluateUserRequestDetection = async ({
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
    let totalSatisfiedDetections = 0;
    let correctSatisfiedDetections = 0;
    let correctDetections = 0;
    let totalDetections = 0;

    for (let i = 0; i < expectedOutputs.length; i++) {
        const expected = expectedOutputs[i];
        const generated = generatedOutputs[i];

        if (expected.user_request != undefined) {
            totalDetections += 1;
            if (generated.user_request != undefined && generated.user_request == expected.user_request) {
                correctDetections += 1;

                const { object: response } = await generateObject({
                    model: (await getLLMProvider(provider))(model),
                    prompt: USER_REQUEST_EVALUATION_PROMPT(expected.user_request, generated.user_request),
                    temperature: 0,
                    seed: 42,
                    schema: z.object({
                        score: z.number().min(0).max(1)
                    })
                });

                scores.push(response.score);
            }
        }

        if (expected.request_satisfied != undefined) {
            totalSatisfiedDetections += 1;
            if (generated.request_satisfied != undefined && generated.request_satisfied == expected.request_satisfied) {
                correctSatisfiedDetections += 1;
            }
        }
    }

    const requestSatisfiedAccuracy = totalSatisfiedDetections == 0 ? 0 : correctSatisfiedDetections / totalSatisfiedDetections;
    const userRequestPresenceAccuracy = totalDetections == 0 ? 0 : correctDetections / totalDetections;
    const averageUserRequestScore = scores.length == 0 ? 0 : scores.reduce((a, b) => a + b, 0) / scores.length;

    return { userRequestPresenceAccuracy, requestSatisfiedAccuracy, averageUserRequestScore };
}
