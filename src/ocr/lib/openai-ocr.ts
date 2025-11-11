import { generateObject } from "ai";
import { OcrEngine } from "./interfaces";
import { openai } from "@ai-sdk/openai";
import z from "zod";
import { PDFDocument } from "pdf-lib";

export const openaiOcr: OcrEngine = async (inputBuffer, moreOptions) => {
    if (!moreOptions?.model) {
        throw new Error("Model must be specified in moreOptions for openaiOcr");
    }

    const srcPdf = await PDFDocument.load(inputBuffer);
    const totalPages = srcPdf.getPageCount();

    const singlePageBuffers: Buffer[] = [];
    for (let i = 0; i < totalPages; i++) {
        const newPdf = await PDFDocument.create();
        const [copiedPage] = await newPdf.copyPages(srcPdf, [i]);
        newPdf.addPage(copiedPage);
        const bytes = await newPdf.save();
        singlePageBuffers.push(Buffer.from(bytes));
    }

    const schema = z.object({ markdown: z.string() });
    const pageCalls = singlePageBuffers.map((buf, idx) => {
        const base64Pdf = buf.toString('base64');
        return generateObject({
            model: openai(moreOptions.model),
            messages: [
                {
                    role: 'user', content: [
                        { type: 'text', text: `Extract the text content from the following document page (${idx + 1} of ${totalPages}). Return the extracted text in markdown format.` },
                        { type: 'file', data: base64Pdf, mediaType: 'application/pdf' },
                    ]
                },
            ],
            schema
        });
    });

    const results = await Promise.all(pageCalls);
    const pagesMarkdown = results.map((r, i) => `\n\n<!-- Page ${i + 1} / ${totalPages} -->\n${r.object.markdown}`);
    return pagesMarkdown.join("\n\n").trim();
}