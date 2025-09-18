import z from "zod";
import { Metric, MetricArguments } from "./interfaces";
import { sleep } from "../../../lib/utils";
import { generateObject } from "ai";
import { mistral } from "@ai-sdk/mistral";

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

Instructions:
1. Read the QUERY, EXPECTED ANSWER and the GIVEN ANSWER carefully.
2. Evaluate the GIVEN ANSWER against the EXPECTED ANSWER based on Accuracy, Completeness, and Relevance.
3. Assign a Correctness Score (0-1) with one decimal place.
4. Provide a short explanation (1-3 sentences) justifying your score.

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
}: {
    prediction: string,
    reference: string,
    query?: string,
    llm?: string
}) => {

    if (!query || !llm) {
        throw new Error("Missing required arguments: query, llm");
    }

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

export const customLLMAsAJudge: Metric = {
    name: 'llm-as-a-judge',
    execute,
}