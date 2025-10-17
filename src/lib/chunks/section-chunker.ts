import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { getLLMProvider, LLMConfigProvider } from "../../llm";
import { generateObject } from "ai";
import { Chunk } from "./interfaces";
import z from "zod";

const PROMPT = `
You are an expert in **document section indexing**.
Your task is to build a clean, structured **Table of Contents (TOC)** from the given text. 
The text is presented line by line (numbered starting at 0). 

----------------
TASK
----------------
- Identify **titles/headings** and treat them as **section starts**.
- For each detected section:
  - Extract the **title** text as it appears (trim spaces, remove numbering).
  - Record the **line index** where the title starts.
  - Write a **short 1–2 sentence description** of the section, summarizing the content immediately following the heading.
- Sections continue until the next heading or end of file (EOF).
- A heading is typically:
  - A single word at the start of some text related to that section.
  - A line with Title Case or ALL CAPS.
  - A line ending with ":" or starting at a new paragraph.
  - A line with visual separators or numbering ("1.", "2.", "I.", etc.).
- If no clear title is found, fall back to the first line (index 0) as the first section.

----------------
OUTPUT (STRICT)
----------------
Return ONLY a JSON object with:
{
  "sections": [
    {
      "title": string,
      "line": number,
      "description": string
    },
    ...
  ]
}

----------------
RULES
----------------
- Sections must be sorted by line ascending.
- Titles must be meaningful: skip blank lines or noise.
- Do NOT include commentary or extra fields.
- Description must be informative but concise (max 2 sentences).
- Never reorder the original text or renumber lines.
- The language of the title and the description should match the one used in the document.
`.trim();

interface SectionAgenticChunkerConstructorInterface {
    model: string;
    provider: LLMConfigProvider;
    secondPass?: {
        chunkSize : number
        chunkOverlap : number
    };
}

export class SectionAgenticChunker {

    model: string;
    provider: LLMConfigProvider;
    secondPass: {
        chunkSize : number
        chunkOverlap : number
    } | null = null;

    constructor({ model, provider, secondPass }: SectionAgenticChunkerConstructorInterface) {
        this.model = model;
        this.provider = provider;
        if (secondPass) this.secondPass = secondPass;
    }

    private async runLLM(lines: string[]) {
        const { object: response } = await generateObject({
            model: (await getLLMProvider(this.provider))(this.model),
            messages: [
                { role: "system", content: PROMPT },
                { role: "user", content: lines.join("\n") },
            ],
            temperature: 0,
            seed: 42,
            schema: z.object({
                sections: z.array(
                    z.object({
                        title: z.string(),
                        line: z.number(),
                        description: z.string(),
                    })
                ),
            }),
        });

        return response.sections;
    }

    private async chunkSingleDoc(doc: { pageContent: string; metadata: Record<string, any> }): Promise<Chunk[]> {
        const originalLines = doc.pageContent.split("\n");
        const lines = originalLines.map((line, idx) => `${idx}: ${line}`);
        const sections = await this.runLLM(lines);

        const chunks: Chunk[] = [];

        for (let i = 0; i < sections.length; i++) {
            const { title, line, description } = sections[i];
            const isFirst = i === 0;
            const isLast = i === sections.length - 1;
            const endLine = isLast ? originalLines.length - 1 : sections[i + 1].line - 1;
            const startLine = isFirst ? 0 : line;
            const content = originalLines.slice(startLine, endLine + 1).join("\n");

            chunks.push({

                pageContent: content,
                source: doc.metadata.source,

                metadata: {
                    loc: {
                        lines: {
                            from: startLine + 1, // convert to 1-based
                            to: endLine + 1,
                        },
                    },

                    title,
                    description,
                },

                childId: null,
                id: i.toString(),
                distance: 0,
            });
        }

        return chunks;
    }

    private async secondPassSplit(chunk: Chunk): Promise<Chunk[]> {
        console.log('---- Running second pass ----');
        if (!this.secondPass) return [chunk];

        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize : this.secondPass.chunkSize,
            chunkOverlap : this.secondPass.chunkOverlap,
            keepSeparator: true
        });

        const docs = await splitter.createDocuments([chunk.pageContent]);

        if (!chunk.metadata.loc) {
            throw new Error("Unexpected error: missing lines in original chunk metadata.");
        }

        const baseFrom = chunk.metadata.loc.lines.from;

        const subChunks: Chunk[] = docs.map((d, idx) => {
            const relFrom = d.metadata.loc?.lines?.from;
            const relTo = d.metadata.loc?.lines?.to;

            const absFrom = baseFrom + relFrom - 1;
            const absTo = baseFrom + relTo - 1;

            return {
                pageContent: d.pageContent,
                source: chunk.source,

                metadata: {
                    loc: {
                        lines: { from: absFrom, to: absTo },
                        parentLines: chunk.metadata.loc?.lines
                    },

                    title: chunk.metadata.title,
                    description: chunk.metadata.description,
                },

                id: chunk.id,
                childId: idx.toString(),
                distance: 0,
            };
        });

        return subChunks;
    }


    async splitDocuments(
        docs: { pageContent: string; metadata: Record<string, any> }[]
    ): Promise<Chunk[]> {
        const output: Chunk[] = [];

        for (const doc of docs) {
            const firstChunks = await this.chunkSingleDoc(doc);

            for (const chunk of firstChunks) {
                if (this.secondPass && chunk.pageContent.length > this.secondPass.chunkSize) {
                    const refined = await this.secondPassSplit(chunk);
                    output.push(...refined);
                }

                // we keep also the original section
                output.push(chunk);
            }
        }

        return output;
    }
}
