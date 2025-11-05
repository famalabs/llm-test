import { generateObject } from "ai";
import { LmaOutput } from "../interfaces";
import { getLLMProvider, LLMConfigProvider } from "../../llm";
import z from "zod";
import { USER_REQUEST_EVALUATION_PROMPT } from "./prompts";

export const evaluateUserRequestDetection = async ({
    expectedOutput,
    generatedOutput,
    model = "mistral-small-latest",
    provider = "mistral",
}: {
    expectedOutput: LmaOutput;
    generatedOutput: LmaOutput;
    model?: string;
    provider?: LLMConfigProvider;
}) => {
    let score = 0;
    let correctSatisfiedDetections = false;
    let correctPresenceDetections = false;

    const llm = (await getLLMProvider(provider))(model);


    const expected = expectedOutput;
    const generated = generatedOutput;

    const expectedReq = expected.user_request;
    const generatedReq = generated.user_request;

    if (expectedReq != undefined) {

        if (generatedReq != undefined) {
            correctPresenceDetections = true;

            if (generatedReq.trim() === expectedReq.trim()) {
                // testi identici
                score = 1;
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
                score = response.score;
            }
        }
    }


    if (generated.request_satisfied == expected.request_satisfied) {
        correctSatisfiedDetections = true;
    }

    return {
        correctPresenceDetections,
        correctSatisfiedDetections,
        userRequestScore: score,
    };
};
