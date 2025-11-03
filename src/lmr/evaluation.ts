import { LmrInput, LmrOutput } from "./interfaces";
import { customLLMAsAJudge } from '../test/evaluations/llm-as-a-judge';
import { LLMConfigProvider } from "../llm";

export const evaluate = async ({
    lmrInputs,
    expectedOutputs,
    generatedOutputs,
    model,
    provider
}: {
    lmrInputs: LmrInput[],
    expectedOutputs: { key_ref: string, full_ref: string }[],
    generatedOutputs: LmrOutput[],
    model?: string,
    provider?: LLMConfigProvider
}) => {

    if (expectedOutputs.length != generatedOutputs.length) {
        throw new Error('Expected and generated outputs length mismatch.');
    }

    const scores = [];

    for (let i = 0; i < expectedOutputs.length; i++) {
        const { key_ref: expectedKeyRef, full_ref: expectedFullRef } = expectedOutputs[i];
        const generated = generatedOutputs[i];
        const { score } = await customLLMAsAJudge.execute({
            prediction: generated.agent_message,
            keyRef: expectedKeyRef,
            fullRef: expectedFullRef,
            query: JSON.stringify(lmrInputs[i]),
            model,
            provider
        });
        scores.push(score);
    }

    const averageScore = scores.length == 0 ? null : scores.reduce((a, b) => a + b, 0) / scores.length;

    return {
        mean: averageScore,
        scores
    }
}