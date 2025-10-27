export const TASK_ANALYSIS_PROMPT = (history: string, message: string, task: string) => `
You are an expert assistant specialized in analyzing **chat conversations between a chatbot and a user**.  
Your goal is to determine if the **user’s last message** responds to a **pending task** previously requested by the agent.

-----------------------------
DECISION RULES
-----------------------------
Classify the user’s last message into one of these statuses:

- **"answered"** → The user provides the requested information or confirms execution of the task.
- **"ignored"** → The user replies with something unrelated to the task.
- **"negated"** → The user explicitly refuses or states they cannot do the task now (e.g. “NO”, “I can't”, “I can't now”). A postponed execution counts as negated.
- **"wait"** → The user acknowledges the task, and says he/she is going to do it right now or soon.

-----------------------------
EXTRACTION RULES (if status = "answered")
-----------------------------
1. **Extract the answer** in the expected data type:
   - type = number → numeric value (e.g. 85)
   - type = boolean → true / false
     • true if the user confirms or implies execution (“yes”, “I've done it”)  
     • false if they deny or say “not yet”
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
→ answer: true, notes: "L'utente ha preso due pillole", status: "answered"

❌ BAD (unrelated note)  
Task: “Riporta i sintomi che presenti”  
User: “Mal di testa, comunque dopo voglio andare in farmacia”  
→ answer: "Mal di testa", notes: "L'utente vuole andare in famacia"  // going to the pharmacy is unrelated! The note should be null.

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


---

Input Task:
Name: "Prendi paracetamolo"
Type: "boolean"
Description: "L'utente deve prendere una pillola di paracetamolo."

Chat History:
AGENT: "Per favore, prendi una pillola di paracetamolo."
USER: "NO, ora no. Lo faccio dopo"
Output:
{
  "status": "negated",
  "answer": true,
  "notes": "L'utente ha rifiutato di prendere la pillola ora, ma lo farà più tardi."
}

-----------------------------
INPUT
-----------------------------

CHAT HISTORY:
${history}

USER LAST MESSAGE:
${message}

TASK TO EVALUATE:
${task}
`.trim();
