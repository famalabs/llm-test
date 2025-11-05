import { applyChunkFiltering, retrieveParentPage, Chunk, PromptDocument, Citation } from "../lib/chunks";
import { RAG_CORPUS_IN_CONTEXT_PROMPT, RERANKING_PROMPT } from "../lib/prompt";
import { EMBEDDING_FIELD, VectorStore } from "../vector-store";
import { RagConfig, RagAnswer, RagPerformance } from "./interfaces";
import { addLineNumbers, LanguageLabel } from "../lib/nlp";
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
            semanticCache,
            docStore
        } = this.config;

        if (numResults && numResults < 1) {
            throw new Error(`Invalid numResults value: ${numResults}. It must be at least 1.`);
        }

        if (chunkFiltering) {

            if (chunkFiltering.thresholdMultiplier == undefined && chunkFiltering.baseThreshold == undefined && chunkFiltering.maxChunks == undefined) {
                throw new Error("Chunk filtering is enabled but no parameters are set.");
            }

            if (chunkFiltering.thresholdMultiplier != undefined) {
                const val = chunkFiltering.thresholdMultiplier;
                if (val <= 0 || val >= 1) {
                    throw new Error("Chunk filtering thresholdMultiplier must be between 0 and 1 (exclusive).");
                }
            }

            if (chunkFiltering.baseThreshold != undefined) {
                const baseVal = chunkFiltering.baseThreshold;
                if (baseVal < 0 || baseVal >= 1) {
                    throw new Error("Chunk filtering baseThreshold must be between 0 (inclusive) and 1 (exclusive).");
                }
            }

            if (chunkFiltering.maxChunks != undefined) {
                const max = chunkFiltering.maxChunks;
                if (!Number.isInteger(max) || max < 1) {
                    throw new Error("Chunk filtering maxChunks must be an integer >= 1 if provided.");
                }
            }
        }

        if (reranking) {
            if (reranking.chunkFiltering) {

                if (reranking.chunkFiltering.thresholdMultiplier == undefined && reranking.chunkFiltering.baseThreshold == undefined && reranking.chunkFiltering.maxChunks == undefined) {
                    throw new Error("Reranking chunk filtering is enabled but no parameters are set.");
                }

                if (reranking.chunkFiltering.thresholdMultiplier != undefined) {
                    const val = reranking.chunkFiltering.thresholdMultiplier;
                    if (val <= 0 || val >= 1) {
                        throw new Error("");
                    }
                }

                if (reranking.chunkFiltering.baseThreshold != undefined) {
                    const baseVal = reranking.chunkFiltering.baseThreshold;
                    if (baseVal < 0 || baseVal >= 1) {
                        throw new Error("Reranking chunk filtering baseThreshold must be between 0 (inclusive) and 1 (exclusive).");
                    }
                }

                if (reranking.chunkFiltering.maxChunks != undefined) {
                    const max = reranking.chunkFiltering.maxChunks;
                    if (!Number.isInteger(max) || max < 1) {
                        throw new Error("Reranking chunk filtering maxChunks must be an integer >= 1 if provided.");
                    }
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

            if (parentPageRetrieval.type == 'full-section' && !docStore.getConfig().indexName.includes('section')) {
                console.warn("Warning: Parent page retrieval type is 'full-section', but the document store index name does not indicate section-based chunking. Ensure that the document store was indexed with section-based chunking.");
            }

            if (parentPageRetrieval.offset != undefined && parentPageRetrieval.offset <= 0) {
                throw new Error(`Invalid parent page retrieval offset: ${parentPageRetrieval.offset}. It must be a positive number.`);
            }

            if ((parentPageRetrieval.type == 'lines' || parentPageRetrieval.type == 'chunks') && !(parentPageRetrieval.offset)) {
                throw new Error("Parent page retrieval type requires a positive 'offset' when using 'lines' or 'chunks'.");
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

    private async generateAnswer(query: string, chunks: Chunk[], detectedLanguage?: LanguageLabel): Promise<RagAnswer> {
        const { fewShotsEnabled, includeCitations, reasoningEnabled, llmConfig: { model, provider } } = this.config;

        const responseSchema: Record<string, ZodType> = {
            answer: z.string(),
            citations: z.array(
                z.object({
                    chunkIndex: z.number(),
                    startLine: z.number(),
                    endLine: z.number()
                })
            ).nullish(),
            reasoning: z.string()
        }
        if (!includeCitations) delete responseSchema.citations;
        if (!reasoningEnabled) delete responseSchema.reasoning;

        const { object: result } = await generateObject({
            model: (await getLLMProvider(provider))(model),
            prompt: RAG_CORPUS_IN_CONTEXT_PROMPT(
                query,
                chunks.map((document) => ({
                    ...document,
                    pageContent: addLineNumbers(document.pageContent)
                })),
                {
                    detectedLanguage,
                    fewShots: fewShotsEnabled,
                    reasoning: reasoningEnabled,
                    includeCitations: includeCitations
                }
            ),
            schema: z.object(responseSchema)
        }) as { object: { answer: string; citations?: Citation[]; reasoning?: string; }; };

        if (includeCitations && !result.citations) result.citations = [];

        return { ...result, chunks };
    }

    public async search(query: string, skipCache: boolean = false, detectedLanguage?: LanguageLabel): Promise<RagAnswer & RagPerformance> {
        if (!this.isInitialized) {
            throw new Error("Rag instance is not initialized. Please call the init() method first.");
        }

        const ragPerformance: RagPerformance = { performance: {} };

        let start = performance.now();
        const queryEmbedding = await this.docStore.embedQuery(query);
        ragPerformance.performance!.embedding = { timeMs: performance.now() - start };

        if (!skipCache) {
            const cachedAnswer = await this.checkCache(queryEmbedding);
            if (cachedAnswer) return { ...cachedAnswer, ...ragPerformance };
        }

        start = performance.now();
        let chunks = await this.docStore.retrieve(queryEmbedding, this.config.numResults);
        ragPerformance.performance!.retrieval = { timeMs: performance.now() - start, numChunksRetrieved: chunks.length };

        this.log(`Retrieved ${chunks.length} chunks from document store.`);

        if (this.config.chunkFiltering && this.config.chunkFiltering.thresholdMultiplier && this.config.chunkFiltering.baseThreshold) {
            const prevLen = chunks.length;
            this.log("Applying chunk filtering...");
            chunks = applyChunkFiltering(
                chunks,
                this.config.chunkFiltering.thresholdMultiplier,
                this.config.chunkFiltering.baseThreshold,
                this.config.chunkFiltering.maxChunks
            );
            this.log(`Chunk filtering applied: ${prevLen} -> ${chunks.length}`);
        }

        if (this.config.parentPageRetrieval) {
            if (this.config.parentPageRetrieval.type == 'full-section') {
                start = performance.now();
                chunks = await this.retrieveParentSection(chunks);
                ragPerformance.performance!.parentSectionRetrieval = { timeMs: performance.now() - start, numSectionsRetrieved: chunks.length };
            }

            else if (this.config.parentPageRetrieval.type == 'lines' && this.config.parentPageRetrieval.offset) {
                start = performance.now();
                chunks = await retrieveParentPage(chunks, this.config.parentPageRetrieval.offset);
                ragPerformance.performance!.parentPageRetrieval = { timeMs: performance.now() - start, numPagesRetrieved: chunks.length };
            }

            else if (this.config.parentPageRetrieval.type == 'chunks' && this.config.parentPageRetrieval.offset) {
                start = performance.now();
                chunks = await this.retrieveChunkNeighbors(chunks, this.config.parentPageRetrieval.offset);
                ragPerformance.performance!.parentPageRetrieval = { timeMs: performance.now() - start, numPagesRetrieved: chunks.length };
            }

            else {
                throw new Error("Invalid parent page retrieval configuration.");
            }
        }

        if (this.config.reranking) {
            start = performance.now();
            const rerankingOutput = await this.rerankChunks(query, chunks);
            chunks = rerankingOutput.chunks;
            ragPerformance.performance!.reranking = { timeMs: performance.now() - start, numChunksReranked: rerankingOutput.numChunksReranked, numGroupsReranked: rerankingOutput.numGroupsReranked };
        }

        start = performance.now();
        const answer = await this.generateAnswer(query, chunks, detectedLanguage);
        await this.storeToCache(queryEmbedding, answer);

        return { ...answer, ...ragPerformance };
    }

    private async retrieveChunkNeighbors(chunks: Chunk[], offset: number): Promise<Chunk[]> {

        const bySource: Record<string, Chunk[]> = {};
        for (const c of chunks) {
            if (!bySource[c.source]) bySource[c.source] = [];
            bySource[c.source].push(c);
        }

        const outMap = new Map<string, Chunk>();

        const getKey = (c: Chunk) => `${c.source}::${c.id ?? ''}::${c.childId ?? ''}`;
        const getLineFrom = (c: Chunk) => c?.metadata?.loc?.lines?.from ?? Infinity;

        for (const c of chunks) {
            const key = getKey(c);
            outMap.set(key, c);
        }

        for (const [source, srcChunks] of Object.entries(bySource)) {
            const { docs } = await this.docStore.query(`@source:{${escapeRedisValue(source)}}`);
            if (!docs || docs.length == 0) continue;

            const all = docs.map(d => d.fields as Chunk);

            const topLevel = all.filter(c => !c.childId);
            const byParent: Record<string, Chunk[]> = {};

            for (const c of all) {
                if (c.childId) {
                    const pid = c.id;
                    if (!byParent[pid]) byParent[pid] = [];
                    byParent[pid].push(c);
                }
            }

            topLevel.sort((a, b) => getLineFrom(a) - getLineFrom(b));

            for (const pid of Object.keys(byParent)) {
                byParent[pid].sort((a, b) => (Number(a.childId) ?? 0) - (Number(b.childId) ?? 0));
            }

            const pushWithDistance = (base: Chunk, cand: Chunk) => {
                const key = getKey(cand);
                const candidate: Chunk = {
                    pageContent: cand.pageContent,
                    source: cand.source,
                    id: cand.id,
                    childId: cand.childId,
                    metadata: cand.metadata,
                    distance: base.distance,
                } as Chunk;
                const prev = outMap.get(key);
                if (!prev || (prev.distance != null && base.distance < prev.distance)) {
                    outMap.set(key, candidate);
                }
            };

            const indexTopLevel = new Map<string, number>();
            const indexChildren: Record<string, Map<string, number>> = {};

            topLevel.forEach((c, i) => indexTopLevel.set(getKey(c), i));

            for (const [pid, arr] of Object.entries(byParent)) {
                indexChildren[pid] = new Map<string, number>();
                arr.forEach((c, i) => indexChildren[pid]!.set(getKey(c), i));
            }

            for (const base of srcChunks) {
                const isChild = !base.childId;

                if (isChild) {
                    const pid = base.id;
                    const arr = byParent[pid] ?? [];
                    if (arr.length == 0) continue;

                    const idx = arr.findIndex(c => c.childId == base.childId);
                    if (idx < 0) continue;

                    for (let k = 1; k <= offset; k++) {
                        const left = arr[idx - k];
                        const right = arr[idx + k];

                        if (left) pushWithDistance(base, left);
                        if (right) pushWithDistance(base, right);
                    }
                }

                else {
                    let idx = topLevel.findIndex(c => c.id == base.id && (c.childId == null || c.childId === undefined));

                    if (idx < 0) {
                        const from = getLineFrom(base);
                        idx = topLevel.findIndex(c => getLineFrom(c) == from);
                    }

                    if (idx < 0) continue;

                    for (let k = 1; k <= offset; k++) {
                        const left = topLevel[idx - k];
                        const right = topLevel[idx + k];

                        if (left) pushWithDistance(base, left);
                        if (right) pushWithDistance(base, right);
                    }
                }
            }
        }

        return Array.from(outMap.values()).sort((a, b) => a.distance - b.distance);
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


    public async rerankChunks(query: string, chunks: Chunk[]): Promise<{ chunks: Chunk[], numChunksReranked: number, numGroupsReranked: number }> {

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

        const groupedChunks: Chunk[][] = [];

        for (let i = 0; i < chunks.length; i += batchSize!) {
            const chunkGroup = chunks.slice(i, i + batchSize!);
            groupedChunks.push(chunkGroup);
        }

        this.log('Running reranking on', chunks.length, 'chunks, divided into', groupedChunks.length, 'groups...');

        await Promise.all(
            groupedChunks.map(async (group) => {
                const promptDocuments: PromptDocument[] = group.map(c => ({ content: c.pageContent, source: c.source }));
                const prompt = RERANKING_PROMPT(
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

                    if (index < 0 || index >= group.length) {
                        this.log(`Warning: Received invalid index ${index} in reranking results. Skipping.`);
                        continue;
                    }

                    // Since we're scoring distance, we invert the score (1 - score)
                    group[index].distance = (1 - llmEvaluationWeight!) * group[index].distance + llmEvaluationWeight! * (1 - score);
                }
            })
        );

        let rerankedResults = [...groupedChunks.flat()].sort((a, b) => a.distance - b.distance);

        if (this.config.reranking.chunkFiltering && this.config.reranking.chunkFiltering.thresholdMultiplier && this.config.reranking.chunkFiltering.baseThreshold) {
            this.log("Applying chunk filtering after reranking...");
            rerankedResults = applyChunkFiltering(
                rerankedResults,
                this.config.reranking.chunkFiltering.thresholdMultiplier,
                this.config.reranking.chunkFiltering.baseThreshold,
                this.config.reranking.chunkFiltering.maxChunks
            );
        }

        return { chunks: rerankedResults, numChunksReranked: chunks.length, numGroupsReranked: groupedChunks.length };
    }

}