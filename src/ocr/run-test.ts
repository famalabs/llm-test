import { createOutputFolderIfNeeded, PATH_NORMALIZATION_MARK } from '../utils';
import { mistralOcr, openaiOcr, localOcr, doclingOcr } from './lib';
import { readFile, writeFile } from 'fs/promises';
import { hideBin } from 'yargs/helpers';
import yargs from 'yargs';
import path from 'path';
import 'dotenv/config';

const main = async () => {
    const { input, engine, model } = await yargs(hideBin(process.argv))
        .option('input', { alias: 'i', type: 'string', demandOption: true, description: 'Path to the audio file to transcribe' })
        .option('engine', { alias: 'e', type: 'string', choices: ['mistral', 'openai', 'local', 'docling'], demandOption: true, description: 'OCR engine to use' })
        .option('model', { alias: 'm', type: 'string', description: 'Openai model to use (if applicable)' })
        .help()
        .parse() as {
            input: string,
            engine: 'mistral' | 'openai' | 'local' | 'docling',
            model?: string
        };

    const engines = {
        'mistral': mistralOcr,
        'openai': openaiOcr,
        'local': localOcr,
        'docling': doclingOcr,
    };

    const inputBuffer = await readFile(input);

    const start = performance.now();
    const text = await (engines[engine])(inputBuffer, model ? { model } : undefined);
    const end = performance.now();

    const outputFile = path.join(
        createOutputFolderIfNeeded('output', 'ocr'),
        `${input.replaceAll(path.sep, PATH_NORMALIZATION_MARK)}-${engine}${model ? `-${model}` : ''}.md`
    );

    const header = `[ ENGINE = ${engine}, MS = ${end - start} ]\n\n`;

    await writeFile(outputFile, header + text);
    console.log('OCR completed. Output written to:', outputFile);
}


main().catch(console.error).then(() => process.exit(0));