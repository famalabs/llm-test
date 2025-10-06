import { createOutputFolderIfNeeded, getFileExtension, PATH_NORMALIZATION_MARK } from '../../utils';
import { therapyExtractionPrompt } from '../../lib/prompt';
import { parseDoc, parseDocx } from '../../lib/ingestion';
import { generateObject, ModelMessage } from 'ai';
import { readFile, writeFile } from "fs/promises";
import { mistral } from '@ai-sdk/mistral';
import { hideBin } from 'yargs/helpers';
import { z } from 'zod';
import yargs from "yargs";
import path from 'path';
import 'dotenv/config';

const extractTherapy = async (text: string) => {
    const { object: result } = await generateObject({
        model: mistral('mistral-small-latest'),
        schema: z.object({
            markdown: z.string().describe('Single Markdown string containing ONLY a well-formatted drug table with all current therapy information (no extra text), using the same language as the input text.')
        }),
        temperature: 0,
        messages: [
            { role: "system", content: therapyExtractionPrompt },
            { role: "user", content: `Extract the current therapy from the following medical text:\n\n TEXT:"""${text}"""` }
        ] as ModelMessage[]
    });

    return result.markdown;
};


const main = async () => {
    const argv = await yargs(hideBin(process.argv))
        .option('source', { alias: 's', type: 'string', demandOption: true, description: 'Path to the source file (.doc or .docx)' })
        .help()
        .parse();
        
    const { source } = argv;

    const sourceExtension = getFileExtension(source!);
    let text: string | undefined = undefined;

    if (sourceExtension === 'docx') {
        console.log('Will parse .docx file');
        const inputBuffer = await readFile(source!);
        const outputBuffer = await parseDocx(inputBuffer, 'text');
        text = outputBuffer;
    }
    else if (sourceExtension === 'doc') {
        console.log('Will parse .doc file');
        const inputBuffer = await readFile(source!);
        const outputBuffer = await parseDoc(inputBuffer, 'text');
        text = outputBuffer;
    }
    else {
        console.error('Unsupported file type');
        process.exit(1);
    }

    if (!text) throw new Error('No conversion result returned.')

    console.log('Extracting therapy...');
    const rawTherapy = await extractTherapy(text);

    const outDir = createOutputFolderIfNeeded('output','document-ingestion','therapy');
    let outputFile = path.join(outDir, `therapy-${source!.replaceAll('/', PATH_NORMALIZATION_MARK)}.md`);
    await writeFile(outputFile, rawTherapy);
    console.log('Extracted therapy written to:', outputFile);
}


main().catch(console.error).then(() => process.exit(0));