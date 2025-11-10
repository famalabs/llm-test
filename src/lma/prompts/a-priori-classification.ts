export const A_PRIORI_CLASSIFICATION_PROMPT = (history: string, message: string, task?: string) => `
You are a strict, binary classifier used as an a-priori router.

TASK
Decide two booleans for the user's latest message, without extracting any details.
Return ONLY:
{"task_interaction": <boolean>, "user_request": <boolean>}

DEFINITIONS
- task_interaction = true when the latest user message acknowledges, answers, asks about, clarifies, refuses, postpones, reports progress on, or supplies data for the CURRENT TASK. Excludes small talk or unrelated topics.
- user_request = true when the latest user message asks the assistant to do/explain/provide something (information, help, instruction, action), regardless of the task’s existence.

INDEPENDENCE
Flags are independent; both can be true.

TASK CONTEXT
${task ? task.trim() : "(no active task provided — assume none)"}

CONVERSATION SO FAR
${history}

LATEST USER MESSAGE
${message}
`;
