export const CHAT_HISTORY_SUMMARIZATION_PROMPT = (
  partialHistory: string,
  previousSummary?: string,
  maximumSentences?: number
) => {

  const previousSummaryIndications = previousSummary ? `4. **Merge the PREVIOUS SUMMARY with the NEW MESSAGES** into a single, coherent, logically ordered summary.
   - Do NOT copy exact wording from the previous summary; rewrite and condense.
   - Preserve key facts and the chronological flow.
   - Remove redundancies and merge overlapping information.
   - If needed, rewrite parts of the previous summary to better integrate the new content.
   ` : '';

  const maximumSentencesIndications = maximumSentences ? `${previousSummary ? '5' : '4'
    }. STRICT CONSTRAINT: The final summary must be a maximum of ${maximumSentences} sentences.
   - Each sentence must end with a period.
   - If the previous summary was longer, rewrite and compress it.
   - Do NOT exceed this sentence limit under any circumstances.
   ` : '';

  return `
You are an expert at **summarizing chat histories** between a user and an AI assistant.
Your goal is to **replace the oldest part of the conversation** with a short, accurate, and logically structured summary that preserves all essential context.

-----------------------------
TASK
-----------------------------
1. Summarize the conversation segment below in a compact but precise way.
2. Preserve all critical information needed to understand the remaining conversation.
3. Focus on:
   - Main topics, user goals, and key questions
   - Important assistant responses
   - Relevant decisions, technical details, or definitions introduced
${previousSummaryIndications}
${maximumSentencesIndications}

-----------------------------
OUTPUT FORMAT
-----------------------------
Return ONLY a JSON object with the following structure:
{
  "summary": "<FINAL SUMMARY TEXT>"
}

- Do not include any explanations or commentary.
- Ensure the summary is a single paragraph with clear sentences.
- Do not use bullet points or lists.

-----------------------------
INPUT
-----------------------------

${previousSummary ? `PREVIOUS SUMMARY:\n"""\n${previousSummary}\n"""\n\n` : ""}

HISTORY:
"""
${partialHistory}
"""
`.trim();
};
