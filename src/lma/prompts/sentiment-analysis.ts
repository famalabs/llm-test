const DIMENSIONS = `-----------------------------
Dimensions (all in [-1 … 1] using S):
-----------------------------
  - polarity:        -1 negative       <-> 1 positive
  - involvement:     -1 apathetic      <-> 1 collaborative
  - energy:          -1 annoyed        <-> 1 enthusiastic
  - temper:          -1 angry          <-> 1 calm
  - mood:            -1 sad            <-> 1 happy
  - empathy:         -1 cold           <-> 1 warm
  - tone:            -1 concise        <-> 1 talkative
  - registry:        -1 formal         <-> 1 informal`;

const RULES = (scoreSet: string) => `-----------------------------
RULES for rating:
-----------------------------
  1) Allowed values: S = ${scoreSet}. No other values are permitted.
  2) If your internal estimate is between two values in S, SNAP to the closest one.
  3) Consider the meaning of each dimension INDEPENDENTLY from the others.
  4) Use -1 if the text contains offensive, hateful, discriminatory or hostile language.
  5) Evaluate based on the user's language and tone only (do not infer unstated emotions).
  6) A neutral or factual message → likely 0 on most dimensions (but not mandatory).
  7) Always prioritize linguistic evidence over speculation.
  8) When evaluating conversations, aggregate the user's attitude and tone across messages, not the chatbot's.`;

export const SINGLE_USER_MESSAGE_PROMPT = (message: string, scoreSet: string) => `
You are an expert sentiment rater. 
Your task is to assign a single set of sentiment scores for the USER MESSAGE below.

${DIMENSIONS}
${RULES(scoreSet)}

-----------------------------
EVALUATION FOCUS:
-----------------------------
- Evaluate ONLY the text provided (no external inference).
- Output ONE value per dimension.
- Reflect the global sentiment and tone conveyed.

-----------------------------
INPUT
-----------------------------
USER MESSAGE:
"""
${message}
"""
`.trim();


export const WHOLE_CONVERSATION_PROMPT = (history: string, scoreSet: string) => `
You are an expert sentiment rater.
Your task is to assign ONE set of sentiment scores representing the overall tone of the USER across the entire conversation.

${DIMENSIONS}
${RULES(scoreSet)}

-----------------------------
EVALUATION FOCUS:
-----------------------------
- Evaluate ONLY the USER messages (ignore chatbot responses completely).
- Consider how the user's language, tone, mood, and emotional state evolve during the conversation.
- Reflect the overall impression (not just the last message).

-----------------------------
INPUT (Conversation)
-----------------------------
${history}
`.trim();


export const LAST_USER_MESSAGE_CONVERSATION_PROMPT = (history: string, message: string, scoreSet: string) => `
You are an expert sentiment rater.
Your task is to assign ONE set of sentiment scores representing the tone of the LAST USER MESSAGE,
taking into account the previous context only as support.

${DIMENSIONS}
${RULES(scoreSet)}

-----------------------------
EVALUATION FOCUS:
-----------------------------
- Base the scores primarily on the last user message.
- Use previous turns only to better interpret tone and emotional state.
- Do NOT score chatbot replies.
- Do not infer emotions beyond what is linguistically evident.

-----------------------------
INPUT (Conversation + Last Message)
-----------------------------
${history}

LAST USER MESSAGE:
"""
${message}
"""
`.trim();
