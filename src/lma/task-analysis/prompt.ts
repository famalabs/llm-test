import { InputTask, LMAInput } from "../interfaces";

export const TASK_ANALYSIS_PROMPT = (message: string, task: InputTask, history: LMAInput['history']) => `
You are an expert assistant specialized in analyzing **chat conversations between a chatbot and a user**.  
Your goal is to understand whether the **user’s last message** answers a **pending task previously requested by the agent**.

-----------------------------
INSTRUCTIONS:
-----------------------------
1. Determine if the user **answered** the task, **ignored** it, **negated** it, or is in a **wait** state.
   - answered → The user provides the requested info or confirms execution.
   - ignored → The user writes something unrelated to the task.
   - negated → The user explicitly refuses or says they cannot complete the task now (e.g. “non posso”, “non riesco ora”).
   - wait → The user acknowledges the task but postpones it (e.g. “ok lo faccio dopo”, “aspetta un attimo”).

2. If status = "answered":
   - Extract the **answer** in the proper type:
       • number → numerical value (e.g., 85)
       • boolean → true/false (e.g., “yes”, “no”, “l’ho fatto” → true; “non ancora” → false)
       • string → free text if the answer is descriptive
   - Add **notes** only if the user provides extra details beyond the expected answer.  
     Example:  
     Task = “Take 1 pill of paracetamol”  
     User = “Ne ho prese due”  
     → answer: true, notes: "L'utente ha preso due pillole"

3. Be precise and concise:
   - Infer implicit confirmations (e.g., “fatto” = answered true).
   - Consider language variations, natural speech, emojis, typos.
   - If the message is vague but clearly acknowledges the task, use “wait”.

-----------------------------
OUTPUT FORMAT (JSON)
-----------------------------
{
  "status": "answered" | "ignored" | "negated" | "wait",
  "answer": string | number | boolean (only if answered),
  "notes": string (only if answered and extra details are provided)
}

-----------------------------
INPUT
-----------------------------

CHAT HISTORY:"""
${history.map(h => `${h.sender.toUpperCase()}: ${h.message}`).join('\n')}
"""

USER LAST MESSAGE:"""
${message}
"""

TASK TO EVALUATE:"""
Name: ${task.name}
Type: ${task.type}
Description: ${task.description}
"""
`.trim();
