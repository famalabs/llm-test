import { ragChatbotSystemPrompt } from "./chatbot-corpus-in-context";
import { ragCorpusInContext } from "./rag-corpus-in-context";
import { rerankingPrompt } from "./reranking";

export const allPrompts = {
    reranking: rerankingPrompt, 
    ragCorpusInContext,
    ragChatbotSystemPrompt
}