import z from "zod";
import { getLLMProvider, LLMConfigProvider } from "../../llm";
import { Chunk } from "../../lib/chunks/";
import { generateObject } from "ai";

const PROMPT = `
You are an expert in **RAG-oriented chunking**. Your goal is to produce **contiguous, self-contained chunks** that maximize retrievability: each chunk must contain enough context (definitions, scope, qualifiers, examples/lists) to answer a user query without needing adjacent chunks.

----------------
INPUT
----------------
- The text is given as numbered lines (0-based): "0: ...", "1: ...", etc.
- Never renumber, skip, or reorder lines.

----------------
OUTPUT (STRICT)
----------------
Return ONLY a JSON object of arrays:
{
  "chunks": [
    { "start": number, "end": number },
    ...
  ]
}
Rules:
- Indices inclusive.
- Chunks must:
  - Start at 0 and end at N-1 (N = total lines).
  - Cover every line exactly once (no gaps/overlaps).
  - Be sorted and contiguous (next.start = prev.end + 1).
  - Ensure start <= end.

----------------
RAG-ORIENTED PRINCIPLES
----------------
1) Self-contained units: One chunk = one topic/section/proposition with its local evidence (definition + explanation + short list/examples).
2) Header anchoring: A heading/title/subheading MUST be chunked together with its immediate explanatory paragraph(s) and any short, directly supporting list. 
   - Do NOT emit a chunk that is only a heading or a heading + blank line.
3) Minimum informational mass: Avoid thin chunks.
   - Prefer ~120–300 words (≈700–1,500 chars) when available within a single coherent topic.
   - Minimum floor: If a candidate chunk would be <60 words or lacks a definable claim, MERGE it with adjacent context that continues the same topic.
   - Allowed short chunks ONLY if they are fully self-contained atomic blocks (e.g., a standalone warning box, a dosage table, a code block, or a complete definition).
4) Lists policy:
   - Keep a short list **with its heading and intro** in the same chunk.
   - Split lists only when items are long and semantically independent enough to stand alone.
5) Blocks policy:
   - Keep tables/code/boxed warnings intact in one chunk; include the preceding heading/intro if it defines their scope.
6) Boundaries:
   - Split on clear topic changes (new medical section, new legal section, new numbered heading), not merely on blank lines.
   - Transitional phrases alone ("however", "in contrast") do NOT force a split unless they start a new focus.
7) Completeness over granularity: Bias to fewer, larger chunks as long as each chunk keeps a single, clear topic.

----------------
QUALITY GATES (must pass)
----------------
- First chunk at 0; last at N-1.
- Full coverage, no overlaps, sorted, contiguous.
- No heading-only chunks.
- Each chunk can plausibly answer at least one retrieval question about its topic without adjacent chunks.
- Prefer ~120–300 words when possible; never split a sentence or tight logical unit across chunks.

----------------
EXAMPLES
----------------
Example 1 (list stays with heading):
0: Effetti indesiderati
1: - nausea
2: - vertigini
3: - rash
4:
5: Conservazione
6: Tenere sotto 25°C.

Output:
{"chunks": [
  { "start": 0, "end": 3 },
  { "start": 4, "end": 6 }
]}

Example 2 (table/block kept intact with its intro):
0: Posologia
1: Dosaggio per adulti:
2: | Peso | Dose |
3: | 50kg | 200mg |
4: Note: non superare 600mg/die.

Output:
{"chunks": [
  { "start": 0, "end": 4 }
]}
----------------
EMIT
----------------
Emit ONLY the JSON object "chunks" : array of { "start", "end" } objects. No commentary.
`.trim();


export class AgenticChunker {

    model: string;
    provider: LLMConfigProvider;
    minChunkLines: number;

    constructor({ model, provider, minChunkLines }: { model: string, provider: LLMConfigProvider, minChunkLines: number }) {
        this.model = model;
        this.provider = provider;
        this.minChunkLines = minChunkLines;
    }

    async splitDocuments(docs: { pageContent: string; metadata: Record<string, any> }[]): Promise<Chunk[]> {
        const output: Chunk[] = [];

        for (const doc of docs) {
            const originalLines = doc.pageContent.split('\n');
            const lines = originalLines.map((line, idx) => `${idx}: ${line}`);

            const start = performance.now();
            const { object: response } = await generateObject({
                model: (await getLLMProvider(this.provider))(this.model),
                messages: [
                    { role: "system", content: PROMPT },
                    { role: "user", content: lines.join('\n') }
                ],
                temperature: 0,
                seed: 42,
                schema: z.object({
                    chunks: z.array(z.object({
                        start: z.number(),
                        end: z.number()
                    }))
                })
            })
            console.log(`Chunked document (${originalLines.length} lines) in ${(performance.now() - start).toFixed(2)} ms`);

            const chunks: Chunk[] = [];

            const rawChunks = response.chunks;
            const newChunk = () => ({
                pageContent: [] as string[],
                metadata: {
                    source: doc.metadata.source,
                    loc: { lines: { from: 0, to: 0 } },
                },
                distance: 0,
            });

            let bufferChunk = newChunk();

            const startBuffer = (from: number, to: number, lines: string[]) => {
                bufferChunk.pageContent = [...lines];
                bufferChunk.metadata.loc.lines.from = from;
                bufferChunk.metadata.loc.lines.to = to;
            };

            const flushBuffer = () => {
                if (bufferChunk.pageContent.length === 0) return;
                chunks.push({
                    pageContent: bufferChunk.pageContent.join("\n"),
                    metadata: {
                        source: doc.metadata.source,
                        loc: {
                            lines: {
                                from: bufferChunk.metadata.loc.lines.from,
                                to: bufferChunk.metadata.loc.lines.to,
                            },
                        },
                    },
                    distance: 0,
                });
                bufferChunk = newChunk();
            };

            for (const chunk of rawChunks) {
                const { start, end } = chunk;
                const chunkLines = originalLines.slice(start, end + 1);
                const numLinesOk = chunkLines.length >= this.minChunkLines;
                const emptyBuffer = bufferChunk.pageContent.length === 0;

                if (numLinesOk) {
                    if (emptyBuffer) { // big enough -> direct push                        
                        chunks.push({
                            pageContent: chunkLines.join("\n"),
                            metadata: {
                                source: doc.metadata.source,
                                loc: { lines: { from: start, to: end } },
                            },
                            distance: 0,
                        });
                    }

                    else { // small pending
                        bufferChunk.pageContent.push(...chunkLines);
                        bufferChunk.metadata.loc.lines.to = end;
                        flushBuffer();
                    }
                }

                else {
                    // small chunk -> buffer
                    if (emptyBuffer) {
                        startBuffer(start, end, chunkLines);
                    }

                    else {
                        bufferChunk.pageContent.push(...chunkLines);
                        bufferChunk.metadata.loc.lines.to = end;
                    }

                    // if min chunk lines ok, flush
                    if (bufferChunk.pageContent.length >= this.minChunkLines) {
                        flushBuffer();
                    }
                }
            }

            // final flush
            flushBuffer();

            output.push(...chunks);
        }

        return output;
    }
}
