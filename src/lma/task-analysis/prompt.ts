import { InputTask, LMAInput } from "../interfaces";

export const TASK_ANALYSIS_PROMPT = (message: string, task: InputTask, history: LMAInput['history']) => `
You are an expert assistant specialized in analyzing **chat conversations between a chatbot and a user**.  
Your goal is to determine if the **user’s last message** responds to a **pending task** previously requested by the agent.

-----------------------------
DECISION RULES
-----------------------------
Classify the user’s last message into one of these statuses:

- **"answered"** → The user provides the requested information or confirms execution of the task.
- **"ignored"** → The user replies with something unrelated to the task.
- **"negated"** → The user explicitly refuses or states they cannot do the task now (e.g. “non posso”, “non riesco ora”).
- **"wait"** → The user acknowledges the task but postpones it (e.g. “ok lo faccio dopo”, “aspetta un attimo”).

-----------------------------
EXTRACTION RULES (if status = "answered")
-----------------------------
1. **Extract the answer** in the expected data type:
   - type = number → numeric value (e.g. 85)
   - type = boolean → true / false
     • true if the user confirms or implies execution (“sì”, “l’ho fatto”)  
     • false if they deny or say “non ancora”
   - type = string → the descriptive text provided by the user

2. **Add notes ONLY if the user provides extra details** that are:
   - directly relevant to the task
   - clarifying, modifying, or contextualizing the main answer

   ❌ Do not add notes for:
   - unrelated info
   - redundant info already implied by the answer
   - generic comments not tied to the task

-----------------------------
✅ GOOD / ❌ BAD NOTES EXAMPLES
-----------------------------

✅ GOOD  
Task: “Take 1 pill of paracetamol”  
User: “Ne ho prese due”  
→ answer: true, notes: "L'utente ha preso due pillole"

❌ BAD (unrelated note)  
Task: “Riporta i sintomi che presenti”  
User: “Mal di testa, comunque dopo voglio andare in farmacia”  
→ answer: "Mal di testa", notes: undefined  // going to the pharmacy is unrelated

✅ GOOD  
Task: “Take 1 pill of paracetamol”  
User: “Ne ho presa una”  
→ answer: true, notes: undefined

-----------------------------
📌 ADDITIONAL GUIDELINES
-----------------------------
- Be concise and accurate.
- Infer implicit confirmations (e.g. “sì” = answered true).
- Tolerate natural speech, informal language, emojis, and typos.
- If the user acknowledges but doesn’t actually provide/execute → use "wait".

-----------------------------
OUTPUT FORMAT (JSON)
-----------------------------
{
  "status": "answered" | "ignored" | "negated" | "wait",
  "answer": string | number | boolean | null,
  "notes": string | null
}

-----------------------------
EXAMPLES
-----------------------------

Input Task:
Name: "Prendi paracetamolo"
Type: "boolean"
Description: "L'utente deve prendere una pillola di paracetamolo."

Chat History:
AGENT: "Prendi una pillola di paracetamolo."
USER: "Ok, l'ho presa adesso 😊"

Output:
{
  "status": "answered",
  "answer": true,
  "notes": null
}

---

Input Task:
Name: "Prendi tachipirina"
Type: "boolean"
Description: "L'utente deve prendere una pasticca di tachipirina."

Chat History:
AGENT: "Prendi una pasticca di tachipirina."
USER: "Ne ho prese 2 per sicurezza 😊, comunque voglio andare in farmacia dopo."

Output:
{
  "status": "answered",
  "answer": true,
  "notes": "L'utente ha preso due pasticche di tachipirina, invece di una."
}

-----------------------------
INPUT
-----------------------------

CHAT HISTORY:
${history.map(h => `${h.sender.toUpperCase()}: ${h.message}`).join('\n')}

USER LAST MESSAGE:
${message}

TASK TO EVALUATE:
Name: ${task.name}
Type: ${task.type}
Description: ${task.description}
`.trim();


export const TASK_ANALYSIS_AND_USER_REQUEST_PROMPT = (
  message: string,
  task: { name: string; type: string; description: string } | null,
  history: { sender: string; message: string }[]
) => `
You are an expert assistant specialized in analyzing **conversations between a user and an AI assistant**.  
Your goals are:
1. **Extract and summarize any user request** expressed in the last user message.  
2. **Determine whether the user's previous request was satisfied**.
3. **Evaluate the relationship between the user's last message and any pending task**, classifying their response and extracting structured information if applicable.

======================================================================
SECTION 1 — USER REQUEST DETECTION
======================================================================
TASK:
- Carefully analyze the user's last message.
- If the user asks for information, help, or action, extract and summarize that request concisely.
- If no request is present, leave the output empty.

GUIDELINES:
- The request must be expressed in third person, e.g. "L'utente vuole prenotare una visita dal medico."
- The language of the output must match the language of the user's message.
- If no clear request is present → \`user_request\` = null.

OUTPUT FIELD:
"user_request": string | null

EXAMPLE:
Input: "Puoi aiutarmi a prenotare una visita dal medico?"
→ "user_request": "L'utente vuole prenotare una visita dal medico."

======================================================================
SECTION 2 — REQUEST SATISFACTION
======================================================================
TASK:
- Analyze the conversation history and the last user message.
- Determine if the user's previous request (if any) has been adequately addressed by the assistant.
- If the user seems satisfied → \`true\`.
- If unsatisfied or still pending → \`false\`.
- If there was no clear request → \`null\`.

OUTPUT FIELD:
"request_satisfied": boolean | null

======================================================================
SECTION 3 — TASK ANALYSIS (if a task is provided)
======================================================================
GOAL:
- Check if the user's last message is related to the **pending task** previously requested by the agent.

DECISION RULES — classify the user’s last message as:
- "answered" → The user provides the requested information or confirms execution.
- "ignored" → The user replies with something unrelated.
- "negated" → The user refuses or says they can’t do it.
- "wait" → The user acknowledges but postpones.

EXTRACTION RULES (if status = "answered"):
- Extract the answer based on task.type:
  - number → numeric value
  - boolean → true or false
  - string → descriptive text
- Add \`notes\` only for extra relevant details (not redundant or unrelated).

ADDITIONAL GUIDELINES:
- Be concise and accurate.
- Tolerate informal language, typos, emojis.
- If the user acknowledges but does not provide the requested info → "wait".

OUTPUT FIELDS:
"task": {
  "status": "answered" | "ignored" | "negated" | "wait" | null,
  "answer": string | number | boolean | null,
  "notes": string | null
}

======================================================================
FINAL OUTPUT FORMAT (JSON)
======================================================================
{
  "user_request": string | null,
  "request_satisfied": boolean | null,
  "task": {
    "status": "answered" | "ignored" | "negated" | "wait" | null,
    "answer": string | number | boolean | null,
    "notes": string | null
  }
}

======================================================================
CONVERSATION CONTEXT
======================================================================
${history.map(h => `${h.sender.toUpperCase()}: ${h.message}`).join('\n')}
==============
USER: ${message}

${task ? `\nTASK TO EVALUATE:
Name: ${task.name}
Type: ${task.type}
Description: ${task.description}` : '(No pending task provided)'}
`.trim();
