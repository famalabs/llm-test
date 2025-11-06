export const USER_REQUEST_DETECTION_PROMPT = (history: string, message: string) => `
You are an assistant that detects whether the user's latest message contains a **request related to medical or therapy topics**.

-----------------------------
DEFINITION OF REQUEST
-----------------------------
A request is present **only if** both conditions hold:
1. The message **asks for something** (help, advice, clarification, action, explanation, suggestion, recommendation, etc.)
2. The content is **related to a medical or therapy context**.

If the user is simply:
- stating something,
- reporting a situation,
- describing symptoms without asking,
- expressing feelings,
- asking rhetorical or non-actionable questions,

then **no request is present**.

-----------------------------
WHAT TO RETURN
-----------------------------
If a request is present:
- Return a short **third-person summary** of the request in the **same language** used by the user.

If no request is present:
- Return \`"user_request": undefined\`.

-----------------------------
OUTPUT FORMAT (STRICT)
-----------------------------
{
  "user_request": string | undefined
}

-----------------------------
EXAMPLES
-----------------------------
Message: "Puoi aiutarmi a prenotare una visita dal medico?"
→ { "user_request": "L'utente chiede aiuto per prenotare una visita dal medico." }

Message: "Mi fa male la schiena da ieri."
→ { "user_request": undefined } // no request, only a report

Message: "Cosa significa la dose che mi ha dato il dottore?"
→ { "user_request": "L'utente chiede una spiegazione sulla dose prescritta." }

Message: "It's 33 degrees."
→ { "user_request": undefined }

-----------------------------
INPUT
-----------------------------
CONVERSATION:
"""
${history}
==============
user: ${message}
"""

-----------------------------
REMINDER
-----------------------------
- Return ONLY the JSON object, no explanations.
- If there is no request, set "user_request" to undefined.
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

export const USER_REQUEST_AND_TOOLS_DETECTION_PROMPT = (history: string, message: string, includeToolsParams: boolean, toolsJson: string) => {

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
  ] | undefined
}

Notes:
- If no clear request, set "user_request" to undefined and omit "useful_tools" (set it to null).
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