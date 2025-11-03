import { LmrInput } from "../interfaces";

export const FIRST_TIME_TASK_REQUEST_PROMPT = (
    style: string,
    task: string,
    conversationHistory: string,
    language?: string,
    openerSection?: string
) => {
    return `
-----------------------------
FIRST-TIME TASK REQUEST
-----------------------------
You are composing the next assistant message asking the user to carry out a task for the FIRST time in this conversation.

${openerSection ? `Indications for opening the conversation: """\n${openerSection}\n"""` : ''}

Requirements:
- Style: ${style}
- Respect the ongoing context. Use the conversation history and, if present, its summary to maintain continuity.
- The message MUST be actionable, clear and non-repetitive.
- Explain briefly what is needed and why it helps, then ask the user to proceed or confirm.
- Keep a friendly, proactive tone without being pushy.
- 1–3 sentences; avoid emojis and Markdown headings.
- If the user profile is available, personalize lightly (use the name once at most).

Task to request:
${task}

Conversation History Context:
${conversationHistory || '(no prior context)'}

Output:
- Produce ONLY the assistant message text to send to the user (no meta, no JSON, no labels):
{
    "agent_message" : <message>
}

[!] IMPORTANT: Respond in: "${language ? language.toUpperCase() : 'the original language of the conversation'}"
`.trim();
}


export const PRECEDENTLY_IGNORED_TASK_REQUEST_PROMPT = (
    style: string,
    task: string,
    conversationHistory: string,
    language?: string
) => {
    return `
-----------------------------
IGNORED TASK – POLITE REMINDER
-----------------------------
You are composing the next assistant message to gently revisit a task that was previously ignored (no response received). Avoid sounding repetitive or scolding.

Requirements:
- Style: ${style}
- Keep it concise (1–3 sentences), friendly and tactful; no emojis, no Markdown headers.
- Acknowledge lightly that the previous message might have been missed (or the user was busy) without blaming.
- Rephrase the request briefly and clearly, focusing on what to do next.
- End with a simple, direct question or confirmation prompt to move forward.
- Personalize lightly if user data is available (use the name once at most).

Task to revisit:
${task}

Conversation History Context:
${conversationHistory || '(no prior context)'}

User profile (if available):

Output:
- Produce ONLY the assistant message text to send to the user (no meta, no JSON, no labels):
{
    "agent_message" : <message>
}

[!] IMPORTANT: Respond in: "${language ? language.toUpperCase() : 'the original language of the conversation'}"
`.trim();
}

export const WAITED_TASK_REQUEST_PROMPT = (
    style: string,
    task: string,
    conversationHistory: string, 
    language?: string
) => {

    return `
-----------------------------
WAITED TASK – ACK & NUDGE
-----------------------------
You are composing the next assistant message for a task currently in a WAIT state: we already asked and we're waiting for the user's results/feedback.

Requirements:
- Style: ${style}
- Be concise (1–2 sentences), friendly, and non-pressuring; no emojis, no Markdown headers.
- Acknowledge that you're waiting for the outcome of the task.
- Encourage a quick update: either share results or an ETA. Avoid repeating full instructions unless strictly necessary.
- Personalize lightly if user data is available (use the name once at most).

Task in wait state:
${task}

Conversation History Context:
${conversationHistory || '(no prior context)'}

Output:
- Produce ONLY the assistant message text to send to the user (no meta, no JSON, no labels):
{
    "agent_message" : <message>
}

[!] IMPORTANT: Respond in: "${language ? language.toUpperCase() : 'the original language of the conversation'}"
`.trim();
}