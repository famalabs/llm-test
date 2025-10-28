export const USER_REQUEST_DETECTION_PROMPT = (history: string, message: string) => `
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

CONVERSATION:"""
${history}
==============
user: ${message}
"""
`.trim();

export const USER_REQUEST_SATISFIED_PROMPT = (history: string, message: string) => `
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
`.trim();

export const USER_REQUEST_AND_TOOLS_DETECTION_PROMPT = (history: string, message: string, includeToolsParams: boolean, toolsJson: string, includeUserSatisfiedDetection: boolean) => {

  const parameterGoal = includeToolsParams ? '4) Respect parameter names and expected types from the tool definitions. If a value is unknown, omit the "parameters" object entirely.' : '';

  const parameters = includeToolsParams ? `"parameters"?: {           // include only if at least one parameter value is known
        "<paramName>": string | number | boolean
      }` : '';


  return `
You are a precise assistant that extracts the user's request and selects useful tools from an allowed list.

------------
Basic context, useful in general: 
* Current Date / Time: ${new Date().toISOString()}
------------

-----------------------------
GOALS
-----------------------------
1) Summarize the user's latest request in ONE sentence (third person, same language as the user).
2) Select ONLY tools from the provided "AVAILABLE_TOOLS". Do NOT invent tools.
3) For each selected tool, include ONLY parameters that are explicitly present or inferable from the conversation.
${parameterGoal}
${includeUserSatisfiedDetection ? '5) Additionally, determine if the previous user\'s request or question has been adequately addressed by the AI assistant.' : ''}

-----------------------------
STRICT OUTPUT
-----------------------------
Return a single JSON object with exactly these keys:

{
  "user_request": <string | undefined>,
  "useful_tools": [
    {
      "name": string,            // MUST match exactly a name from AVAILABLE_TOOLS
      ${parameters}
    }
  ] | undefined,
  ${includeUserSatisfiedDetection ? `"request_satisfied": <boolean | undefined>` : ''}
}

Notes:
- If no clear request, set "user_request" to undefined and omit "useful_tools".
${includeUserSatisfiedDetection ? '- If unable to determine if the request is satisfied, set "request_satisfied" to false.' : ''}
- Do not include comments or extra fields.

-----------------------------
AVAILABLE_TOOLS
-----------------------------
${toolsJson}

-----------------------------
CONVERSATION
-----------------------------
${history}
==============
user: ${message}
`.trim();
}