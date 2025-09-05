import { ragChatbotSystemPrompt } from "./chatbot-corpus-in-context";
import { ragCorpusInContext } from "./rag-corpus-in-context";
import { rerankingPrompt } from "./reranking";
import { evaluationSystemPrompt } from "./evaluation";

export const allPrompts = {
    reranking: rerankingPrompt, 
    ragCorpusInContext,
    ragChatbotSystemPrompt,
    evaluationSystemPrompt
}