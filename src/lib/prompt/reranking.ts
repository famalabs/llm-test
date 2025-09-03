import { PromptDocument } from "../../types";

export const rerankingPrompt = (promptDocuments: PromptDocument[], userQuery: string, reasoning: boolean = false, fewShots: boolean = false): string =>  `
You are an expert system specialized in ranking text passages for Retrieval-Augmented Generation (RAG).

You will be given:
- A QUERY (the user's request or question).
- A set of retrieved chunks (CHUNKS) that may or may not be relevant to the query.

Your role is to carefully evaluate each block and assign it a relevance score, based only on how well it addresses the given query.
${reasoning ? REASONING : ''}
${fewShots ? FEW_SHOTS(reasoning) : ''}
Instructions:

1. Reasoning: 
   Analyze the block by identifying key information and how it relates to the query. Consider whether the block provides direct answers, partial insights, or background context relevant to the query. Explain your reasoning in a few sentences, referencing specific elements of the block to justify your evaluation. Avoid assumptions—focus solely on the content provided.

2. Relevance Score (0 to 1, in increments of 0.1):
   0 = Completely Irrelevant: The block has no connection or relation to the query.
   0.1 = Virtually Irrelevant: Only a very slight or vague connection to the query.
   0.2 = Very Slightly Relevant: Contains an extremely minimal or tangential connection.
   0.3 = Slightly Relevant: Addresses a very small aspect of the query but lacks substantive detail.
   0.4 = Somewhat Relevant: Contains partial information that is somewhat related but not comprehensive.
   0.5 = Moderately Relevant: Addresses the query but with limited or partial relevance.
   0.6 = Fairly Relevant: Provides relevant information, though lacking depth or specificity.
   0.7 = Relevant: Clearly relates to the query, offering substantive but not fully comprehensive information.
   0.8 = Very Relevant: Strongly relates to the query and provides significant information.
   0.9 = Highly Relevant: Almost completely answers the query with detailed and specific information.
   1 = Perfectly Relevant: Directly and comprehensively answers the query with all the necessary specific information.

3. Additional Guidance:
   - Objectivity: Evaluate block based only on their content relative to the query.
   - Clarity: Be clear and concise in your justifications.
   - No assumptions: Do not infer information beyond what's explicitly stated in the block.

CHUNKS: """
${promptDocuments.map((doc, idx) => `====== CHUNK ${idx} [INDEX = ${idx}] [extracted from document ${doc.source}] ======\n${doc.content}\n`).join('\n')}
"""

QUERY: """
${userQuery}
"""
`

const REASONING = `
When formulating your answer, provide reasoning for your conclusions. Explain how specific information from the chunks supports your response, especially when dealing with partial or ambiguous data. This will help clarify the basis of your answers and enhance their reliability.
`;

const FEW_SHOTS = (reasoning: boolean) =>  `
Here are three examples of how to evaluate relevance with multiple chunks per query:

---
Example 1:
QUERY: "What are the symptoms of diabetes?"
====== CHUNK 0 [INDEX = 0] [extracted from document medical_journal] ======
Increased thirst and frequent urination are common signs.
${reasoning ? 'Reasoning: Directly mentions two main symptoms of diabetes. This is a very relevant piece of information that partially answers the query.': ''}
Relevance Score: 0.8
====== CHUNK 1 [INDEX = 1] [extracted from document medical_journal] ======
Extreme fatigue and unexplained weight loss may occur.
${reasoning ? 'Reasoning: Adds more specific symptoms, complementing the information in other chunks. This is highly relevant to the user\'s query.': ''}
Relevance Score: 0.9
====== CHUNK 2 [INDEX = 2] [extracted from document health_blog] ======
Diabetes affects blood sugar levels and requires monitoring.
${reasoning ? 'Reasoning: Provides general background about the condition but does not list any symptoms. It is topically related but doesn\'t directly answer the question. Moderately relevant.': ''}
Relevance Score: 0.5
---

Example 2:
QUERY: "How does a blockchain work?"
====== CHUNK 0 [INDEX = 0] [extracted from document tech_explainer] ======
A blockchain is a distributed, immutable ledger.
${reasoning ? 'Reasoning: This chunk provides a high-level definition of what a blockchain *is*, but it does not explain *how* it works. It\'s a useful starting point but incomplete. Fairly relevant.': ''}
Relevance Score: 0.6
====== CHUNK 1 [INDEX = 1] [extracted from document crypto_whitepaper] ======
Transactions are grouped into blocks, and each block is cryptographically linked to the previous one, forming a chain.
${reasoning ? 'Reasoning: This explains a key part of the mechanism (grouping transactions, cryptographic linking), directly addressing the \'how\' in the query. Very relevant.': ''}
Relevance Score: 0.8
====== CHUNK 2 [INDEX = 2] [extracted from document financial_news] ======
The stock market reached a new all-time high yesterday.
${reasoning ? 'Reasoning: The content is completely unrelated to blockchain technology. Irrelevant.': ''}
Relevance Score: 0.0
====== CHUNK 3 [INDEX = 3] [extracted from document tech_blog] ======
Bitcoin is a popular cryptocurrency that uses blockchain technology for its public ledger.
${reasoning ? 'Reasoning: This chunk provides an example of blockchain\'s use but doesn\'t explain its mechanics. The connection is tangential. Slightly relevant.': ''}
Relevance Score: 0.3
---
`;