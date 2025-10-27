export const CHAT_HISTORY_SUMMARIZATION_PROMPT = (partialHistory: string, previousSummary?: string) => {

  const previousSummaryIndications = previousSummary ? `4. **merge the PREVIOUS SUMMARY provided** with this new portion into a single coherent summary.
   - Do not repeat the exact same words already present in the previous summary.
   - Keep the chronological and logical flow.` : '';

  return `
You are an expert at summarizing chat conversations between a user and an AI assistant.
Your task is to **condense the OLDEST portion of the conversation** into a short, clear summary.
This summary will later replace the original messages to save context length.

-----------------------------
TASK
-----------------------------
1. The text below represents the **beginning of the chat history**, selected because the total conversation length exceeded a maximum threshold.
2. Your goal is to summarize this portion accurately and compactly while **preserving all key information** needed to understand the rest of the conversation.
3. Focus on:
   - Main topics and user goals
   - Key questions asked and relevant assistant responses
   - Important decisions, context, or technical details introduced early on
${previousSummaryIndications}

-----------------------------
OUTPUT FORMAT
-----------------------------
- Return a json object with a single field "summary" containing the new summary text.
{
  "summary": <string>
}

-----------------------------
INPUT
-----------------------------

${previousSummary ? `PREVIOUS SUMMARY:\n"""\n${previousSummary}\n"""\n\n` : ""}

HISTORY:"""
${partialHistory}
"""
`.trim();
}
