import { Chunk } from '../../types'

export const ragCorpusInContext = (promptDocuments: Chunk[], userQuery: string, fewShots: boolean = false, reasoning: boolean = false, includeCitations : boolean = false): string => {
 return `
You are a medical information assistant. Analyze the provided documents and deliver precise answers based exclusively on the given content.
${fewShots ? FEW_SHOTS(reasoning, includeCitations) : ''}

GUIDELINES:
1. Base your answer ONLY on the information explicitly provided.
2. When information is partial or ambiguous, clearly state these limitations.
3. Provide complete answers when full information is available.
4. If no relevant information is available, say that you don't have information to answer the user's question.
5. Answer in the same language as the user's question, independently from the language of the documents. If the question is in Italian, answer in Italian; if in English, answer in English; if the question is in another language, answer in the same language.
6. Include all pertinent details from the documents without summarizing unless explicitly requested.
7. Select only the relevant documents to answer the question, avoiding unnecessary information.
${includeCitations ? '8. For citations, specify the document index and the exact line range (start, end inclusive). The citations must not be included in the answer, just in the provided structure to fill.' : ''}
${reasoning ? (includeCitations ? '9.' : '8.') + ' Provide a brief reasoning for your answer, explaining how you derived it from the documents' : ''}

DOCUMENTS: """
${promptDocuments.map((doc, idx) => `====== DOCUMENT ${idx} [INDEX = ${idx}] [extracted from source ${doc.metadata.source}] ======\n${doc.pageContent}\n`).join('\n')}
"""

USER'S QUESTION: """
${userQuery}
"""
`;
};


const FEW_SHOTS = (reasoning:boolean, includeCitations:boolean) => `
Here are some examples of how to answer based on the provided documents:

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
Qual è un effetto collaterale comune del Metformin?
"""

ANSWER: """
Effetti collaterali comuni del Metformin sono principalmente gastrointestinali e possono includere diarrea, nausea e dolore addominale. Gli effetti sono spesso temporanei. ${includeCitations ? '[Citazioni: DOCUMENT 0 (2, 4)]' : ''}
"""

${reasoning ? "Reasoning: La risposta è direttamente trovata in DOCUMENT 0, righe 2 a 4, che elencano gli effetti collaterali comuni del Metformin." : ''}

WRONG ANSWER EXAMPLE: """
Un effetto collaterale comune del Metformin è l'ipoglicemia. ${includeCitations ? '[Citazioni: DOCUMENT 0 (2, 4)]' : ''}
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

ANSWER: """
I'm sorry, I can't find information about the recommended dosage of Metformin for children. The text only specifies the typical starting dose for adults. ${includeCitations ? '[Citations: DOCUMENT 0 (2, 2)]' : ''}
"""

${reasoning ? "Reasoning: The documents only provide dosage information for adults, with no mention of children." : ''}

WRONG ANSWER EXAMPLE: """
The recommended dosage of Metformin for children is 500 mg once daily with the evening meal. ${includeCitations ? '[Citazioni: DOCUMENT 0 (2, 2)]' : ''}
"""

---

Example 3: The information is partially available in the documents, and you should not interpret or assume anything beyond what is explicitly stated.

DOCUMENTS: """
====== DOCUMENT 0 ======
1: Metformin is a medication primarily used to treat type 2 diabetes.
2: It helps control blood sugar levels. Common side effects are
3: primarily gastrointestinal and may include symptoms like diarrhea,
4: nausea, and abdominal pain. These effects are often temporary.
====== DOCUMENT 1 ======
1: Patients taking Metformin should have their kidney function monitored
2: regularly, as the drug is cleared by the kidneys.
3: There are not studies confirming that Metformin is effective for type 1 diabetes. 
"""

USER'S QUESTION: """
Can Metformin be used to treat type 1 diabetes?
"""

ANSWER: """
There are no studies confirming that Metformin is effective for type 1 diabetes. ${includeCitations ? '[Citations: DOCUMENT 1 (3, 3)]' : ''}
"""

${reasoning ? "Reasoning: DOCUMENT 1, line 3 states that there are no studies confirming Metformin's effectiveness for type 1 diabetes, indicating it is not used for that purpose." : ''}

WRONG ANSWER EXAMPLE: """
Metformin cannot be used to treat type 1 diabetes. ${includeCitations ? '[Citations: DOCUMENT 1 (3, 3)]' : ''}
"""
`;
