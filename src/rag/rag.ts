import { applyChunkFiltering, retrieveParentPage, Chunk, PromptDocument, Citation } from "../lib/chunks";
import { ragCorpusInContext, rerankingPrompt } from "../lib/prompt";
import { EMBEDDING_FIELD, VectorStore } from "../vector-store";
import { RagConfig, RagAnswer } from "./interfaces";
import { addLineNumbers } from "../lib/nlp";
import { escapeRedisValue } from "../lib/redis";
import { generateObject } from "ai";
import { resolveConfig } from "./rag.config";
import { getLLMProvider } from "../llm";
import z, { ZodType } from "zod";

export class Rag {
    private readonly config: RagConfig;
    private readonly docStore: VectorStore<Chunk>;
    private readonly cacheStore?: VectorStore<RagAnswer>;
    private isInitialized: boolean = false;

    constructor(ragConfig: RagConfig) {
        this.config = resolveConfig(ragConfig);
        this.docStore = this.config.docStore;

        if (this.config.semanticCache && this.config.semanticCache.cacheStore) {
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
                if (typeof value == 'object' && value) {
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
        this.log("Document store loaded.");
        if (this.cacheStore) {
            await this.cacheStore.load();
            this.log("Cache store loaded.");
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

        if (chunkFiltering) {
            if (chunkFiltering.thresholdMultiplier != undefined) {
                const val = chunkFiltering.thresholdMultiplier;
                if (val <= 0 || val >= 1) {
                    throw new Error("Chunk filtering thresholdMultiplier must be between 0 and 1 (exclusive).");
                }
            }
            else {
                throw new Error("Chunk filtering is enabled, but thresholdMultiplier is not set.");
            }

            if (chunkFiltering.baseThreshold != undefined) {
                const baseVal = chunkFiltering.baseThreshold;
                if (baseVal < 0 || baseVal >= 1) {
                    throw new Error("Chunk filtering baseThreshold must be between 0 (inclusive) and 1 (exclusive).");
                }
            }
            else {
                throw new Error("Chunk filtering is enabled, but baseThreshold is not set.");
            }
        }

        if (reranking) {
            if (reranking.chunkFiltering) {
                if (reranking.chunkFiltering.thresholdMultiplier != undefined && reranking.chunkFiltering.baseThreshold != undefined) {
                    const val = reranking.chunkFiltering.thresholdMultiplier;
                    if (val <= 0 || val >= 1) {
                        throw new Error("Reranking chunk filtering thresholdMultiplier must be between 0 and 1 (exclusive).");
                    }
                }

                else {
                    throw new Error("Reranking chunk filtering is enabled, but thresholdMultiplier or baseThreshold is not set.");
                }

                if (reranking.chunkFiltering.baseThreshold != undefined) {
                    const baseVal = reranking.chunkFiltering.baseThreshold;
                    if (baseVal < 0 || baseVal >= 1) {
                        throw new Error("Reranking chunk filtering baseThreshold must be between 0 (inclusive) and 1 (exclusive).");
                    }
                }
                else {
                    throw new Error("Reranking chunk filtering is enabled, but baseThreshold is not set.");
                }
            }

            if (reranking.batchSize && reranking.batchSize < 1) {
                throw new Error("Reranking batch size must be at least 1.");
            }

            if (reranking.llmEvaluationWeight != undefined) {
                const val = reranking.llmEvaluationWeight;
                if (val < 0 || val > 1) {
                    throw new Error("Reranking LLM evaluation weight must be between 0 and 1.");
                }
            }
        }

        if (parentPageRetrieval) {
            if (parentPageRetrieval.offset != undefined && parentPageRetrieval.offset <= 0) {
                throw new Error(`Invalid parent page retrieval offset: ${parentPageRetrieval.offset}. It must be a positive number.`);
            }

            if (parentPageRetrieval.type == 'lines' && !(parentPageRetrieval.offset)) {
                throw new Error("Parent page retrieval type is 'lines' but offset is not set.");
            }
        }

        if (semanticCache) {
            if (!semanticCache.cacheStore) {
                throw new Error("Semantic cache is enabled, but cacheStore is not configured.");
            }
            if (semanticCache.distanceThreshold != undefined && semanticCache.distanceThreshold <= 0) {
                throw new Error("Semantic cache distanceThreshold must be a positive number.");
            }
            if (semanticCache.ttl != undefined && semanticCache.ttl <= 0) {
                throw new Error("Semantic cache ttl must be a positive number.");
            }
        }

        this.log("Preflight checks passed.");
    }

    private async checkCache(queryEmbeddings: number[]): Promise<RagAnswer | null> {
        if (!this.cacheStore || !this.config.semanticCache || !this.config.semanticCache.distanceThreshold) {
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
            else if (distance) {
                this.log(`Cache miss (distance: ${distance.toFixed(4)} > threshold: ${distanceThreshold}).`);
            }
            else {
                this.log("Cache miss (no distance).");
            }
        }

        return null;
    }

    private async storeToCache(queryEmbeddings: number[], ragAnswer: RagAnswer): Promise<void> {
        if (!this.cacheStore) return;

        // Adding here the EMBEDDING_FIELD prevent re-compuation of the queryEmbeddings.
        const doc = { ...ragAnswer, [EMBEDDING_FIELD]: queryEmbeddings };
        
        const options: { ttl?: number } = {};
        if (this.config.semanticCache && this.config.semanticCache.ttl) {
            options.ttl = this.config.semanticCache.ttl;
        }

        await this.cacheStore.add([doc], options);
        this.log("Stored answer in cache store.");
    }

    private async generateAnswer(query: string, chunks: Chunk[]): Promise<RagAnswer> {
        const { fewShotsEnabled, includeCitations, reasoningEnabled, llmConfig: { model, provider } } = this.config;

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
            model: (await getLLMProvider(provider))(model),
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

    public async search(query: string, skipCache: boolean = false): Promise<RagAnswer> {
        if (!this.isInitialized) {
            throw new Error("Rag instance is not initialized. Please call the init() method first.");
        }

        const queryEmbedding = await this.docStore.embedQuery(query);

        if (!skipCache) {
            const cachedAnswer = await this.checkCache(queryEmbedding);
            if (cachedAnswer) return cachedAnswer;
        }

        let chunks = await this.docStore.retrieve(queryEmbedding, this.config.numResults);

        if (this.config.chunkFiltering && this.config.chunkFiltering.thresholdMultiplier && this.config.chunkFiltering.baseThreshold) {
            const prevLen = chunks.length;
            this.log("Applying chunk filtering...");
            chunks = applyChunkFiltering(
                chunks,
                this.config.chunkFiltering.thresholdMultiplier,
                this.config.chunkFiltering.baseThreshold
            );
            this.log(`Chunk filtering applied: ${prevLen} -> ${chunks.length}`);
        }

        if (this.config.parentPageRetrieval) {
            if (this.config.parentPageRetrieval.type == 'full-section') {
                chunks = await this.retrieveParentSection(chunks);
            }

            else if (this.config.parentPageRetrieval.type == 'lines' && this.config.parentPageRetrieval.offset) {
                chunks = await retrieveParentPage(chunks, this.config.parentPageRetrieval.offset);
            }

            else {
                throw new Error("Invalid parent page retrieval configuration.");
            }
        }

        if (this.config.reranking) {
            chunks = await this.rerankChunks(query, chunks);
        }

        const answer = await this.generateAnswer(query, chunks);
        await this.storeToCache(queryEmbedding, answer);

        return answer;
    }


    private async retrieveParentSection(chunks: Chunk[]): Promise<Chunk[]> {

        const alreadyProcessedParents = new Set<string>();
        const output: Chunk[] = [];

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const isSubChunk = chunk.childId != undefined;

            // se non è un sub-chunk -> direct push.
            if (!isSubChunk) {
                const id = chunk.id;
                if (alreadyProcessedParents.has(id)) { continue; }

                output.push(chunk);
                alreadyProcessedParents.add(chunk.id);

                continue;
            }

            else {
                const parentId = chunk.id;
                if (alreadyProcessedParents.has(parentId)) { continue; }

                const parentChunk = chunks.find(c => c.id == parentId && c.source == chunk.source && c.childId == null);

                // parent is already in the chunks
                if (parentChunk) {
                    output.push(parentChunk);
                    alreadyProcessedParents.add(parentId);
                    continue;
                }

                // we have to read the parent from the docStore
                else {
                    const { docs } = await this.docStore.query(
                        `@id:{${parentId}} @source:{${escapeRedisValue(chunk.source)}} @childId:{null}`,
                    );

                    if (!docs || docs.length == 0) {
                        throw new Error("Parent chunk not found in the document store.");
                    }

                    const doc = docs[0];

                    if (!doc) {
                        throw new Error('Unexpected error: parent chunk not found in the results.')
                    }

                    const parentChunk = doc.fields;

                    output.push({
                        pageContent: parentChunk.pageContent,
                        source: chunk.source,
                        id: chunk.id,
                        metadata: {
                            loc: {
                                lines: parentChunk.metadata.loc.lines
                            }
                        },
                        distance: chunk.distance
                    });
                    alreadyProcessedParents.add(parentId);
                }
            }
        }

        return output;
    };


    public async rerankChunks(query: string, chunks: Chunk[]): Promise<Chunk[]> {

        if (!this.config.reranking) {
            throw new Error("Reranking configuration is missing.");
        }

        const {
            llmConfig: { model, provider },
            batchSize,
            llmEvaluationWeight,
            reasoningEnabled,
            fewShotsEnabled,
        } = this.config.reranking;

        this.log('Running reranking on', chunks.length, 'chunks...');

        const groupedChunks: Chunk[][] = [];

        for (let i = 0; i < chunks.length; i += batchSize!) {
            const chunkGroup = chunks.slice(i, i + batchSize!);
            groupedChunks.push(chunkGroup);
        }

        for (const group of groupedChunks) {
            const promptDocuments: PromptDocument[] = group.map(c => ({ content: c.pageContent, source: c.source }));
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
                model: (await getLLMProvider(provider))(model),
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

        if (this.config.reranking.chunkFiltering && this.config.reranking.chunkFiltering.thresholdMultiplier && this.config.reranking.chunkFiltering.baseThreshold) {
            this.log("Applying chunk filtering after reranking...");
            rerankedResults = applyChunkFiltering(
                rerankedResults,
                this.config.reranking.chunkFiltering.thresholdMultiplier,
                this.config.reranking.chunkFiltering.baseThreshold
            );
        }

        return rerankedResults;
    }

}