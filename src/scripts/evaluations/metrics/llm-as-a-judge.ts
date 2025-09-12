import z from "zod";
import { Metric, MetricArguments } from "./interfaces";
import { sleep } from "../../../lib/utils";
import { generateObject } from "ai";
import { mistral } from "@ai-sdk/mistral";

type CustomLLMAsAJudgeProps = MetricArguments & { query: string, llm: string };

const getPrompt: (query: string, expectedAnswer: string, givenAnswer: string) => string = (query, expectedAnswer, givenAnswer) => {
    return `
    You're an expert evaluator for assessing the correctness of answers provided by a question-answering system. Your task is to compare the provided answer with the expected answer and assign a correctness score based on the following criteria:
- Accuracy: Check if the given answer accurately reflects the information in the expected answer.
- Completeness: Determine if the given answer covers all necessary aspects of the expected answer.
- Relevance: Ensure that the given answer stays on topic and does not include extraneous information.

You will be given:
- A QUERY (the question asked).
- An EXPECTED ANSWER (the correct answer to the question).
- A GIVEN ANSWER (the answer provided by the system).

You're expected to provide:
1. A Correctness Score (0 to 1, in increments of 0.1).
2. A brief explanation (1-3 sentences) justifying your score.

Correctness Score (0 to 1, in increments of 0.1):
   0 = Uncorrect: The provided answer doesn't match the expected answer, due to false facts/answers or generic information.
   0.1 = Virtually Uncorrect: Barely related or mostly incorrect.
   0.2 = Very Slightly Uncorrect: Contains minor elements of correctness but mostly wrong.
   0.3 = Slightly Correct: Some relevant content but many errors or omissions.
   0.4 = Somewhat Correct: Partially correct but missing important details.
   0.5 = Moderately Correct: Halfway correct, some gaps or inaccuracies.
   0.6 = Fairly Correct: Mostly correct but missing minor points.
   0.7 = Correct: Correct with minor inaccuracies or omissions.
   0.8 = Very Correct: Mostly correct and complete, minor issues only.
   0.9 = Highly Correct: Almost perfect, negligible mistakes.
   1 = Perfectly Correct: Fully accurate, complete, and relevant.

Instructions:
1. Read the QUERY, EXPECTED ANSWER and the GIVEN ANSWER carefully.
2. Evaluate the GIVEN ANSWER against the EXPECTED ANSWER based on Accuracy, Completeness, and Relevance.
3. Assign a Correctness Score (0-1) with one decimal place.
4. Provide a short explanation (1-3 sentences) justifying your score.

Very important guard:
- Simply put: if the answer do not answer the query or it provides false facts or it provides generic information => SCORE IS 0.

-----------
QUERY:
${query}
-----------
EXPECTED ANSWER: 
${expectedAnswer}
-----------
GIVEN ANSWER:
${givenAnswer}
-----------`
}


const execute = async ({
    prediction,
    reference,
    query,
    llm
}: CustomLLMAsAJudgeProps) => {
    const schema = z.object({
        score: z.number().min(0).max(1),
        explanation: z.string()
    });

    const prompt = getPrompt(query, /*expectedAnswer*/ reference, /*givenAnswer*/ prediction);
    const getResponse = async () => {
        const { object: result } = await generateObject({
            model: mistral(llm),
            prompt,
            temperature:0,
            seed: 42,
            schema
        });

        return result.score;
    }

    let score = 0;

    try {
        score = await getResponse();
    } catch (error) {
        await sleep(10);
        score = await getResponse();
    }

    return { score };
}

export const customLLMAsAJudge : Metric = {
    name: 'llm-as-a-judge',
    execute,
    weight: 0.8
}