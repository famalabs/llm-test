import { LMAInput } from "../interfaces";

const DIMENSIONS = `-----------------------------
Dimensions (all in [-1 … 1] using S):
-----------------------------
  - polarity: -1 negative <-> 1 positive
  - involvement: -1 apathetic (menefreghista) <-> 1 collaborative
  - energy: -1 annoyed <-> 1 enthusiastic
  - temper: -1 angry <-> 1 calm
  - mood: -1 sad <-> 1 happy
  - empathy: -1 cold <-> 1 warm
  - tone: -1 concise <-> 1 talkative
  - registry: -1 formal <-> 1 informal`;

const RULES=`-----------------------------
RULES for analysis:
-----------------------------
  - read the TEXT carefully, then assign scores according to the definitions above.
  - take your time to consider the context and nuances of the text.
  - ensure that your scores reflect the overall sentiment and tone of the text.`;



export const SINGLE_USER_MESSAGE_PROMPT = (textBlock: LMAInput['message']) => `You are a precise sentiment rater. Score the text on the dimensions below.
General rules:
  1) Each score MUST be one of the seven discrete values S = [-1, -0.6, -0.3, 0, 0.3, 0.6, 1]. No other numbers are allowed.
  2) If your internal estimate falls between two values, snap to the nearest in S.
  3) Base scores only on the provided content.
  4) If this is a conversation, score the overall interaction (single set of scores, not per turn).
  5) Use -1 when the user is offensive, hateful, or discriminatory.

${DIMENSIONS}

${RULES}

-----------------------------
INPUT
-----------------------------
TEXT:"""
${textBlock}
"""
`.trim();

export const WHOLE_CONVERSATION_PROMPT = (conversation: LMAInput['history']) => `You are a precise sentiment rater. 
Score the whole conversation on the dimensions below.

General rules:
  1) Each score MUST be one of the seven discrete values S = [-1, -0.6, -0.3, 0, 0.3, 0.6, 1]. No other numbers are allowed.
  2) If your internal estimate falls between two values, snap to the nearest in S.
  3) Base scores only on the provided content.
  4) If this is a conversation, score the overall interaction (single set of scores, not per turn).
  5) Use -1 when the user is offensive, hateful, or discriminatory.
  6) You have of course to evaluate only the user messages, not the chatbot replies.

${DIMENSIONS}

${RULES}

-----------------------------
INPUT
-----------------------------
TEXT:"""
${conversation.map(el => `${el.sender.toUpperCase()}: ${el.message}`).join("\n==============\n")}
"""
`;


export const LAST_USER_MESSAGE_CONVERSATION_PROMPT = (conversation: LMAInput['history']) => `You are a precise sentiment rater. 
Score the conversation on the dimensions below.
Focus your analysis on the last user message, but consider the entire conversation for context.

General rules:
  1) Each score MUST be one of the seven discrete values S = [-1, -0.6, -0.3, 0, 0.3, 0.6, 1]. No other numbers are allowed.
  2) If your internal estimate falls between two values, snap to the nearest in S.
  3) Base scores only on the provided content.
  4) If this is a conversation, score the overall interaction (single set of scores, not per turn).
  5) Use -1 when the user is offensive, hateful, or discriminatory.
  6) You have to evaluate JUST THE LAST USER MESSAGE, not the chatbot replies.

${DIMENSIONS}

${RULES}

-----------------------------
INPUT
-----------------------------
TEXT:"""
${conversation.map(el => `${el.sender.toUpperCase()}: ${el.message}`).join("\n==============\n")}
"""
`;