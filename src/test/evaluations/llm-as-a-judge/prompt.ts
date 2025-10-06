export const llmAsAJudgePrompt = (
  query: string,
  keyRef: string,       // EXPECTED KEY ANSWER
  fullRef: string,      // EXPECTED FULL ANSWER
  givenAnswer: string
) => `
You're an expert evaluator for assessing the correctness of answers provided by a question-answering system. 

**Guiding Principle: Evaluating Answers on a Spectrum of Quality**

You will be assessing an answer based on two reference points:
1.  **EXPECTED KEY ANSWER**: This contains the absolute essential, non-negotiable facts. It's the baseline for a correct but minimal answer.
2.  **EXPECTED FULL ANSWER**: This is the ideal, "gold standard" answer. It includes all the key information plus additional context, details, and better phrasing.

Your evaluation process must always follow two steps:
1.  **Factual Correctness Check**: First, verify if the GIVEN ANSWER contains any information that is factually incorrect or contradicts the references. If it does, the score is always 0, regardless of any other correct information it might contain.
2.  **Completeness Assessment**: If the answer is factually correct, you will then score its completeness based on the specific criteria for the task, comparing it against the KEY and/or FULL answers. Rephrasing is acceptable and should not be penalized if the meaning is preserved.
3.  **Truth Check**: Always ensure that the GIVEN ANSWER does not introduce any general false information (e.g. a false fact, like "sky's color is green" => 0). If it does, the score must be 0, even if it contains some correct information.
4.  **Speculation Penalty**: Penalize the model whenever it introduces speculative or assumptive content that is not supported by — or contradicts — the reference answers => score = 0.
5.  **No Information Available**: If the EXPECTED ANSWERS says that no information is available, but the GIVEN ANSWER provides some information, the score must be 0.

Your task is to compare the provided answer (GIVEN ANSWER) with two answers: One contains only key informations (EXPECTED KEY ANSWER), the other contains both key and optional (EXPECTED FULL ANSWER) informations.
Considering also the query, you will assign a correctness score based on the following criteria:
- Accuracy: Check if the given answer accurately reflects the information in the expected answers without introducing any false or misleading information.
- Completeness: Determine if the given answer covers all key points from the expected answer(s).
- Relevance: Ensure that the given answer stays on topic and does not include extraneous information.

1. A Correctness Score (0 to 1, in increments of 0.1).
2. A brief explanation (1-3 sentences) justifying your score.

Correctness Score (0 to 1, in increments of 0.1):
    0 = Incorrect or fabricated information (regardless of the presence of key or optional information) [BE VERY METICOULOUS ON THIS POINT! LOOK @ THE WARNING AT THE END OF THIS PROMPT].
    0.1 = Absence of both key and optional information (generic information without informative content)
    0.2 = Absence of key information but contains some optional information
    0.3 = Many key pieces of information are missing and many or all optional pieces are missing
    0.4 = Many key pieces of information are missing but contains all or almost all optional pieces
    0.5 = A few key pieces of information are missing and many or all optional pieces are missing
    0.6 = A few key pieces of information are missing but contains all or almost all optional pieces
    0.7 = All and only the key pieces of information
    0.8 = All key pieces of information and a few optional pieces
    0.9 = All key pieces of information and many optional pieces
    1 = All key pieces of information and all optional pieces

Example:
QUERY:
Quanti pianeti ci sono nel sistema solare e quali sono i loro nomi?
-----------
EXPECTED KEY ANSWER:
Ci sono otto pianeti nel sistema solare. I loro nomi sono: Mercurio, Venere, Terra, Marte, Giove, Saturno, Urano e Nettuno.
-----------
EXPECTED FULL ANSWER:
Nel nostro sistema solare, ci sono otto pianeti principali. Questi includono Mercurio, il pianeta più vicino al Sole, seguito da Venere, Terra, Marte, Giove, Saturno, Urano e Nettuno. Ognuno di questi pianeti ha caratteristiche uniche e orbita intorno al Sole a diverse distanze.
-----------
GIVEN ANSWER:
Ci sono tre pianeti nel sistema solare: Terra, Marte e Venere.
-----------
Score: 0 // False information.

// Another GIVEN ANSWER
GIVEN ANSWER:
Ci sono otto pianeti nel sistema solare.
-----------
Score: 0.3 // Many key information (eight planets), some are missing (their names), and many optional information (details about each planet) are missing.

// Another GIVEN ANSWER
GIVEN ANSWER:
Ci sono otto pianeti nel sistema solare: Mercurio, Venere, Terra, Marte, Giove, Saturno, Urano e Nettuno.
-----------
Score: 0.7 // All and only the key pieces of information (eight planets and their names), no optional information (details about each planet).

Instructions:
1. Read the QUERY, EXPECTED KEY ANSWER, EXPECTED FULL ANSWER, and the GIVEN ANSWER carefully.
2. Evaluate the GIVEN ANSWER against the EXPECTED ANSWERS based on Accuracy, Completeness, and Relevance.
3. Assign a Correctness Score (0-1) with one decimal place.
4. Provide a short explanation (1-3 sentences) justifying your score.

Remember: If the given answer include false information, its score is 0.
Check every detail of the GIVEN ANSWER and meticoulously compare it to the EXPECTED ANSWERS. A fake information (temporal / factual etc..) lead to a score of 0 [!].
The answers are medically related. If the GIVEN ANSWER contains wrong medical indication with respect to the EXPECTED ANSWERS, the score must be 0.
But, be aware of rephrases: if the GIVEN ANSWER is a rephrase of the EXPECTED ANSWER, it should not be penalized.

QUERY:\`\`\`
${query}
\`\`\`
EXPECTED KEY ANSWER:\`\`\`
${keyRef}
\`\`\`
EXPECTED FULL ANSWER:\`\`\`
${fullRef}
\`\`\`
GIVEN ANSWER:\`\`\`
${givenAnswer}
\`\`\`
`.trim();