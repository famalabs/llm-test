import { LLMConfigProvider } from "../../llm";
import { LmaOutput } from "../interfaces";
import { evaluateSentimentAnalysis } from "./sentiment-analysis";
import { evalauteTaskAnalysis as evaluateTaskAnalysis } from "./task-analysis";
import { evaluateUserRequestDetection } from "./user-request-detection";

export const evaluate = async ({
    expectedOutputs,
    generatedOutputs,
    model = 'mistral-small-latest',
    provider = 'mistral'
}: {
    expectedOutputs: LmaOutput[],
    generatedOutputs: LmaOutput[],
    model: string,
    provider: LLMConfigProvider
}) => {

    let singleSentimentAnalysisScore: { raw: number, binarized: number } | null = null;
    let cumulativeSentimentAnalysisScore: { raw: number, binarized: number } | null = null;
    let userRequestAccuracyAndEvaluation: { userRequestPresenceAccuracy: number, requestSatisfiedAccuracy: number, averageUserRequestScore: number } | null = null;
    let taskAnalysis: { taskAnswerAccuracy: number, taskStatusAccuracy: number, taskNotesAverageScore: number } | null = null;

    if (generatedOutputs.some(g => g.sentiment)) {
        singleSentimentAnalysisScore = evaluateSentimentAnalysis({
            expectedScores: expectedOutputs.map(e => e.sentiment.single),
            generatedScores: generatedOutputs.map(e => e.sentiment.single)
        });
        cumulativeSentimentAnalysisScore = evaluateSentimentAnalysis({
            expectedScores: expectedOutputs.map(e => e.sentiment.cumulative),
            generatedScores: generatedOutputs.map(e => e.sentiment.cumulative)
        });
    }

    if (generatedOutputs.some(g => g.user_request != undefined && g.request_satisfied != undefined)) {
        userRequestAccuracyAndEvaluation = await evaluateUserRequestDetection({
            expectedOutputs,
            generatedOutputs,
            model,
            provider
        });
    }

    if (generatedOutputs.some(g => g.task)) {
        taskAnalysis = await evaluateTaskAnalysis({
            expectedOutputs,
            generatedOutputs,
            model,
            provider
        });
    }

    return {
        sentimentAnalysis: {
            single: singleSentimentAnalysisScore,
            cumulative: cumulativeSentimentAnalysisScore
        },
        userRequest: userRequestAccuracyAndEvaluation,
        taskAnalysis,
    };
};
