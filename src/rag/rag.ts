import { applyChunkFiltering, retrieveParentPage, Chunk, PromptDocument } from "../lib/chunks";
import { VectorStore } from "../vector-store/vector-store";
import { generateObject } from "ai";
import { RagConfig } from "./interfaces";
import { resolveConfig } from "./rag.config";
import { rerankingPrompt } from "../lib/prompt";
import { getObjectLength } from "../utils";
import z from "zod";
import { getLLMProvider } from "./factory";

export class Rag {
    private readonly config: RagConfig;
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
        let summary = `====== RAG SYSTEM CONFIGURATION =====\n`;

        for (const key in this.config) {
            const typedKey = key as keyof RagConfig;
            const value = this.config[typedKey];
            if (typeof value === 'object' && value !== null) {
                summary += `${key.toUpperCase()}:\n`;
                for (const subKey in value) {
                    const typedSubKey = subKey as keyof typeof value;
                    summary += `\t${subKey.toUpperCase()}: ${(value)[typedSubKey]}\n`;
                }
            } else {
                summary += `${key.toUpperCase()}: ${value}\n`;
            }
        }

        summary += `=====================================\n`;

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
        const {
            numResults,
            reranking,
            parentPageRetrieval,
            reasoningEnabled,
            fewShotsEnabled,
            chunkFiltering,
            includeCitations,
            chunksOrAnswerFormat,
        } = this.config;

        if (numResults !== undefined && numResults < 1) {
            throw new Error(`Invalid numResults value: ${numResults}. It must be at least 1.`);
        }

        if (getObjectLength(parentPageRetrieval) > 0) {
            if (parentPageRetrieval?.offset !== undefined && parentPageRetrieval?.offset < 0) {
                throw new Error(`Invalid parent page retrieval offset: ${parentPageRetrieval.offset}. It cannot be negative.`);
            }
        }

        if (getObjectLength(reranking) > 0) {

            if (reranking?.reasoningEnabled && !reranking?.llm) {
                throw new Error("Reasoning is enabled, but reranking LLM is not configured.");
            }

            if (reranking?.chunkFiltering?.thresholdMultiplier !== undefined) {
                const val = reranking?.chunkFiltering.thresholdMultiplier;
                if (val <= 0 || val >= 1) {
                    throw new Error("Reranking chunk filtering thresholdMultiplier must be between 0 and 1 (exclusive).");
                }
            }

            if (!reranking?.llm) {
                throw new Error("Reranking LLM is not configured.");
            }

            if (!reranking?.batchSize || reranking.batchSize < 1) {
                throw new Error("Reranking batch size must be at least 1.");
            }

            if (reranking.llmEvaluationWeight === undefined ||
                reranking.llmEvaluationWeight < 0 ||
                reranking.llmEvaluationWeight > 1) {
                throw new Error("Reranking LLM evaluation weight must be between 0 and 1.");
            }
        }

        if (chunkFiltering?.thresholdMultiplier !== undefined) {
            if (chunkFiltering.thresholdMultiplier <= 0 || chunkFiltering.thresholdMultiplier >= 1) {
                throw new Error("Chunk filtering thresholdMultiplier must be between 0 and 1 (exclusive).");
            }
        }

        if ((reasoningEnabled || fewShotsEnabled || includeCitations) && chunksOrAnswerFormat !== 'answer') {
            throw new Error(
                `Output format must be 'answer' when using reasoning, few-shots, or citations (currently '${chunksOrAnswerFormat}').`
            );
        }

        this.log("Preflight checks passed.");
    }


    public async search(query: string): Promise<Chunk[]> {
        if (!this.isInitialized) {
            throw new Error("Rag instance is not initialized. Please call the init() method first.");
        }

        let chunks = await this.vectorStore.retrieveFromText(query, this.config.numResults);

        if (getObjectLength(this.config.chunkFiltering) > 0 && this.config?.chunkFiltering?.thresholdMultiplier) {
            chunks = applyChunkFiltering(
                chunks,
                this.config.chunkFiltering.thresholdMultiplier
            );
        }

        if (getObjectLength(this.config.reranking) > 0) {
            chunks = await this.rerankChunks(query, chunks);
        }

        if (getObjectLength(this.config.parentPageRetrieval) > 0 && this.config.parentPageRetrieval?.offset) {
            chunks = await retrieveParentPage(chunks, this.config.parentPageRetrieval.offset);
        }

        return chunks;
    }

    public async rerankChunks(query: string, chunks: Chunk[]): Promise<Chunk[]> {

        if (!this.config.reranking) {
            throw new Error("Reranking configuration is missing.");
        }

        const {
            llm,
            batchSize,
            llmEvaluationWeight,
            reasoningEnabled,
            fewShotsEnabled
        } = this.config.reranking;

        this.log('Running reranking on', chunks.length, 'chunks...');

        const groupedChunks: Chunk[][] = [];
        for (let i = 0; i < chunks.length; i += batchSize!) {
            groupedChunks.push(chunks.slice(i, i + batchSize!));
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
                model: (await getLLMProvider('mistral'))(llm!),
                prompt,
                schema: z.object({
                    rankings: z.array(
                        z.object(rankingSchema)
                    ),
                })
            }) as {
                object: { rankings: Array<{ index: number; score: number; reasoning?: string }> }
            };

            const { rankings } = result;

            for (const ranking of rankings) {
                const { index, score } = ranking;
                // Since we're scoring distance, we invert the score (1 - score)
                group[index].distance = (1 - llmEvaluationWeight!) * group[index].distance + llmEvaluationWeight! * (1 - score);
            }
        }

        let rerankedResults = [...groupedChunks.flat()].sort((a, b) => a.distance - b.distance);

        if (getObjectLength(this.config.reranking.chunkFiltering) > 0 && this.config.reranking.chunkFiltering?.thresholdMultiplier) {
            rerankedResults = applyChunkFiltering(
                rerankedResults,
                this.config.reranking.chunkFiltering.thresholdMultiplier
            );
        }

        return rerankedResults;
    }

}