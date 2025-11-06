export const TASK_ANALYSIS_PROMPT = (history: string, message: string, task: string, type: string) => {
  return `
You are an expert assistant specialized in analyzing **chat conversations between a chatbot and a user**.  
Your goal is to determine if the **user’s last message** responds to a **pending task** previously requested by the agent.

-----------------------------
DECISION RULES
-----------------------------
Classify the user’s last message into one of these statuses:

- **"answered"** → The user provides the requested information or confirms execution of the task.

- **"ignored"** → The user replies with something unrelated to the task. (e.g. "I don't know", "What time is it?", "Can I avoid it?" (this last example is "ignored" because it doesn't confirm or deny execution))

- **"negated"** → The user refuses the task or postpones it to a non-immediate moment. Any “later” (e.g., later today, tonight, tomorrow) counts as **negated**.  
  *Examples:* “No.” / “I can’t now.” / “I’ll do it later.”
  [VERY IMPORTANT]: IN ORDER TO EVALUATE THE TASK STATUS AS NEGATED THE REFUSAL MUST REGARD THE TASK, NOT SURROUNDING CIRCUMSTANCES.

- **"wait"** → The user confirms they will do the task **immediately** or **very soon**, showing clear imminent action.  
  *Examples:* “Doing it now.” / “One sec.” / “Starting.”

-----------------------------
EXTRACTION RULES (if status = "answered")
-----------------------------
1. **Extract the answer** in the expected data type:
   - type = number → numeric value (e.g. 85)
   - type = boolean → true / false
     • true if the user confirms or implies execution (“yes”, “I've done it”)  
     • false if they deny or say “not yet”
   - type = string → the descriptive text provided by the user

   [!] Very important: the type for the answer to extract is -> ${type} <-
   
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
- Infer implicit confirmations (e.g. “yes” = answered true).
- Tolerate natural speech, informal language, emojis, and typos.
- If the user acknowledges but doesn’t actually provide/execute → use "wait".

-----------------------------
CONTEXT LINKING & DISAMBIGUATION
-----------------------------
To avoid confusion when the user says only “yes/no/ok/i don't know” or gives a brief reply:

- Always bind the user's last message to the MOST RECENT agent message/question.
- Mark "negated" ONLY IF the refusal clearly targets the task itself OR directly answers a recent agent question/reminder about the task (e.g., “Have you taken it?”, "Are you doing it now?"). 
- If the last agent message is about a DIFFERENT topic (e.g., “Do you want to know more…?”, small talk, or informational question), then a user reply like “no” refers to THAT question, NOT to the task → classify as "ignored" (do not set "negated").
- Short/ambiguous replies ("i don't know", "boh", "mah") are "ignored" unless they explicitly confirm/deny or commit to immediate action regarding the task.

-----------------------------
OUTPUT FORMAT (JSON)
-----------------------------
{
  "status": "answered" | "ignored" | "negated" | "wait",
  "answer": ${type} | null,
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
Name: "Controlla quanta tachipirina hai preso"
Type: "number"
Description: "L'utente deve indicare quante pasticche di tachipirina ha preso."

Chat History:
AGENT: "Dimmi quante pasticche di tachipirina hai preso oggi."
USER: "Ne ho prese 2 per sicurezza 😊, comunque voglio andare in farmacia dopo."

Output:
{
  "status": "answered",
  "answer": 2,
  "notes": null
}


---

Input Task:
Name: "Prendi paracetamolo"
Type: "boolean"
Description: "L'utente deve prendere una pillola di paracetamolo."

Chat History:
AGENT: "Per favore, prendi una pillola di paracetamolo."
USER: "No, lo farò più tardi."
Output:
{
  "status": "negated",
  "answer": false,
  "notes": "L'utente rimanda l'esecuzione a un momento successivo."
}

---

Input Task:
Name: "Mettere crema antibiotica"
Type: "boolean"
Description: "L'utente deve applicare una crema antibiotica sulla ferita."

Chat History:
AGENT: "Hai avuto modo di pulire la ferita?"
USER: "Sì, l'ho risciacquata con acqua."
AGENT: "Perfetto. Adesso dovresti applicare una crema antibiotica sottile sulla zona."
USER: "Mh, non so se la ho."
AGENT: "Tranquillo, controlla nel kit di pronto soccorso o in bagno! Ce l'hai una crema tipo gentamicina o bacitracina?"
USER: "Qualcosa forse sì."
AGENT: "Ok, se vuoi posso dirti come riconoscerla dalla confezione. Vuoi che ti aiuti?"
USER: "No."

Output:
{
  "status": "ignored", // the "no" refers to the offer of help, not to the task, thus it is NOT "negated", it's just "ignored"
  "answer": null,
  "notes": null
}


---

Input Task:
Name: "Prendi paracetamolo"
Type: "boolean"
Description: "L'utente deve prendere una pillola di paracetamolo."

Chat History:
AGENT: "Hai preso la pillola di paracetamolo?"
USER: "No."

Output:
{
  "status": "negated",
  "answer": false,
  "notes": null
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

----
VERY IMPORTANT: the type for the answer to extract is -> ${type} | null (no other type allowed)
VERY IMPORTANT (2): Mark the task as negated only if the refusal is directed at the task itself, not at external circumstances / not if he's answering another question.
----
`.trim();
}