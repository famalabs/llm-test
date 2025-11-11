/**
 * ocrmypdf needed.
 * https://github.com/ocrmypdf/OCRmyPDF?tab=readme-ov-file#installation
 */

import path from "path";
import { OcrEngine } from "./interfaces";
import os from "os";
import { readFile, writeFile } from "fs/promises";
import { execFileSync } from "child_process";


export const localOcr: OcrEngine = async (inputBuffer) => {

    const inputPdf = path.join(os.tmpdir(), `input-${Date.now()}.pdf`);
    const outputPdf = path.join(os.tmpdir(), `output-${Date.now()}.pdf`);
    const sidecarTxt = path.join(os.tmpdir(), `output-${Date.now()}.txt`);

    await writeFile(inputPdf, inputBuffer);

    const args = [
        "--force-ocr",
        "--quiet",
        "--sidecar", 
        sidecarTxt,
        inputPdf,
        outputPdf,
    ];

    execFileSync("ocrmypdf", args);

    return await readFile(sidecarTxt, 'utf-8');
}