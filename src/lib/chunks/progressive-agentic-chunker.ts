/*
DEPRECATED
*/

import z from "zod";
import { getLLMProvider, LLMConfigProvider } from "../../llm";
import { Chunk } from "./interfaces";
import { generateObject } from "ai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

const PROMPT = `You are an expert at grouping small text blocks ("mini-chunks") into bigger, meaningful groups ("semantic chunks").

Your job:
Take a list of mini-chunks.  
Group them into larger sections that make sense together.  
Each group should correspond to one **section or topic** of the document.

---------------------------
STEP-BY-STEP INSTRUCTIONS
---------------------------
1. Read all the mini-chunks from top to bottom.  
2. Look for **headings or titles** (e.g. “Introduction”, “Controindicazioni”, etc.).  
3. Group each heading together with:
   - the lines immediately after it that **explain or list details** about that topic,
   - and any **short list or paragraph** directly related.
4. When you see:
   - an empty line (double line break),
   - a new heading,
   - or a clear topic change,
   → that usually means a **new group starts**.
5. Never reorder the chunks.  
   Groups must be made of **contiguous mini-chunks** (example: {start: 3, end: 5} is OK, but {start: 3, end: 5, 9} is NOT).
6. Prefer fewer groups if possible.  
   Only split when the topic actually changes.
7. Each group should be **self-contained**:
   - It must make sense alone,
   - It must contain everything needed to understand its topic.

---------------------------
GOOD EXAMPLE
---------------------------
Mini-chunks:
0: Title
1: Section A
2: Paragraph about Section A
3: Section B
4: Paragraph about Section B

Correct output:
{
  "groups": [
    { "start": 0, "end": 2 },  // Title + Section A
    { "start": 3, "end": 4 }   // Section B
  ]
}

---------------------------
BAD EXAMPLES
---------------------------
- {start: 0, end: 0}, {start: 2, end: 2}, {start: 4, end: 4} ❌ (too fragmented)
- {start: 0, end: 4} ❌ (different topics mixed)
- Non-contiguous groups like {start: 0, end: 2, 4} ❌ (illegal format)

---------------------------
FINAL CHECKLIST
---------------------------
✅ All mini-chunks are covered.  
✅ No gaps or overlaps.  
✅ Groups are contiguous.  
✅ Each group covers exactly one topic.  
✅ A heading is grouped with its related text.

---------------------------
OUTPUT FORMAT
---------------------------
Return ONLY a JSON object:
{
  "groups": [
    { "start": number, "end": number },
    ...
  ]
}`


export class ProgressiveAgenticChunker {
    model: string;
    provider: LLMConfigProvider;
    intermediateChunker: RecursiveCharacterTextSplitter;
    batchSize: number;

    constructor({ model, provider, batchSize = 5 }: { model: string, provider: LLMConfigProvider, batchSize: number }) {
        this.model = model;
        this.provider = provider;
        this.intermediateChunker = new RecursiveCharacterTextSplitter({
            chunkSize: 300
        });
        this.batchSize = batchSize;
        console.warn("ProgressiveAgenticChunker is deprecated. Please use SectionAgenticChunker instead.");
    }

    async splitDocuments(docs: { pageContent: string; metadata: Record<string, any> }[]): Promise<Chunk[]> {
        const output: Chunk[] = [];

        const miniChunks = await this.intermediateChunker.splitDocuments(docs) as Chunk[];
        const currentBatch: Chunk[] = [];

        for (const miniChunk of miniChunks) {

            if (currentBatch.length + 1 < this.batchSize) { // accumula fino a 4
                currentBatch.push(miniChunk);
                continue;
            }

            if (output.length == 0) { // first cycle -> pusha il 5°
                currentBatch.push(miniChunk);
            }

            else { // currentBatch ora ha 4 elementi e non è il first cycle -> processa i 4 + l'ultimo elemento di output
                const lastElement = output.pop(); // reprocess last element within the current cycle.
                if (!lastElement) throw new Error("Unexpected error: lastElement is undefined");
                currentBatch.unshift(lastElement);
            }

            const { object: result } = await generateObject({
                model: (await getLLMProvider(this.provider))(this.model),
                messages: [
                    { role: "system", content: PROMPT },
                    { role: "user", content: currentBatch.map((c, i) => `======= CHUNK ${i} =========\n${c.pageContent}`).join('\n') }
                ],
                temperature: 0,
                seed: 42,
                schema: z.object({
                    groups: z.array(z.object({
                        start: z.number().min(0).max(this.batchSize),
                        end: z.number().min(0).max(this.batchSize),
                    }))
                })
            })

            const { groups } = result;

            const newChunks = groups.map((g, idx) => {
                const chunkLines = currentBatch.slice(g.start, g.end).map(c => c.pageContent);

                const start = g.start;
                const end = g.end - 1;

                if (!currentBatch[start].metadata.loc || !currentBatch[end].metadata.loc) { // for typesafety
                    throw new Error("Unexpected error: loc metadata is missing");
                }

                const fromLine = currentBatch[start].metadata.loc.lines.from;
                const toLine = currentBatch[end].metadata.loc.lines.to;

                return {
                    pageContent: chunkLines.join("\n"),
                    source: currentBatch[0].source,
                    metadata: {
                        loc: { lines: { from: fromLine, to: toLine } },
                    },
                    id: idx.toString(),
                    distance: 0,
                } as Chunk;
            });

            output.push(...newChunks);
            currentBatch.length = 0;
        }

        return output;
    }
}