import { generateObject } from "ai";
import { resolveCitations } from "../lib/citations";
import { mistral } from "@ai-sdk/mistral";
import { allPrompts } from "../lib/prompt";
import { addLineNumbers } from "../lib/nlp";
import z from "zod";
import { Chunk, Citation } from "../types";
import { Rag } from "./rag";

export const getRagAgentToolFunction = (rag: Rag) => {

    const config = rag.getConfig();
    const isInitialized = rag.getIsInitialized();

    if (!isInitialized) {
        throw new Error("Rag instance is not initialized. Please call the init() method first.");
    }

    const agentToolFunction = async (question: string): Promise<string | Chunk[]> => {
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
                prompt: allPrompts.ragCorpusInContext(
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

            const answer = result.answer;
            const citations = result?.citations;
            const reasoning = result?.reasoning;

            return (
                'TOOL ANSWER: ' + answer + '\n\n' +
                (citations ? 'CITATIONS: ' + await resolveCitations(citations as Citation[], chunks) : '') + '\n\n' +
                (reasoning ? 'REASONING: ' + reasoning : '')
            )
        }

        else {
            throw new Error(`Unsupported output format: ${config.output.chunksOrAnswerFormat}`);
        }
    }

    return agentToolFunction;
}
