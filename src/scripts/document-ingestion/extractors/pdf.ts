/*
Usa docling.
Per avviarlo:

pip install "docling-serve[ui]"
docling-serve run --enable-ui

# Using container images, e.g. with Podman
podman run -p 5001:5001 -e DOCLING_SERVE_ENABLE_UI=1 quay.io/docling-project/docling-serve
*/

import { Docling, OutputFormat } from "docling-sdk";
import { ExtractionOptions } from "./interfaces";
import { readFile, writeFile } from "fs/promises";
import { getFileExtension } from "../../../utils";

const baseUrl = process.env.DOCLING_URL || "http://localhost:5001";

export const parsePDF = async ({ source, dest, format }: ExtractionOptions) => {

    const client = new Docling({ api: { baseUrl, timeout: 30000 } });

    let destFileExtension = dest ? getFileExtension(dest) : null;
    if (destFileExtension && !['txt', 'md', 'html'].includes(destFileExtension)) {
        throw new Error('Unsupported destination file type. Supported types are .txt, .md, .html');
    }

    if (destFileExtension == 'txt') {
        format= 'text';
    }
    else {
        format = (destFileExtension ? destFileExtension : format)! as typeof format;
    }

    const buf = await readFile(source);
    const result = await client.convertFile({
        files: buf,
        filename: "input.pdf",
        to_formats: [format!],
    });

    const value = result.document[`${format!}_content`];

    if (dest) {
        await writeFile(dest, value!);
        console.log("Result written in file:", dest);
    }

    return value;
}
