import { Chunk, PromptDocument } from "../lib/chunks/interfaces";
import { VectorStore } from "../vector-store/vector-store";
import z from "zod";
import { generateObject } from "ai";
import { mistral } from "@ai-sdk/mistral";
import { RagConfig, ResolvedRagConfig } from "./interfaces";
import { retrieveParentPage } from "../lib/chunks/parent-page";
import { applyChunkFiltering } from "../lib/chunks";
import { resolveConfig } from "./rag.config";
import { rerankingPrompt } from "../lib/prompt";

export class Rag {
    private readonly config: ResolvedRagConfig;
    private vectorStore: VectorStore;
    private isInitialized: boolean = false;
    
    constructor(ragConfig: RagConfig) {
        this.config = resolveConfig(ragConfig);
        this.vectorStore = new VectorStore(this.config.vectorStoreName);
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
            chunks = applyChunkFiltering(
                chunks, 
                this.config.chunkFiltering.thresholdMultiplier
            );
        }

        if (this.config.reranking.enabled) {
            chunks = await this.rerankChunks(query, chunks);
        }

        if (this.config.parentPageRetrieval.enabled) {
            chunks = await retrieveParentPage(chunks, this.config.parentPageRetrieval.offset);
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
            const prompt = rerankingPrompt(
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
            rerankedResults = applyChunkFiltering(
                rerankedResults,
                this.config.reranking.chunkFiltering.thresholdMultiplier
            );
        }

        return rerankedResults;
    }

}