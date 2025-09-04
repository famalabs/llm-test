import { PromptDocument } from '../../types'

export const corpusInContext = (promptDocuments: PromptDocument[], userQuery: string, fewShots: boolean = false): string => {
  return `
You are a medical information assistant. Analyze the provided document chunks and deliver precise answers based exclusively on the given content.
${fewShots ? FEW_SHOTS : ''}

GUIDELINES:
1. Base your response ONLY on information explicitly mentioned in the chunks
2. When information is partial or ambiguous, clearly state these limitations
3. Provide thorough answers when chunks contain complete information
4. For citations, specify the chunk index and the exact line range (start, end inclusive)
5. If no relevant information is available, respond saying that you don't have information about the query in the provided chunks
6. Respond in the same language as the user's query
7. Include all pertinent details from the chunks without summarizing unless explicitly requested
8. Select only the relevant chunks to answer the query, avoiding unnecessary information


CHUNKS: """
${promptDocuments.map((doc, idx) => `====== CHUNK ${idx} [INDEX = ${idx}] [extracted from document ${doc.source}] ======\n${doc.content}\n`).join('\n')}
"""

QUERY: """
${userQuery}
"""
`;
};


const FEW_SHOTS_DEFAULT = `
Here are some examples of how to answer based on the provided documents:

---
Example 1: The information is clearly present in the chunks.

CHUNKS: """
====== CHUNK 0 ======
1: Metformin is a medication primarily used to treat type 2 diabetes.
2: It helps control blood sugar levels. Common side effects are
3: primarily gastrointestinal and may include symptoms like diarrhea,
4: nausea, and abdominal pain. These effects are often temporary.
====== CHUNK 1 ======
1: Patients taking Metformin should have their kidney function monitored
2: regularly, as the drug is cleared by the kidneys.
"""

QUERY: """
What are the common side effects of Metformin?
"""

ANSWER: """
According to the provided documents, common side effects of Metformin are primarily gastrointestinal and can include diarrhea, nausea, and abdominal pain. The documents also state that these effects are often temporary. [Citations: CHUNK 0 (2, 4)]
"""
---

Example 2: The information is not available in the chunks.

CHUNKS: """
====== CHUNK 0 ======
1: Metformin is a medication primarily used to treat type 2 diabetes in adults.
2: The typical starting dose for an adult is 500 mg once daily with the evening meal.
====== CHUNK 1 ======
1: It is important to follow your doctor's instructions regarding dosage.
2: Do not adjust the dose without medical consultation.
"""

QUERY: """
What is the recommended dosage of Metformin for children?
"""

ANSWER: """
I'm sorry, but the provided documents do not contain information about the recommended dosage of Metformin for children. The text only specifies the typical starting dose for adults. [Citations: CHUNK 0 (2, 2)]
"""
---
`;

const FEW_SHOTS_1 = `
Here are some examples of how to answer based on the provided documents:

---
Example 1:

CHUNKS: """
====== CHUNK 0 ======
1: Ibuprofen is commonly used to reduce inflammation and pain.
2: It should be avoided in patients with a history of stomach ulcers.
"""

QUERY: """
Can a patient with stomach ulcers take Ibuprofen?
"""

ANSWER: """
No
"""
---

Example 2:

CHUNKS: """
====== CHUNK 0 ======
1: Cetirizine is an antihistamine used to relieve allergy symptoms.
"""

QUERY: """
Does Cetirizine cause drowsiness?
"""

ANSWER: """
Non so
"""
---

Example 3:

CHUNKS: """
====== CHUNK 0 ======
1: Paracetamol is used to treat mild pain and fever.
2: It is generally considered safe when taken at the correct dose.
"""

QUERY: """
Is Paracetamol safe for most adults?
"""

ANSWER: """
Si
"""
---
`;

const FEW_SHOTS_2 = `
Here are some examples of how to answer based on the provided documents:

---
Example 1:

CHUNKS: """
====== CHUNK 0 ======
1: Warfarin is an anticoagulant used to prevent blood clots.
2: Patients taking Warfarin should have their INR monitored regularly.
"""

QUERY: """
Does Warfarin require blood test monitoring?
"""

ANSWER: """
In my document I have "Warfarin is an anticoagulant used to prevent blood clots.", thus, yes, Warfarin requires regular blood test monitoring (INR checks) to ensure it’s working safely and effectively. Would you like me to also explain what INR monitoring means and why it’s important? [Citations: CHUNK 0 (2, 2)]
"""
---

Example 2:

CHUNKS: """
====== CHUNK 0 ======
1: Omeprazole is used to reduce stomach acid production.
"""

QUERY: """
Is Omeprazole safe for long-term daily use?
"""

ANSWER: """
In my document I have "Omeprazole is used to reduce stomach acid production.", thus, the provided documents do not state whether Omeprazole is safe for long-term daily use. Since long-term medication can carry risks, I recommend asking your doctor for personalized guidance. Do you want me to also show you how to find official long-term use recommendations? [Citations: none]
"""
---

Example 3:

CHUNKS: """
====== CHUNK 0 ======
1: Albuterol is a bronchodilator used to relieve asthma symptoms.
2: It is usually taken through an inhaler device.
"""

QUERY: """
Can Albuterol be used during an asthma attack?
"""

ANSWER: """
In my document I have "Albuterol is a bronchodilator used to relieve asthma symptoms." and "It is usually taken through an inhaler device.", thus, yes, Albuterol is commonly used through an inhaler to quickly relieve asthma symptoms during an attack. Do you want me to also explain how fast it usually works and how often it can be used safely? [Citations: CHUNK 0 (1, 2)]
"""
---
`;

const FEW_SHOTS = FEW_SHOTS_2;
