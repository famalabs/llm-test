import { Chunk } from '../chunks/interfaces';
import { LanguageLabel } from '../nlp';

export const RAG_CORPUS_IN_CONTEXT_PROMPT = (userQuery: string, promptDocuments: Chunk[], {
  detectedLanguage, fewShots = false, reasoning = false, includeCitations = false
}: {
  detectedLanguage?: LanguageLabel, fewShots?: boolean, reasoning?: boolean, includeCitations?: boolean
}): string => {

  const answerLanguage = detectedLanguage ? detectedLanguage.toUpperCase() : 'the language of the user\'s query';

  return `
You are a medical information assistant. Analyze the provided documents and deliver precise answers based exclusively on the given content.

------------
Basic context, useful in general: 
* Current Date / Time: ${new Date().toISOString()}
------------

GUIDELINES:
1. Base your answer ONLY on the information explicitly provided.
2. When information is partial or ambiguous, clearly state these limitations.
3. Provide complete answers when full information is available.
4. If no relevant information is available, say - using ${answerLanguage} - that you don't have information to answer the user's question.
5. Provide the answer in ${answerLanguage}, regardless of the language of the source documents or any other context.
6. Include all pertinent details from the documents without summarizing unless explicitly requested.
7. Select only the relevant documents to answer the question, avoiding unnecessary information.
8. Make sure you're not copying sections of text verbatim; instead, synthesize the information into a coherent response.
${includeCitations ? '9. For citations, specify the document index and the exact line range (start, end inclusive). The citations must not be included in the answer, just in the provided structure to fill. If you have adjacent citations, separated only by blank space, just return a merged citations. Do not include the citation details within the answer.' : ''}
${reasoning ? (includeCitations ? '10.' : '9.') + ' Provide a brief reasoning for your answer, explaining how you derived it from the documents' : ''}

${fewShots ? FEW_SHOTS_ENG(reasoning, includeCitations) : ''}

DOCUMENTS: """
${promptDocuments.map((doc, idx) => `====== DOCUMENT ${idx} [INDEX = ${idx}] [extracted from source ${doc.source}] ======\n${doc.pageContent}\n`).join('\n')}
"""

USER'S QUESTION: """
${userQuery}
"""

STEP BY STEP INSTRUCTIONS:
1. Carefully read the user's question and identify the key information being requested.
2. Review the documents to find relevant information.
3. Formulate your answer in ${answerLanguage}, independently of the language of the documents. Do not shift language during the answer.
4. Follow the guidelines provided above.
5. If there is no relevant information in the documents, do not include any citations!
${reasoning ? '6. Provide your reasoning.' : ''}`.trim();
};

const FEW_SHOTS_ENG = (reasoning: boolean, includeCitations: boolean) => {
  const fmtAnswer = (
    answer: string,
    citations?: { chunkIndex: number; startLine: number; endLine: number }[],
    reasoningText?: string
  ) => {
    const output: Record<string, any> = {
      answer: answer.trim(),
    };
    if (includeCitations && citations) output["citations"] = citations;
    if (reasoning && reasoningText) output["reasoning"] = reasoningText.trim();
    return JSON.stringify(output, null, 2);
  };

  return `
Here are some examples of how to answer based on the provided documents (all in English):

---
Example 1: The information is clearly present in the documents.

DOCUMENTS: """
====== DOCUMENT 0 ======
1: Metformin is a medication primarily used to treat type 2 diabetes.
2: It helps control blood sugar levels. Common side effects are
3: primarily gastrointestinal and may include symptoms like diarrhea,
4: nausea, and abdominal pain. These effects are often temporary.
====== DOCUMENT 1 ======
1: Patients taking Metformin should have their kidney function monitored
2: regularly, as the drug is cleared by the kidneys.
"""

USER'S QUESTION: """
What is a common side effect of Metformin?
"""

OUTPUT:
${fmtAnswer(
    'Common side effects of Metformin are primarily gastrointestinal and may include diarrhea, nausea, and abdominal pain. These effects are often temporary.',
    [{ chunkIndex: 0, startLine: 2, endLine: 4 }],
    "The answer is directly found in DOCUMENT 0, lines 2–4, which list the common gastrointestinal side effects."
  )}

===

WRONG OUTPUT EXAMPLE: """
${fmtAnswer(
    "A common side effect of Metformin is hypoglycemia.",
    [{ chunkIndex: 0, startLine: 2, endLine: 4 }]
  )}
"""

---

Example 2: The information is not available in the documents.

DOCUMENTS: """
====== DOCUMENT 0 ======
1: Metformin is a medication primarily used to treat type 2 diabetes in adults.
2: The typical starting dose for an adult is 500 mg once daily with the evening meal.
====== DOCUMENT 1 ======
1: It is important to follow your doctor's instructions regarding dosage.
2: Do not adjust the dose without medical consultation.
"""

USER'S QUESTION: """
What is the recommended dosage of Metformin for children?
"""

OUTPUT:
${fmtAnswer(
    "I'm sorry, I can't find information about the recommended dosage of Metformin for children. The text only specifies the typical starting dose for adults.",
    [],
    "The documents only provide dosage information for adults, with no mention of pediatric dosing. I will not return any citation since I don't have relevant information."
  )}

===

WRONG OUTPUT EXAMPLE:
${fmtAnswer(
    "The recommended dosage of Metformin for children is 500 mg once daily with the evening meal.",
    [{ chunkIndex: 0, startLine: 2, endLine: 2 }]
  )}

---

Example 3: The information is partially available; do not infer beyond the text.

DOCUMENTS: """
====== DOCUMENT 0 ======
1: Metformin is a medication primarily used to treat type 2 diabetes.
2: It helps control blood sugar levels. Common side effects are
3: primarily gastrointestinal and may include symptoms like diarrhea,
4: nausea, and abdominal pain. These effects are often temporary.
====== DOCUMENT 1 ======
1: Patients taking Metformin should have their kidney function monitored
2: regularly, as the drug is cleared by the kidneys.
3: There are no studies confirming that Metformin is effective for type 1 diabetes.
"""

USER'S QUESTION: """
Can Metformin be used to treat type 1 diabetes?
"""

OUTPUT:
${fmtAnswer(
    "There are no studies confirming that Metformin is effective for type 1 diabetes.",
    [{ chunkIndex: 1, startLine: 3, endLine: 3 }],
    "DOCUMENT 1, line 3 states there are no studies confirming Metformin's effectiveness for type 1 diabetes, so we cannot claim it is used for that purpose."
  )}

===

WRONG OUTPUT EXAMPLE:
${fmtAnswer(
    "Yes, Metformin can be used to treat type 1 diabetes.",
    [{ chunkIndex: 1, startLine: 3, endLine: 3 }]
  )}
`.trim();
};
