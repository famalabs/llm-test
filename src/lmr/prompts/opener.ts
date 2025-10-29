import { LmrInput } from "../interfaces";

export const OPENER_PROMPT = (
    style: string,
    userInfo?: LmrInput['user_info']
) => {
    const language = userInfo?.language || 'italian';
    const name = userInfo?.name?.trim();
    const surname = userInfo?.surname?.trim();
    const gender = userInfo?.gender;

    const styleLower = style.toLowerCase();

    const personalization = (() => {
        if (styleLower.includes('professional')) {
            if (name) return `Use a formal greeting with the name (e.g., "Hello ${name}")`;
            return 'Use a neutral and formal greeting (e.g., "Hello")';
        }

        if (styleLower.includes('empathetic')) {
            if (name) return `Use a warm, direct tone with the name (e.g., "Hi ${name}")`;
            return 'Use a warm, direct tone (e.g., "Hi")';
        }

        if (name) return `Keep it short and use the name (e.g., "Hi ${name}")`;
        return 'Keep it short and neutral (e.g., "Hi" or "Hello")';
    })();

    return `
-----------------------------
OPENER (Greeting)
-----------------------------
Before responding, prepend your message with a short, personalized greeting.

Requirements:
- Style: ${style}
- Length: 1 sentence only, no emojis, no Markdown headers, no lists.
- Personalization: ${personalization}.
- Do not include extra content or questions in the greeting (those go in the main response).

Usage:
- Start the message with the greeting, then continue with the main response.
- No blank lines before the greeting.

User profile (if available):
${JSON.stringify({ name, surname, gender }, null, 2)}

[!] IMPORTANT: Respond in: "${language.toUpperCase()}"
`.trim();
};
