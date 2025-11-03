import { LLMConfigProvider } from "../../llm";
import { LmaOutput, SentimentScores } from "../interfaces";
import { evaluateSentimentAnalysis } from "./sentiment-analysis";
import { evalauteTaskAnalysis as evaluateTaskAnalysis } from "./task-analysis";
import { evaluateUserRequestDetection } from "./user-request-detection";
import { evaluateToolsDetection } from "./tools-detection";

export const evaluate = async ({
    expectedOutputs,
    generatedOutputs,
    model = 'mistral-small-latest',
    provider = 'mistral'
}: {
    expectedOutputs: LmaOutput[],
    generatedOutputs: (LmaOutput & { sentiment: { lastMessageLookingAtHistory?: SentimentScores } })[],
    model: string,
    provider: LLMConfigProvider
}) => {

    let singleSentimentAnalysisScore: { means: { raw: number, binarized: number }, allRawMeans: number[], allBinMeans: number[] } | null = null;
    let cumulativeSentimentAnalysisScore: { means: { raw: number, binarized: number }, allRawMeans: number[], allBinMeans: number[] } | null = null;
    let lastMessageLookingAtHistoryScore: { means: { raw: number, binarized: number }, allRawMeans: number[], allBinMeans: number[] } | null = null;
    let userRequestAccuracyAndEvaluation: {
        userRequestPresenceAccuracy: number | null,
        requestSatisfiedAccuracy: number | null,
        averageUserRequestScore: number | null,
        userRequestScores: number[] | null
    } | null = null;
    let toolsDetection: { toolNameIoU: number | null, toolParamAccuracy: number | null } | null = null;
    let taskAnalysis: {
        taskAnswerAccuracy: number | null, taskStatusAccuracy: number | null, taskNotesAverageScore: number | null,
        taskNotesScores: number[] | null
    } | null = null;

    if (generatedOutputs.some(g => g.sentiment) && expectedOutputs.some(e => e.sentiment)) {
        singleSentimentAnalysisScore = evaluateSentimentAnalysis({
            expectedScores: expectedOutputs.map(e => e.sentiment.single),
            generatedScores: generatedOutputs.map(e => e.sentiment.single)
        });
        cumulativeSentimentAnalysisScore = evaluateSentimentAnalysis({
            expectedScores: expectedOutputs.map(e => e.sentiment.cumulative),
            generatedScores: generatedOutputs.map(e => e.sentiment.cumulative)
        });
        if (generatedOutputs.some(g => g.sentiment.lastMessageLookingAtHistory)) {
            lastMessageLookingAtHistoryScore = evaluateSentimentAnalysis({
                expectedScores: expectedOutputs.map(e => e.sentiment.single),
                generatedScores: generatedOutputs.map(e => e.sentiment.lastMessageLookingAtHistory!)
            });
        }
    }

    if (generatedOutputs.some(g => g.user_request != undefined && g.request_satisfied != undefined)) {
        userRequestAccuracyAndEvaluation = await evaluateUserRequestDetection({
            expectedOutputs,
            generatedOutputs,
            model,
            provider
        });
    }

    if (generatedOutputs.some(g => g.useful_tools)) {
        toolsDetection = evaluateToolsDetection({
            expectedOutputs,
            generatedOutputs
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
            cumulative: cumulativeSentimentAnalysisScore,
            ...(lastMessageLookingAtHistoryScore ? { lastMessageLookingAtHistory: lastMessageLookingAtHistoryScore } : {})
        },
        userRequest: userRequestAccuracyAndEvaluation,
        toolsDetection,
        taskAnalysis,
    };
};
