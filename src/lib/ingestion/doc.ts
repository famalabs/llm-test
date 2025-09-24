import WordExtractor from "word-extractor";
import { DocumentIngester } from "./interfaces";

const extractor = new WordExtractor();

export const parseDoc: DocumentIngester = async (inputBuffer: Buffer, outputFormat: 'text' | 'markdown' | 'html') => {

    if (outputFormat !== 'text') {
        throw new Error('Only text output format is supported for .doc files');
    }

    const extracted = await extractor.extract(inputBuffer);
    return extracted.getBody();
}