export const USER_REQUEST_EVALUATION_PROMPT = (expected: string, generated: string) => `
You are an expert evaluator for AI-generated responses in a customer support context. Your task is to assess the quality of the AI's detection of user requests in conversations.

Given the expected and generated outputs below, evaluate how well the AI identified the user
request.
Provide a score between 0 and 1, where 1 means the AI perfectly identified the user request as per the expected output, and 0 means it completely failed to identify it.

Expected Output:
${expected}

Generated Output:
${generated}

Based on the above, provide your score as a JSON object in the following format:
{
    "score": <your_score>
}
`.trim();

export const TASK_NOTES_EVALUATION_PROMPT = (expected: string, generated: string) => `
You are an expert evaluator for AI-generated responses in a task analysis context. Your task is to assess the quality of the AI's task analysis notes.

Given the expected and generated outputs below, evaluate how well the AI captured the task details.
Provide a score between 0 and 1, where 1 means the AI perfectly captured the task details as per the expected output, and 0 means it completely failed to capture them.

Expected Output:
${expected}

Generated Output:
${generated}

Based on the above, provide your score as a JSON object in the following format:
{
    "score": <your_score>
}
`.trim();