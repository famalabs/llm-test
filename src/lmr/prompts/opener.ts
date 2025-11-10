import { LmrInput } from "../interfaces";

export const OPENER_PROMPT = (
    userInfo?: LmrInput['user_info']
) => {
    const language = userInfo?.language || 'italian';
    const name = userInfo?.name?.trim();
    const surname = userInfo?.surname?.trim();
    const gender = userInfo?.gender;

    const personalization = name ? `Keep it short and use the name (e.g., "Hi ${name}")` : 'Keep it short and neutral (e.g., "Hi" or "Hello")';

    return `
-----------------------------
OPENER (Greeting)
-----------------------------
Generate a personalized greeting for the user based on the following instructions.

Requirements:
- Length: 1 sentence only, no emojis, no Markdown headers, no lists.
- Personalization: ${personalization}.

User profile (if available):
${JSON.stringify({ name, surname, gender }, null, 2)}

[!] IMPORTANT: Respond in: "${language.toUpperCase()}"
`.trim();
};
