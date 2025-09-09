import { generateObject } from "ai";
import { resolveCitations } from "../lib/chunks/citations";
import { mistral } from "@ai-sdk/mistral";
import { addLineNumbers } from "../lib/nlp";
import z from "zod";
import { Chunk, Citation } from "../lib/chunks/interfaces";
import { Rag } from "./rag";
import { ragCorpusInContext } from "../lib/prompt";

export interface AnswerFormatInterface {
    answer: string;
    chunks: Chunk[];
    citations?: Citation[];
    reasoning?: string;
}

export const getRagAgentToolFunction = (rag: Rag) => {

    const config = rag.getConfig();
    const isInitialized = rag.getIsInitialized();

    if (!isInitialized) {
        throw new Error("Rag instance is not initialized. Please call the init() method first.");
    }

    const agentToolFunction = async (question: string): Promise<AnswerFormatInterface | Chunk[]> => {
        const chunks = await rag.search(question);

        if (config.output.chunksOrAnswerFormat == 'chunks') {
            return chunks;
        }

        else if (config.output.chunksOrAnswerFormat == 'answer') {
            const {
                fewShotsEnabled,
                includeCitations,
                reasoningEnabled
            } = config.output;

            const responseSchema: any = {
                answer: z.string(),
            }

            if (includeCitations) {
                responseSchema.citations = z.array(
                    z.object({
                        chunkIndex: z.number(),
                        startLine: z.number(),
                        endLine: z.number()
                    })
                )
            }

            if (reasoningEnabled) {
                responseSchema.reasoning = z.string();
            }

            const { object: result } = await generateObject({
                model: mistral(config.llm),
                prompt: ragCorpusInContext(
                    chunks.map((document) => ({
                        ...document,
                        pageContent: addLineNumbers(document.pageContent)
                    })),
                    question,
                    fewShotsEnabled,
                    reasoningEnabled,
                    includeCitations
                ),
                schema: z.object(responseSchema)
            });

            const answer: string = result.answer as string;
            const citations: Citation[] = result?.citations as Citation[];
            const reasoning: string = result?.reasoning as string;

            return { answer, citations, reasoning, chunks };
        }

        else {
            throw new Error(`Unsupported output format: ${config.output.chunksOrAnswerFormat}`);
        }
    }

    return agentToolFunction;
}

export const ragAnswerToString = async (ragAnswer: AnswerFormatInterface | Chunk[], rag: Rag): Promise<string> => {

    if (rag.getConfig().output.chunksOrAnswerFormat !== 'answer') {
        const error = "The RAG instance is not configured to return answers in AnswerFormatInterface format.";
        console.error(error);
        throw new Error(error);
    }

    const { answer, citations, reasoning, chunks } = ragAnswer as AnswerFormatInterface;

    return `
    Answer: ${answer}\n\n
    ${citations && citations.length > 0 ? 'Citations:\n' + await resolveCitations(citations, chunks) + '\n\n' : ''}
    ${reasoning ? 'Reasoning:\n\n' + reasoning : ''}
    `.trim();
}