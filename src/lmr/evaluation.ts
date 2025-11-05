import { LmrInput, LmrOutput } from "./interfaces";
import { customLLMAsAJudge } from '../test/evaluations/llm-as-a-judge';
import { LLMConfigProvider } from "../llm";

export const evaluate = async ({
    results, 
    model,
    provider
}: {
    results: {
        input: LmrInput,
        expected_output: { key_ref: string, full_ref: string },
        candidate: LmrOutput, 
        metadata?: Record<string, any>
    }[],
    model?: string,
    provider?: LLMConfigProvider
}) => {

    const output = {
        tests: [] as {
            test: {
                input: LmrInput,
                expected_output: { key_ref: string, full_ref: string },
                candidate: LmrOutput, 
                metadata?: Record<string, any>
            },
            metrics: {
                agentMessageScore: number
            }
        }[],
        summary: {}
    }

    for (let i = 0; i < results.length; i++) {

        const test = results[i];

        const { key_ref: expectedKeyRef, full_ref: expectedFullRef } = test.expected_output;
        const generated = test.candidate;
        const { score } = await customLLMAsAJudge.execute({
            candidate: generated.agent_message,
            keyRef: expectedKeyRef,
            fullRef: expectedFullRef,
            query: JSON.stringify(test.input),
            model,
            provider
        });

        output.tests.push({
            test,
            metrics: { agentMessageScore: score }
        });
    }

    return {
        tests: output.tests,
        summary: {
            averageAgentMessageScore: output.tests.length == 0 ? null : output.tests.reduce((acc: number, b) => acc + b.metrics.agentMessageScore, 0) / output.tests.length
        }
    }
}