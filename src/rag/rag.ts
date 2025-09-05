import { Chunk, Citation, PromptDocument } from "../types";
import { VectorStore } from "../vector-store/vector-store";
import { getDocumentLines } from "../lib/documents";
import { allPrompts } from "../lib/prompt";
import z from "zod";
import { generateObject, tool } from "ai";
import { mistral } from "@ai-sdk/mistral";
import { RagConfig, ResolvedRagConfig } from "./interfaces";
import {addLineNumbers} from "../lib/nlp";
import { resolveCitations } from "../lib/citations";

export class Rag {
    private readonly config: ResolvedRagConfig;
    private vectorStore: VectorStore;
    private isInitialized: boolean = false;

    private static readonly DEFAULT_CONFIG = {
        llm: "mistral-small-latest",
        numResults: 10,
        output: {
            reasoningEnabled: false,
            documentsOrAnswerFormat: 'documents',
            includeCitations: false,
            fewShotsEnabled: false,
        },
        reranking: {
            enabled: false,
            llm: "mistral-small-latest",
            fewShotsEnabled: false,
            batchSize: 5,
            llmEvaluationWeight: 0.7,
            reasoningEnabled: false,
        },
        parentPageRetrieval: {
            enabled: false,
            offset: 0,
        }
    };

    constructor(ragConfig: RagConfig) {
        this.config = this.resolveConfig(ragConfig);
    }

    private resolveConfig(ragConfig: RagConfig): ResolvedRagConfig {
        const { DEFAULT_CONFIG } = Rag;

        return {
            vectorStoreName: ragConfig.vectorStoreName,
            llm: ragConfig.llm ?? DEFAULT_CONFIG.llm,
            numResults: ragConfig.numResults ?? DEFAULT_CONFIG.numResults,
            output: {
                reasoningEnabled: ragConfig?.output?.reasoningEnabled ?? DEFAULT_CONFIG.output.reasoningEnabled,
                documentsOrAnswerFormat: (ragConfig?.output?.documentsOrAnswerFormat ?? DEFAULT_CONFIG.output.documentsOrAnswerFormat) as 'documents' | 'answer',
                includeCitations: ragConfig?.output?.includeCitations ?? DEFAULT_CONFIG.output.includeCitations,
                fewShotsEnabled: ragConfig?.output?.fewShotsEnabled ?? DEFAULT_CONFIG.output.fewShotsEnabled,
            },
            reranking: {
                enabled: ragConfig.reranking?.enabled ?? DEFAULT_CONFIG.reranking.enabled,
                llm: ragConfig.reranking?.llm ?? DEFAULT_CONFIG.reranking.llm,
                fewShotsEnabled: ragConfig.reranking?.fewShotsEnabled ?? DEFAULT_CONFIG.reranking.fewShotsEnabled,
                batchSize: ragConfig.reranking?.batchSize ?? DEFAULT_CONFIG.reranking.batchSize,
                llmEvaluationWeight: ragConfig.reranking?.llmEvaluationWeight ?? DEFAULT_CONFIG.reranking.llmEvaluationWeight,
                reasoningEnabled: ragConfig.reranking?.reasoningEnabled ?? DEFAULT_CONFIG.reranking.reasoningEnabled,
            },
            parentPageRetrieval: {
                enabled: ragConfig.parentPageRetrieval?.enabled ?? DEFAULT_CONFIG.parentPageRetrieval.enabled,
                offset: ragConfig.parentPageRetrieval?.offset ?? DEFAULT_CONFIG.parentPageRetrieval.offset,
            },
        };
    }

    public getLLM() {
        return this.config.llm;
    }

    public getAgentTool() {
        if (!this.isInitialized) {
            throw new Error("Rag instance is not initialized. Please call the init() method first.");
        }

        const agentToolFunction = async (question: string):Promise<string|Chunk[]> => {
            const chunks = await this.search(question);

            if (this.config.output.documentsOrAnswerFormat == 'documents') {
                return chunks;
            }

            else if (this.config.output.documentsOrAnswerFormat == 'answer') {
                // we have to generate an answer, using the retrieved documents as context and corpus-in-context prompt, 
                // eventually, with reasoning and fewShots.

                const {
                    fewShotsEnabled, 
                    includeCitations, 
                    reasoningEnabled
                } = this.config.output;

                const responseSchema : any= {
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
                    model: mistral(this.config.llm),
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
                throw new Error(`Unsupported output format: ${this.config.output.documentsOrAnswerFormat}`);
            }
        }

        return tool({
            description: `Get informations from your knowledge base to answer questions.`,
            inputSchema: z.object({
                question: z.string().describe('the users question'),
            }),
            execute: async ({ question }) => await agentToolFunction(question),
        })
    }

    public printSummary() {
        const {
            llm,
            vectorStoreName,
            numResults,
            reranking,
            parentPageRetrieval,
            output
        } = this.config;

        const summary = `====== RAG SYSTEM CONFIGURATION =====\n
        LLM = ${llm}, 
        VECTOR STORE = ${vectorStoreName},
        NUM RESULTS = ${numResults},
        RERANKING = ${reranking.enabled ? 'ENABLED' : 'DISABLED'} (LLM: ${reranking.llm}, FEW SHOTS: ${reranking.fewShotsEnabled}, BATCH SIZE: ${reranking.batchSize}, LLM EVAL WEIGHT: ${reranking.llmEvaluationWeight}, REASONING: ${reranking.reasoningEnabled}),
        PARENT PAGE RETRIEVAL = ${parentPageRetrieval.enabled ? 'ENABLED' : 'DISABLED'} (OFFSET: ${parentPageRetrieval.offset}),
        OUTPUT = (FORMAT: ${output.documentsOrAnswerFormat}, REASONING: ${output.reasoningEnabled})\n\n==================================`;

        console.log(summary);
    }

    public async init(): Promise<void> {
        if (this.isInitialized) {
            console.warn("Rag instance is already initialized.");
            return;
        }

        this.vectorStore = new VectorStore(this.config.vectorStoreName);
        await this.vectorStore.load();

        this.runPreflightChecks();
        this.isInitialized = true;
    }

    private runPreflightChecks(): void {
        const { numResults, reranking, parentPageRetrieval, output } = this.config;

        if (this.vectorStore.size === 0) {
            throw new Error("Vector store is empty. Please add data before running queries.");
        }

        if (numResults < 1) {
            throw new Error(`Invalid numResults value: ${numResults}. It must be at least 1.`);
        }

        if (parentPageRetrieval.offset < 0) {
            throw new Error(`Invalid parent page retrieval offset: ${parentPageRetrieval.offset}. It cannot be negative.`);
        }

        if (parentPageRetrieval.offset > 0 && !parentPageRetrieval.enabled) {
            throw new Error("Parent page retrieval offset is provided, but the feature is disabled.");
        }

        if (reranking.reasoningEnabled && !reranking.enabled) {
            throw new Error("Reasoning is enabled, but reranking is disabled. Reranking must be enabled to use reasoning.");
        }

        if (output.reasoningEnabled && output.documentsOrAnswerFormat !== 'answer') {
            throw new Error("Output reasoning is enabled, but output format is not set to 'answer'. To use reasoning, set output format to 'answer'.");
        }

        if (output.fewShotsEnabled && output.documentsOrAnswerFormat !== 'answer') {
            throw new Error("Output few-shots is enabled, but output format is not set to 'answer'. To use few-shots, set output format to 'answer'.");
        }

        if (output.includeCitations && output.documentsOrAnswerFormat !== 'answer') {
            throw new Error("Output include citations is enabled, but output format is not set to 'answer'. To include citations, set output format to 'answer'.");
        }
    }

    async search(query: string): Promise<Chunk[]> {
        if (!this.isInitialized) {
            throw new Error("Rag instance is not initialized. Please call the init() method first.");
        }

        let chunks = await this.vectorStore.retrieveFromText(query, this.config.numResults);

        if (this.config.reranking.enabled) {
            chunks = await this.rerankChunks(query, chunks);
        }

        if (this.config.parentPageRetrieval.enabled) {
            chunks = await this.retrieveParentPage(chunks);
        }

        return chunks;
    }

    async rerankChunks(query: string, chunks: Chunk[]): Promise<Chunk[]> {
        const {
            llm,
            batchSize,
            llmEvaluationWeight,
            reasoningEnabled,
            fewShotsEnabled
        } = this.config.reranking;

        const groupedChunks: Chunk[][] = [];
        for (let i = 0; i < chunks.length; i += batchSize) {
            groupedChunks.push(chunks.slice(i, i + batchSize));
        }

        for (const group of groupedChunks) {
            const promptDocuments: PromptDocument[] = group.map(c => ({ content: c.pageContent, source: c.metadata.source }));
            const prompt = allPrompts.reranking(
                promptDocuments,
                query,
                reasoningEnabled,
                fewShotsEnabled
            );

            const rankingSchema: Record<string, z.ZodTypeAny> = {
                index: z.number(),
                score: z.number().min(0).max(1)
            };

            if (reasoningEnabled) {
                rankingSchema.reasoning = z.string();
            }

            const { object: result } = await generateObject({
                model: mistral(llm),
                prompt,
                schema: z.object({
                    rankings: z.array(
                        z.object(rankingSchema)
                    ),
                })
            });

            const { rankings } = result;

            for (const ranking of rankings as ({ index: number, score: number, reasoning?: string })[]) {
                const { index, score } = ranking;
                // Since we're scoring distance, we invert the score (1 - score)
                group[index].distance = (1 - llmEvaluationWeight) * group[index].distance + llmEvaluationWeight * (1 - score);

                if (reasoningEnabled && ranking.reasoning) {
                    console.log('Adding reasoning ->', ranking.reasoning);
                }
            }
        }

        const rerankedResults = [...groupedChunks.flat()].sort((a, b) => a.distance - b.distance);

        return rerankedResults;
    }

    async retrieveParentPage(chunks: Chunk[]): Promise<Chunk[]> {
        const { offset } = this.config.parentPageRetrieval;

        const mergeLineIntervals = (chunks: Chunk[]): Chunk[] => {
            const sorted = [...chunks].sort((a, b) => a.metadata.loc.lines.from - b.metadata.loc.lines.from);
            const merged: Chunk[] = [];

            for (const curr of sorted) {
                if (merged.length === 0) {
                    merged.push(curr);
                    continue;
                }

                const prev = merged[merged.length - 1];
                if (curr.metadata.loc.lines.from <= prev.metadata.loc.lines.to) {
                    prev.metadata.loc.lines.to = Math.max(prev.metadata.loc.lines.to, curr.metadata.loc.lines.to);
                } else {
                    merged.push(curr);
                }
            }

            return merged;
        };

        const extendChunkLines = (chunk: Chunk, offset: number, totalLines: number): Chunk => {
            const from = Math.max(1, chunk.metadata.loc.lines.from - offset);
            const to = Math.min(totalLines, chunk.metadata.loc.lines.to + offset);
            return {
                ...chunk,
                metadata: {
                    ...chunk.metadata,
                    loc: {
                        ...chunk.metadata.loc,
                        lines: { from, to }
                    }
                }
            };
        };

        const chunksBySource: Record<string, Chunk[]> = {};
        for (const c of chunks) {
            if (!chunksBySource[c.metadata.source]) {
                chunksBySource[c.metadata.source] = [];
            }
            chunksBySource[c.metadata.source].push(c);
        }

        const result: Chunk[] = [];

        for (const [source, sourceChunks] of Object.entries(chunksBySource)) {
            const lines = await getDocumentLines(source);
            const totalLines = lines.length;

            const extended = sourceChunks.map(c => extendChunkLines(c, offset, totalLines));
            const merged = mergeLineIntervals(extended);

            // Restore order (distance based...smallest distance first)
            merged.sort((a, b) => a.distance - b.distance);

            for (const { metadata, distance } of merged) {
                const { from, to } = metadata.loc.lines;
                const content = lines.slice(from - 1, to).join("\n");

                result.push({
                    pageContent: content,
                    metadata,
                    distance
                });
            }
        }

        return result;
    }
}