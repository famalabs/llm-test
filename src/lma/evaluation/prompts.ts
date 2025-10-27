export const USER_REQUEST_EVALUATION_PROMPT = (expected: string, generated: string) => `
You are an expert evaluator for AI-generated responses in a patient support context. Your task is to assess the quality of the AI's detection of user requests in conversations.

Given the expected and generated outputs below, evaluate how well the AI identified the user
request.
Provide a score between 0 and 1, where 1 means the AI perfectly identified the user request as per the expected output, and 0 means it completely failed to identify it.

Expected Output:
${expected}

Generated Output:
${generated}

Based on the above, provide your score as a JSON object in the following format:
{
    "reasoning": "<your_reasoning (1 to 3 sentences, explaining your score)>",
    "score": <your_score>
}
`.trim();

export const TASK_ANSWER_EVALUATION_PROMPT = (expected: string, generated: string) => `
You are an impartial and rigorous evaluator. 
Your job is to assess how semantically and factually similar the generated task answer is to the expected answer.

EXPECTED ANSWER:
${expected}

GENERATED ANSWER:
${generated}

GUIDELINES:
- A perfect match (score = 1) means the generated answer conveys exactly the same meaning as the expected answer, even if wording differs.
- A mismatch (score = 0) means the generated answer does not match the expected meaning at all.

Return a short explanation in 'reasoning' and a numeric score in [0,1].
`;

export const TASK_NOTES_EVALUATION_PROMPT = (expected: string, generated: string) => `
You are evaluating the similarity and informativeness of task notes.

EXPECTED NOTES:
${expected}

GENERATED NOTES:
${generated}

EVALUATION CRITERIA:
- A perfect match (score = 1) means the generated notes conveys exactly the same meaning as the expected notes, even if wording differs.
- A mismatch (score = 0) means the generated notes do not match the expected meaning at all.

Return a short explanation in 'reasoning' and a numeric score in [0,1].
`;
