/*
Per avviare docling:

pip install "docling-serve[ui]"
docling-serve run --enable-ui

# Using container images, e.g. with Podman
podman run -p 5001:5001 -e DOCLING_SERVE_ENABLE_UI=1 quay.io/docling-project/docling-serve
*/

import { Docling } from "docling-sdk";
import { OcrEngine } from "./interfaces";

const doclingUrl = process.env.DOCLING_URL || "http://localhost:5001";

export const doclingOcr: OcrEngine = async (inputBuffer) => {
    const client = new Docling({ api: { baseUrl: doclingUrl, timeout: 120_000 } });

    const result = await client.convertFile({
        files: inputBuffer,
        filename: "input.pdf",
        to_formats: ['md'],
    });

    const value = result.document[`md_content`];

    return value!;
};