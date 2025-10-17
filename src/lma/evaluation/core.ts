import { LLMConfigProvider } from "../../llm";
import { LMAOutput } from "../interfaces";
import { evaluateSentimentAnalysis } from "./sentiment-analysis";
import { evalauteTaskAnalysis as evaluateTaskAnalysis } from "./task-analysis";
import { evaluateUserRequestDetection } from "./user-request-detection";

export const evaluate = async ({
    expectedOutputs,
    generatedOutputs,
    model = 'mistral-small-latest',
    provider = 'mistral'
}: {
    expectedOutputs: LMAOutput[],
    generatedOutputs: LMAOutput[],
    model: string,
    provider: LLMConfigProvider
}) => {

    const singleSentimentAnalysisScore = evaluateSentimentAnalysis({
        expectedScores: expectedOutputs.map(e => e.sentiment.single),
        generatedScores: generatedOutputs.map(e => e.sentiment.single)
    });

    const cumulativeSentimentAnalysisScore = evaluateSentimentAnalysis({
        expectedScores: expectedOutputs.map(e => e.sentiment.cumulative),
        generatedScores: generatedOutputs.map(e => e.sentiment.cumulative)
    });

    const userRequestAccuracyAndEvaluation = await evaluateUserRequestDetection({
        expectedOutputs,
        generatedOutputs,
        model,
        provider
    });

    const taskAnalysis = await evaluateTaskAnalysis({
        expectedOutputs,
        generatedOutputs,
        model,
        provider
    });

    return {
        sentimentAnalysis: {
            single: singleSentimentAnalysisScore,
            cumulative: cumulativeSentimentAnalysisScore
        },
        userRequest: userRequestAccuracyAndEvaluation,
        taskAnalysis,
    };
};
