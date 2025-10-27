import { generateObject } from "ai";
import { LmaOutput } from "../interfaces";
import { getLLMProvider, LLMConfigProvider } from "../../llm";
import z from "zod";
import { USER_REQUEST_EVALUATION_PROMPT } from "./prompts";

export const evaluateUserRequestDetection = async ({
    expectedOutputs,
    generatedOutputs,
    model = "mistral-small-latest",
    provider = "mistral",
}: {
    expectedOutputs: LmaOutput[];
    generatedOutputs: LmaOutput[];
    model?: string;
    provider?: LLMConfigProvider;
}) => {
    const scores: number[] = [];
    let totalSatisfiedDetections = 0;
    let correctSatisfiedDetections = 0;
    let correctPresenceDetections = 0;
    let totalPresenceDetections = 0;

    const llm = (await getLLMProvider(provider))(model);

    for (let i = 0; i < expectedOutputs.length; i++) {
        const expected = expectedOutputs[i];
        const generated = generatedOutputs[i];

        const expectedReq = expected.user_request;
        const generatedReq = generated.user_request;

        if (expectedReq != undefined) {
            totalPresenceDetections += 1;

            if (generatedReq != undefined) {
                correctPresenceDetections += 1;

                if (generatedReq.trim() === expectedReq.trim()) {
                    // testi identici
                    scores.push(1);
                } 
                
                else {
                    // testi diversi → chiama LLM per score semantico
                    const { object: response } = await generateObject({
                        model: llm,
                        prompt: USER_REQUEST_EVALUATION_PROMPT(expectedReq, generatedReq),
                        temperature: 0,
                        seed: 42,
                        schema: z.object({
                            reasoning: z.string(),
                            score: z.number().min(0).max(1),
                        }),
                    });
                    scores.push(response.score);
                }
            }
        }


        if (expected.request_satisfied != undefined) {
            totalSatisfiedDetections += 1;
            if (
                generated.request_satisfied != undefined &&
                generated.request_satisfied == expected.request_satisfied
            ) {
                correctSatisfiedDetections += 1;
            }
        }
    }

    const userRequestPresenceAccuracy = totalPresenceDetections == 0 ? null : correctPresenceDetections / totalPresenceDetections;

    const requestSatisfiedAccuracy = totalSatisfiedDetections == 0 ? null : correctSatisfiedDetections / totalSatisfiedDetections;

    const averageUserRequestScore = scores.length == 0 ? null : scores.reduce((a, b) => a + b, 0) / scores.length;

    return {
        userRequestPresenceAccuracy,
        requestSatisfiedAccuracy,
        averageUserRequestScore,
    };
};
