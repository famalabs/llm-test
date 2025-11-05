import { createOutputFolderIfNeeded, getFileExtension, PATH_NORMALIZATION_MARK } from '../../utils';
import { parseDoc, parseDocx } from '../../lib/ingestion';
import { readFile, writeFile } from "fs/promises";
import { LLMConfigProvider } from '../../llm';
import { hideBin } from 'yargs/helpers';
import yargs from "yargs";
import path from 'path';
import 'dotenv/config';
import { extractTherapyAsMarkdownTable, extractStructuredTherapy } from '../../lib/therapy';


const main = async () => {
    const argv = await yargs(hideBin(process.argv))
        .option('source', { alias: 's', type: 'string', demandOption: true, description: 'Path to the source file (.doc or .docx)' })
        .option('model', { alias: 'm', type: 'string', default: 'mistral-small-latest', description: 'LLM model id, e.g., mistral-small-latest', demandOption: true })
        .option('provider', { alias: 'p', type: 'string', default: 'mistral', description: 'LLM provider, e.g., mistral', demandOption: true, choices: ['mistral', 'openai', 'google'] })
        .help()
        .parse();

    const { source, model, provider } = argv;

    const sourceExtension = getFileExtension(source!);
    let text: string | undefined = undefined;

    if (sourceExtension == 'docx') {
        console.log('Will parse .docx file');
        const inputBuffer = await readFile(source!);
        const outputBuffer = await parseDocx(inputBuffer, 'text');
        text = outputBuffer;
    }
    else if (sourceExtension == 'doc') {
        console.log('Will parse .doc file');
        const inputBuffer = await readFile(source!);
        const outputBuffer = await parseDoc(inputBuffer, 'text');
        text = outputBuffer;
    }
    else {
        console.error('Unsupported file type. Only .doc and .docx are supported.');
        process.exit(1);
    }

    if (!text) {
        throw new Error('No conversion result returned.');
    }
    
    console.log('Extracting therapy table...');
    let start = performance.now();
    const markdown = await extractTherapyAsMarkdownTable(text, model, provider as LLMConfigProvider);
    console.log(`Therapy table extraction took ${performance.now() - start} milliseconds`);


    console.log('Extracting structure...');
    start = performance.now();
    const therapyDrugs = await extractStructuredTherapy(markdown, model, provider as LLMConfigProvider);
    console.log(`Structure extraction took ${performance.now() - start} milliseconds`);

    const outDir = createOutputFolderIfNeeded('output', 'document-ingestion', 'therapy');
    let outputFile = path.join(outDir, `structured-therapy-${source!.replaceAll('/', PATH_NORMALIZATION_MARK)}.json`);
    await writeFile(outputFile, JSON.stringify(therapyDrugs, null, 2));
    console.log('Extracted structured therapy written to:', outputFile);
}


main().catch(console.error).then(() => process.exit(0));