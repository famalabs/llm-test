import { Mistral } from "@mistralai/mistralai";
import { OcrEngine } from "./interfaces";

const mistralClient = new Mistral();

export const mistralOcr: OcrEngine = async (inputBuffer) => {
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

    const document = ocrResponse.pages.map(p => p.markdown).join('\n');
    return document;
}