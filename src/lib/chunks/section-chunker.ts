import z from "zod";
import { getLLMProvider, LLMConfigProvider } from "../../llm";
import { generateObject } from "ai";
import { Chunk } from "./interfaces";

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
      "line": number,    // index of the first line of the section
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

----------------
EXAMPLE
----------------
INPUT:
0: I gatti
1: Descrizione
2: I gatti sono animali domestici molto popolari ...
3:
4: Benefici
5: I gatti offrono compagnia e possono ridurre lo stress ...

OUTPUT:
{
  "sections": [
    { "title": "Descrizione", "line": 0, "description": "La sezione descrive i gatti in generale." },
    { "title": "Benefici", "line": 4, "description": "La sezione parla degli effetti benefici dei gatti." },
  ]
}
`.trim();

interface SectionAgenticChunkerConstructorInterface {
    model: string; 
    provider: LLMConfigProvider;
    secondPass?: {
        minCharacters: number;
    }
}

export class SectionAgenticChunker {
    model: string;
    provider: LLMConfigProvider;
    secondPass: { minCharacters: number } | null = null;

    constructor({ model, provider, secondPass }: SectionAgenticChunkerConstructorInterface) {
        this.model = model;
        this.provider = provider;
        if (secondPass) this.secondPass = secondPass;
    }

    async splitDocuments(
        docs: { pageContent: string; metadata: Record<string, any> }[]
    ): Promise<Chunk[]> {
        const output: Chunk[] = [];

        for (const doc of docs) {
            const originalLines = doc.pageContent.split("\n");
            const lines = originalLines.map((line, idx) => `${idx}: ${line}`);

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

            // build chunks
            const sections = response.sections;
            for (let i = 0; i < sections.length; i++) {
                const { title, line, description } = sections[i];
                const isFirst = i == 0;
                const isLast = i == sections.length - 1;
                const endLine = isLast
                    ? originalLines.length - 1
                    : sections[i + 1].line - 1;

                const startLine = isFirst ? 0 : line;
                const content = originalLines.slice(startLine, endLine + 1).join("\n");

                output.push({
                    pageContent: content,
                    metadata: {
                        source: doc.metadata.source,
                        loc: {
                            lines: {
                                from: startLine + 1, // convert to 1-based
                                to: endLine + 1,
                            },
                        },
                        title,
                        description,
                    },
                    distance: 0,
                });
            }
        }

        return output;
    }
}
