/*
Usa docling.
Per avviarlo:

pip install "docling-serve[ui]"
docling-serve run --enable-ui

# Using container images, e.g. with Podman
podman run -p 5001:5001 -e DOCLING_SERVE_ENABLE_UI=1 quay.io/docling-project/docling-serve
*/

import { Docling, OutputFormat } from "docling-sdk";
import { DocumentIngester } from "./interfaces";
import { Mistral } from '@mistralai/mistralai';
import 'dotenv/config';

const pdfExtractionEngine = process.env.PDF_EXTRACTION_ENGINE || "docling"; // "docling" | "mistral-ocr-latest"
const doclingUrl = process.env.DOCLING_URL || "http://localhost:5001";
const mistralClient = new Mistral();

export const parsePDF: DocumentIngester = async (
    inputBuffer: Buffer,
    outputFormat: 'text' | 'markdown' | 'html',
) => {

    console.log(`Using PDF extraction engine: ${pdfExtractionEngine}`);

    if (pdfExtractionEngine == 'mistral-ocr-latest') {

        if (outputFormat != 'markdown') {
            throw new Error('Only markdown output format is supported for mistral-ocr-latest');
        }

        const base64Pdf = inputBuffer.toString('base64');

        const ocrResponse = await mistralClient.ocr.process({
            model: "mistral-ocr-latest",
            document: {
                type: "document_url",
                documentUrl: "data:application/pdf;base64," + base64Pdf
            },
            includeImageBase64: true
        });

        for (const page of ocrResponse.pages) {
            for (const image of page.images) {
                const id = image.id;
                const b64 = image.imageBase64;
                const imgTag = `<img src="${b64}" alt="image-${id}" style="max-width: 100%;"/>`;

                const regex = new RegExp(`!\\[${id}\\]\\(${id}\\)`, 'g');
                page.markdown = page.markdown.replace(regex, imgTag);
            }
        }


        return ocrResponse.pages.map(p => p.markdown).join('\n');
    }

    else {
        const client = new Docling({ api: { baseUrl: doclingUrl, timeout: 60_000 } });
        const format: OutputFormat = outputFormat == 'text' ? 'text' : (outputFormat == 'markdown' ? 'md' : 'html');

        const result = await client.convertFile({
            files: inputBuffer,
            filename: "input.pdf",
            to_formats: [format!],
        });

        const value = result.document[`${format!}_content`];

        return value!;
    }
}
