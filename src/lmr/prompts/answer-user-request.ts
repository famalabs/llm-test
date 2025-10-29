export const ANSWER_USER_REQUEST_PROMPT = (history: string, userRequest:string, userInfo: string, language:string) => {
    return `Generate a response to the user request based on the following context.
User Request: ${userRequest}
User Info: ${userInfo}
Conversation History: ${history}

[!] VERY IMPORTANT: Respond in ${language.toUpperCase()}.
`.trim();
}