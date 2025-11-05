import { LLMConfigProvider } from "../../llm";
import { LmaInput, LmaOutput, SentimentScores } from "../interfaces";
import { evaluateSentimentAnalysis } from "./sentiment-analysis";
import { evaluateTaskAnalysis as evaluateTaskAnalysis } from "./task-analysis";
import { evaluateUserRequestDetection } from "./user-request-detection";
import { evaluateToolsDetection } from "./tools-detection";
import { mean } from "../../utils";

export const evaluate = async ({
    results, 
    model = 'mistral-small-latest',
    provider = 'mistral'
}: {
    results: {
        expected_output: LmaOutput,
        candidate: (LmaOutput & { sentiment: { lastMessageLookingAtHistory?: SentimentScores } }),
        input: LmaInput,
        metadata?: Record<string, any>
    }[],
    model: string,
    provider: LLMConfigProvider
}) => {

    const output = {
        tests: [] as {
            test: {
                input: LmaInput,
                expected_output: LmaOutput,
                candidate: LmaOutput,
                metadata?: Record<string, any>
            },
            metrics: any
        }[],
        summary: {}
    }

    for (let i = 0; i < results.length; i++) {
        const test = results[i];

        if (!test.input || !test.expected_output || !test.candidate) {
            throw new Error(`Input, expected output, or candidate is missing for index ${i}.`);
        }

        const metrics: any = {};

        if (test.candidate.sentiment && test.expected_output.sentiment) {
            metrics.sentiment = {
                single: evaluateSentimentAnalysis({
                    generatedScore: test.candidate.sentiment.single,
                    expectedScore: test.expected_output.sentiment.single
                }),
                cumulative: evaluateSentimentAnalysis({
                    generatedScore: test.candidate.sentiment.cumulative,
                    expectedScore: test.expected_output.sentiment.cumulative
                }),
                lastMessageLookingAtHistory: test.candidate.sentiment.lastMessageLookingAtHistory ? evaluateSentimentAnalysis({
                    generatedScore: test.candidate.sentiment.lastMessageLookingAtHistory,
                    expectedScore: test.expected_output.sentiment.single
                }) : null
            }
        }

        if (test.candidate.user_request != undefined) {
            metrics.userRequest = await evaluateUserRequestDetection({
                expectedOutput: test.expected_output,
                generatedOutput: test.candidate,
                model,
                provider
            });
        }

        if (test.candidate.useful_tools) {
            metrics.toolsDetection = evaluateToolsDetection({
                expectedOutput: test.expected_output,
                generatedOutput: test.candidate
            });
        }

        if (test.candidate.task) {
            metrics.taskAnalysis = await evaluateTaskAnalysis({
                expectedOutput: test.expected_output,
                generatedOutput: test.candidate,
                model,
                provider
            });
        }

        output.tests.push({ test, metrics });
    }

    const allSingle = [];
    const allCumulative = [];
    const allLastMessageLookingAtHistory = [];
    const allUserRequestsScore = [];
    const allCorrectPresenceDetections = [];
    const allCorrectSatisfiedDetections = [];
    const allToolNameIoU = [];
    const allToolParamAccuracy = [];
    const allCorrectTaskAnswers = [];
    const allCorrectTaskStatuses = [];
    const allTaskNotesAverageScores = [];

    for (const test of output.tests) {
        if (test.metrics.sentiment.single) {
            const { raw, binarized } = test.metrics.sentiment.single;
            allSingle.push({ raw, binarized });
        }
        if (test.metrics.sentiment.cumulative) {
            const { raw, binarized } = test.metrics.sentiment.cumulative;
            allCumulative.push({ raw, binarized });
        }
        if (test.metrics.sentiment.lastMessageLookingAtHistory) {
            const { raw, binarized } = test.metrics.sentiment.lastMessageLookingAtHistory;
            allLastMessageLookingAtHistory.push({ raw, binarized });
        }
        if (test.metrics.userRequest) {
            const { userRequestScore, correctPresenceDetections, correctSatisfiedDetections } = test.metrics.userRequest;
            if (userRequestScore != undefined) {
                allUserRequestsScore.push(userRequestScore);
            }
            if (correctPresenceDetections != undefined) {
                allCorrectPresenceDetections.push(correctPresenceDetections ? 1 : 0);
            }
            if (correctSatisfiedDetections != undefined) {
                allCorrectSatisfiedDetections.push(correctSatisfiedDetections ? 1 : 0);
            }
        }
        if (test.metrics.toolsDetection) {
            const { toolNameIoU, toolParamAccuracy } = test.metrics.toolsDetection;
            if (toolNameIoU != undefined) {
                allToolNameIoU.push(toolNameIoU);
            }
            if (toolParamAccuracy != undefined) {
                allToolParamAccuracy.push(toolParamAccuracy);
            }
        }
        if (test.metrics.taskAnalysis) {
            const { correctTaskAnswer, correctTaskStatus, notesScore } = test.metrics.taskAnalysis;
            if (correctTaskAnswer != undefined) {
                allCorrectTaskAnswers.push(correctTaskAnswer ? 1 : 0);
            }
            if (correctTaskStatus != undefined) {
                allCorrectTaskStatuses.push(correctTaskStatus ? 1 : 0);
            }
            if (notesScore != undefined) {
                allTaskNotesAverageScores.push(notesScore);
            }
        }
    }

    output.summary = {
        sentiment: {
            single: allSingle.length == 0 ? null : {
                averageRawDistance: mean(allSingle.map(s => s.raw)),
                averageBinarizedDistance: mean(allSingle.map(s => s.binarized)),
            },
            cumulative: allCumulative.length == 0 ? null : {
                averageRawDistance: mean(allCumulative.map(s => s.raw)),
                averageBinarizedDistance: mean(allCumulative.map(s => s.binarized)),
            },
            lastMessageLookingAtHistory: allLastMessageLookingAtHistory.length == 0 ? null : {
                averageRawDistance: mean(allLastMessageLookingAtHistory.map(s => s.raw)),
                averageBinarizedDistance: mean(allLastMessageLookingAtHistory.map(s => s.binarized)),
            },
        }, 
        userRequest: {
            averageUserRequestScore: allUserRequestsScore.length == 0 ? null : mean(allUserRequestsScore),
            requestPresenceAccuracy: allCorrectPresenceDetections.length == 0 ? null : mean(allCorrectPresenceDetections),
            requestSatisfiedAccuracy: allCorrectSatisfiedDetections.length == 0 ? null : mean(allCorrectSatisfiedDetections),
        }, 
        toolsDetection: {
            averageToolNameIoU: allToolNameIoU.length == 0 ? null : mean(allToolNameIoU),
            averageToolParamAccuracy: allToolParamAccuracy.length == 0 ? null : mean(allToolParamAccuracy),
        }, 
        taskAnalysis: {
            taskAnswerAccuracy: allCorrectTaskAnswers.length == 0 ? null : mean(allCorrectTaskAnswers),
            taskStatusAccuracy: allCorrectTaskStatuses.length == 0 ? null : mean(allCorrectTaskStatuses),
            averageNotesScore: allTaskNotesAverageScores.length == 0 ? null : mean(allTaskNotesAverageScores),
        }
    };

    return output;
};
