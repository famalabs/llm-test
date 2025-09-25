import { applyChunkFiltering, retrieveParentPage, Chunk, PromptDocument, Citation } from "../lib/chunks";
import { EMBEDDING_FIELD, VectorStore } from "../vector-store";
import { generateObject } from "ai";
import { RagConfig, RagAnswer } from "./interfaces";
import { resolveConfig } from "./rag.config";
import { ragCorpusInContext, rerankingPrompt } from "../lib/prompt";
import { getObjectLength } from "../utils";
import { getLLMProvider } from "./factory";
import z, { ZodType } from "zod";
import { addLineNumbers } from "../lib/nlp";

export class Rag {
    private readonly config: RagConfig;
    private readonly docStore: VectorStore<Chunk>;
    private readonly cacheStore?: VectorStore<RagAnswer>;
    private isInitialized: boolean = false;

    constructor(ragConfig: RagConfig) {
        this.config = resolveConfig(ragConfig);
        this.docStore = this.config.docStore;

        if (getObjectLength(this.config.semanticCache) > 0 && this.config.semanticCache?.cacheStore) {
            this.cacheStore = this.config.semanticCache.cacheStore;
        }
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
        let summary = `\n====== RAG SYSTEM CONFIGURATION =====\n`;
        const fmtKey = (key: string) => key.replace(/([A-Z])/g, ' $1').toUpperCase();

        const formatConfig = (obj: any, indent: string = ''): string => {
            let result = '';
            for (const key in obj) {
                if (key == 'docStore' || key == 'cacheStore') {
                    result += `${indent}${fmtKey(key)}: VectorStore\n`;
                    continue;
                }
                const value = obj[key];
                if (typeof value === 'object' && value !== null && getObjectLength(value) > 0) {
                    result += `${indent}${fmtKey(key)}:\n`;
                    result += formatConfig(value, indent + '\t');
                } 
                else {
                    if (typeof value == 'object') { continue }
                    result += `${indent}${fmtKey(key)}: ${value}\n`;
                }
            }
            return result;
        };

        summary += formatConfig(this.config);

        summary += `=====================================\n`;

        console.log(summary);
        return summary;
    }

    public async init(): Promise<void> {
        if (this.isInitialized) {
            console.warn("Rag instance is already initialized.");
            return;
        }
        await this.docStore.load();
        this.log("Document store loaded. Fields:", this.docStore.getRegisteredFields());
        if (this.cacheStore) {
            await this.cacheStore.load();
            this.log("Cache store loaded. Fields:", this.cacheStore.getRegisteredFields());
        }

        this.runPreflightChecks();
        this.isInitialized = true;
    }

    private runPreflightChecks(): void {
        const {
            numResults,
            reranking,
            parentPageRetrieval,
            chunkFiltering,
            semanticCache
        } = this.config;

        if (numResults && numResults < 1) {
            throw new Error(`Invalid numResults value: ${numResults}. It must be at least 1.`);
        }

        if (getObjectLength(chunkFiltering) > 0) {
            if (chunkFiltering?.thresholdMultiplier != undefined) {
                const val = chunkFiltering?.thresholdMultiplier;
                if (val <= 0 || val >= 1) {
                    throw new Error("Chunk filtering thresholdMultiplier must be between 0 and 1 (exclusive).");
                }
            }
        }

        if (getObjectLength(reranking) > 0) {
            if (getObjectLength(reranking?.chunkFiltering)) {
                if (reranking?.chunkFiltering?.thresholdMultiplier != undefined) {
                    const val = reranking?.chunkFiltering?.thresholdMultiplier;
                    if (val <= 0 || val >= 1) {
                        throw new Error("Reranking chunk filtering thresholdMultiplier must be between 0 and 1 (exclusive).");
                    }
                }
            }

            if (reranking?.batchSize && reranking.batchSize < 1) {
                throw new Error("Reranking batch size must be at least 1.");
            }

            if (reranking?.llmEvaluationWeight != undefined) {
                const val = reranking.llmEvaluationWeight;
                if (val < 0 || val > 1) {
                    throw new Error("Reranking LLM evaluation weight must be between 0 and 1.");
                }
            }
        }

        if (getObjectLength(parentPageRetrieval) > 0) {
            if (parentPageRetrieval?.offset != undefined && parentPageRetrieval?.offset < 0) {
                throw new Error(`Invalid parent page retrieval offset: ${parentPageRetrieval.offset}. It cannot be negative.`);
            }
        }

        if (getObjectLength(semanticCache) > 0) {
            if (!semanticCache?.cacheStore) {
                throw new Error("Semantic cache is enabled, but cacheStore is not configured.");
            }
            if (semanticCache?.distanceThreshold != undefined && semanticCache.distanceThreshold <= 0) {
                throw new Error("Semantic cache distanceThreshold must be a positive number.");
            }
            if (semanticCache?.ttl != undefined && semanticCache.ttl <= 0) {
                throw new Error("Semantic cache ttl must be a positive number.");
            }
        }

        this.log("Preflight checks passed.");
    }

    private async checkCache(queryEmbeddings: number[]): Promise<RagAnswer | null> {
        if (!this.cacheStore || !this.config.semanticCache?.distanceThreshold) {
            return null;
        }

        const cachedAnswer = await this.cacheStore.retrieve(queryEmbeddings, 1);
        if (cachedAnswer.length > 0) {
            this.log("Found cached answer.");
            const { distance } = cachedAnswer[0];
            const { distanceThreshold } = this.config.semanticCache;

            if (distance && distance <= distanceThreshold) {
                this.log(`Cache hit (distance: ${distance.toFixed(4)} <= threshold: ${distanceThreshold}). Using cached answer.`);
                return cachedAnswer[0];
            }
        }

        return null;
    }

    private async storeToCache(queryEmbeddings: number[], ragAnswer: RagAnswer): Promise<void> {
        if (!this.cacheStore) return;
        
        // Adding here the EMBEDDING_FIELD prevent re-compuation of the queryEmbeddings.
        const doc = { ...ragAnswer, [EMBEDDING_FIELD]: queryEmbeddings };
        if (this.config.semanticCache?.ttl) {
            (doc as Record<string, any>)['ttl'] = this.config.semanticCache.ttl;
        }

        await this.cacheStore.add([doc]);
        this.log("Stored answer in cache store.");
    }

    private async generateAnswer(query: string, chunks: Chunk[]): Promise<RagAnswer> {
        const { fewShotsEnabled, includeCitations, reasoningEnabled } = this.config;

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
        if (!includeCitations) delete responseSchema.citations;
        if (!reasoningEnabled) delete responseSchema.reasoning;

        const { object: result } = await generateObject({
            model: (await getLLMProvider(this.config.provider!))(this.config.llm!),
            prompt: ragCorpusInContext(
                chunks.map((document) => ({
                    ...document,
                    pageContent: addLineNumbers(document.pageContent)
                })), query, fewShotsEnabled, reasoningEnabled, includeCitations
            ),
            schema: z.object(responseSchema)
        }) as { object: { answer: string; citations?: Citation[]; reasoning?: string; }; };


        return { ...result, chunks };
    }

    public async search(query: string): Promise<RagAnswer> {
        if (!this.isInitialized) {
            throw new Error("Rag instance is not initialized. Please call the init() method first.");
        }

        const queryEmbedding = await this.docStore.embedQuery(query);

        const cachedAnswer = await this.checkCache(queryEmbedding);
        if (cachedAnswer) return cachedAnswer;

        let chunks = await this.docStore.retrieve(queryEmbedding, this.config.numResults);

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

        const answer = await this.generateAnswer(query, chunks);
        await this.storeToCache(queryEmbedding, answer);

        return answer;
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