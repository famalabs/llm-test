import WordExtractor from "word-extractor";
import { getFileExtension } from '../../../lib/utils';
import { writeFile } from 'fs/promises';
import { ExtractionOptions } from "./interfaces";

const extractor = new WordExtractor();

export const parseDoc = async ({ source, dest } : ExtractionOptions) => {

    const sourceExtension = getFileExtension(source!);

    if ('doc' != sourceExtension) throw new Error('Source must be a .doc file');
    let destinationFile: string | null = dest ? dest : null;

    const extracted = await extractor.extract(source!);
    const value = extracted.getBody();

    if (!value) throw new Error('No conversion result returned.')

    if (destinationFile) {
        await writeFile(dest!, value);
        console.log('Result written in file:', dest!);
    }
    return value;
}