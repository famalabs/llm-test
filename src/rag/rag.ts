import { Chunk, PromptDocument } from "../types";
import { VectorStore } from "../vector-store/vector-store";
import { getDocumentLines } from "../lib/documents";
import { allPrompts } from "../lib/prompt";
import z from "zod";
import { generateObject } from "ai";
import { mistral } from "@ai-sdk/mistral";
import { RagConfig, ResolvedRagConfig } from "./interfaces";

export class Rag {
    private readonly config: ResolvedRagConfig;
    private vectorStore: VectorStore;
    private isInitialized: boolean = false;

    private static readonly DEFAULT_CONFIG = {
        llm: "mistral-small-latest",
        numResults: 10,
        chunkFiltering: {
            enabled: false,
            thresholdMultiplier: 0.66,
        },
        output: {
            reasoningEnabled: false,
            chunksOrAnswerFormat: 'chunks',
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
            chunkFiltering: {
                enabled: false,
                thresholdMultiplier: 0.66,
            }
        },
        parentPageRetrieval: {
            enabled: false,
            offset: 0,
        },
        verbose: false,
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
            chunkFiltering : {
                enabled: ragConfig.chunkFiltering?.enabled ?? DEFAULT_CONFIG.chunkFiltering.enabled,
                thresholdMultiplier: ragConfig.chunkFiltering?.thresholdMultiplier ?? DEFAULT_CONFIG.chunkFiltering.thresholdMultiplier,
            },
            output: {
                reasoningEnabled: ragConfig?.output?.reasoningEnabled ?? DEFAULT_CONFIG.output.reasoningEnabled,
                chunksOrAnswerFormat: (ragConfig?.output?.chunksOrAnswerFormat ?? DEFAULT_CONFIG.output.chunksOrAnswerFormat) as 'chunks' | 'answer',
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
                chunkFiltering: {
                    enabled: ragConfig.reranking?.chunkFiltering?.enabled ?? DEFAULT_CONFIG.reranking.chunkFiltering.enabled,
                    thresholdMultiplier: ragConfig.reranking?.chunkFiltering?.thresholdMultiplier ?? DEFAULT_CONFIG.reranking.chunkFiltering.thresholdMultiplier,
                }
            },
            parentPageRetrieval: {
                enabled: ragConfig.parentPageRetrieval?.enabled ?? DEFAULT_CONFIG.parentPageRetrieval.enabled,
                offset: ragConfig.parentPageRetrieval?.offset ?? DEFAULT_CONFIG.parentPageRetrieval.offset,
            },
            verbose: ragConfig.verbose ?? DEFAULT_CONFIG.verbose,
        };
    }

    public getConfig() {
        return this.config;
    }

    public getIsInitialized() {
        return this.isInitialized;
    }

    private log(...args: any[]) {
        if (this.config.verbose) {
            console.log('[RAG]', ...args);
        }
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
        CHUNK FILTERING = ${this.config.chunkFiltering.enabled ? 'ENABLED' : 'DISABLED'}${this.config.chunkFiltering.enabled ? ' (THRESHOLD MULTIPLIER: ' + this.config.chunkFiltering.thresholdMultiplier + ')' : ''},
        RERANKING = ${reranking.enabled ? 'ENABLED' : 'DISABLED'} (LLM: ${reranking.llm}, FEW SHOTS: ${reranking.fewShotsEnabled}, BATCH SIZE: ${reranking.batchSize}, LLM EVAL WEIGHT: ${reranking.llmEvaluationWeight}, REASONING: ${reranking.reasoningEnabled}, CHUNK-FILTERING: ${reranking.chunkFiltering.enabled ? 'ENABLED' : 'DISABLED'}${reranking.chunkFiltering.enabled ? ', THRESHOLD MULTIPLIER: ' + reranking.chunkFiltering.thresholdMultiplier : ''}),
        PARENT PAGE RETRIEVAL = ${parentPageRetrieval.enabled ? 'ENABLED' : 'DISABLED'} (OFFSET: ${parentPageRetrieval.offset}),
        OUTPUT = (FORMAT: ${output.chunksOrAnswerFormat}, REASONING: ${output.reasoningEnabled})\n\n==================================`;

        console.log(summary);
        return summary;
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

        if (output.reasoningEnabled && output.chunksOrAnswerFormat !== 'answer') {
            throw new Error("Output reasoning is enabled, but output format is not set to 'answer'. To use reasoning, set output format to 'answer'.");
        }

        if (output.fewShotsEnabled && output.chunksOrAnswerFormat !== 'answer') {
            throw new Error("Output few-shots is enabled, but output format is not set to 'answer'. To use few-shots, set output format to 'answer'.");
        }

        if (output.includeCitations && output.chunksOrAnswerFormat !== 'answer') {
            throw new Error("Output include citations is enabled, but output format is not set to 'answer'. To include citations, set output format to 'answer'.");
        }

        if (reranking.chunkFiltering.enabled && !reranking.enabled) {
            throw new Error("Chunk filtering is enabled, but reranking is disabled. Reranking must be enabled to use chunk filtering.");
        }

        if (reranking.chunkFiltering.enabled && (reranking.chunkFiltering.thresholdMultiplier <= 0 || reranking.chunkFiltering.thresholdMultiplier >= 1)) {
            throw new Error("Chunk filtering thresholdMultiplier must be between 0 and 1 (exclusive).");
        }

        if (this.config.chunkFiltering.enabled && (this.config.chunkFiltering.thresholdMultiplier <= 0 || this.config.chunkFiltering.thresholdMultiplier >= 1)) {
            throw new Error("Chunk filtering thresholdMultiplier must be between 0 and 1 (exclusive).");
        }

        this.log("Preflight checks passed.");
    }

    public async search(query: string): Promise<Chunk[]> {
        if (!this.isInitialized) {
            throw new Error("Rag instance is not initialized. Please call the init() method first.");
        }

        let chunks = await this.vectorStore.retrieveFromText(query, this.config.numResults);

        if (this.config.chunkFiltering.enabled) {
            chunks = this.applyChunkFiltering(
                chunks, 
                this.config.chunkFiltering.thresholdMultiplier
            );
        }

        if (this.config.reranking.enabled) {
            chunks = await this.rerankChunks(query, chunks);
        }

        if (this.config.parentPageRetrieval.enabled) {
            chunks = await this.retrieveParentPage(chunks);
        }

        return chunks;
    }

    public async rerankChunks(query: string, chunks: Chunk[]): Promise<Chunk[]> {
        const {
            llm,
            batchSize,
            llmEvaluationWeight,
            reasoningEnabled,
            fewShotsEnabled
        } = this.config.reranking;

        this.log('Running reranking on', chunks.length, 'chunks...');

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
            }
        }

        let rerankedResults = [...groupedChunks.flat()].sort((a, b) => a.distance - b.distance);

        if (this.config.reranking.chunkFiltering.enabled) {
            rerankedResults = this.applyChunkFiltering(
                rerankedResults,
                this.config.reranking.chunkFiltering.thresholdMultiplier
            );
        }

        return rerankedResults;
    }

    public applyChunkFiltering(chunks: Chunk[], thresholdMultiplier: number): Chunk[] {
        const min = chunks.reduce((acc, chunk) => Math.min(acc, chunk.distance), Infinity);
        const threshold = 1 - ((1 - min) * thresholdMultiplier);
        chunks = chunks.filter(c => c.distance <= threshold);

        this.log('Chunk filtering applied. Threshold:', threshold.toFixed(4), '->', chunks.length, 'chunks remain after filtering.');

        return chunks;
    }

    public async retrieveParentPage(chunks: Chunk[]): Promise<Chunk[]> {
        const { offset } = this.config.parentPageRetrieval;

        this.log('Running parent page retrieval with offset', offset, 'on', chunks.length, 'chunks...');

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