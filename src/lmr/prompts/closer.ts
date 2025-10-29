import { LmrInput } from "../interfaces";

export const CLOSER_PROMPT = (
    style: string,
    userInfo?: LmrInput['user_info'],
    conversationHistory?: string
) => {
    const language = userInfo?.language || 'italian';
    const name = userInfo?.name?.trim();
    const surname = userInfo?.surname?.trim();
    const gender = userInfo?.gender;

    const styleLower = style.toLowerCase();

    const personalization = (() => {
        if (styleLower.includes('professional')) {
            if (name) return `Address the user by name once (e.g., "${name}")`;
            return 'Use a neutral closing without a name';
        }
        if (name) return `Use the name naturally once (e.g., "${name}")`;
        return 'Keep it neutral without using a name';
    })();

    return `
-----------------------------
CLOSER (Conversation closing)
-----------------------------
You are closing the conversation with a short, polished closing message.

Requirements:
- Style: ${style}
- Length: 1–3 sentences. No emojis. No Markdown headers. Avoid lists.
- Personalization: ${personalization}.
- Acknowledge the user's progress/completed tasks if evident from the conversation.
- Thank the user and offer future availability (e.g., "If you need anything else, I'm here"), without opening a new thread of questions.
- Do NOT ask for new inputs or introduce new tasks.

Conversation History:
${conversationHistory ?? '(no prior context)'}

User profile (if available):
${JSON.stringify({ name, surname, gender }, null, 2)}

[!] IMPORTANT: Respond in: "${language.toUpperCase()}"
`.trim();
}