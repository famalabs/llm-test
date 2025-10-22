export const USER_REQUEST_DETECTION_PROMPT = (message: string) => `
You are a precise assistant that extracts and summarizes user requests from conversations.
Given the user's latest message, identify if there is a clear request or question directed at the AI assistant.

-----------------------------
TASK
-----------------------------
1. Analyze the user's message carefully.
2. If the user is asking for information, help, or action, extract and *summarize* that request concisely.
3. If there is no clear request, leave the output empty.

-----------------------------
OUTPUT:
-----------------------------
- If a request is found, return it as a brief summary (one sentence). The sentence should be put in third person: e.g. "The user wants to have a consultation with a doctor." . IMPORTANTLY, the sentence should use the same language as the user message.
- If no request is present, leave the output empty.

-----------------------------
OUTPUT FORMAT:
-----------------------------
{
  "user_request": <string | undefined>
}

-----------------------------
EXAMPLES
-----------------------------

Input Message: "Puoi aiutarmi a prenotare una visita dal medico?"
Output:
{
  "user_request": "L'utente vuole prenotare una visita dal medico."
}


-----------------------------
INPUT
-----------------------------

USER MESSAGE:"""
${message}
"""
`

export const REQUEST_SATISFIED_PROMPT = (history: string, message: string) => `
You are a precise assistant that determines if a user's request has been satisfied in a conversation with an AI assistant.

-----------------------------
TASK:
-----------------------------
1. Analyze the entire conversation carefully, focusing on the user's latest message.
2. Determine if the user's request or question has been adequately addressed by the AI assistant.
3. Consider whether the user seems satisfied or if they are likely to need further assistance.

-----------------------------
OUTPUT:
-----------------------------
- Return true if the user's request appears to be satisfied.
- Return false if the user seems unsatisfied or if their request was not adequately addressed.

-----------------------------
OUTPUT FORMAT:
-----------------------------
{
  "request_satisfied": <boolean | undefined>
}

CONVERSATION:"""
${history}
==============
user: ${message}
"""
`;
