import { generateObject } from "ai";
import { resolveCitations } from "../lib/chunks/citations";
import { addLineNumbers } from "../lib/nlp";
import z, {  ZodType } from "zod";
import { Chunk, Citation } from "../lib/chunks/interfaces";
import { Rag } from "./rag";
import { ragCorpusInContext } from "../lib/prompt";
import { getLLMProvider } from "./factory";

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

        const {
            chunksOrAnswerFormat,
            fewShotsEnabled,
            includeCitations,
            reasoningEnabled
        } = config;

        if (chunksOrAnswerFormat == 'chunks') {
            return chunks;
        }

        else if (chunksOrAnswerFormat == 'answer') {

            const responseSchema: Record<string, ZodType> = {
                answer: z.string(),
                citations: z.array(
                    z.object({
                        chunkIndex: z.number(),
                        startLine: z.number(),
                        endLine: z.number()
                    })
                ),
                reasoning: z.string()
            }

            if (!includeCitations) {
                delete responseSchema.citations;
            }

            if (!reasoningEnabled) {
                delete responseSchema.reasoning;
            }

            const { object: result } = await generateObject({
                model: (await getLLMProvider(config.provider!))(config.llm!),
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
            }) as {
                object: {
                    answer: string;
                    citations?: Citation[];
                    reasoning?: string;
                };
            };

            const answer: string = result.answer;
            const citations: Citation[] | undefined = result?.citations;
            const reasoning: string | undefined = result?.reasoning;

            return { answer, citations, reasoning, chunks };
        }

        else {
            throw new Error(`Unsupported output format: ${config.chunksOrAnswerFormat}`);
        }
    }

    return agentToolFunction;
}

export const ragAnswerToString = async (ragAnswer: AnswerFormatInterface | Chunk[], rag: Rag): Promise<string> => {

    if (rag.getConfig().chunksOrAnswerFormat !== 'answer') {
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