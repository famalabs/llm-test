import { z } from 'zod';
import { mistral } from '@ai-sdk/mistral';
import yargs from "yargs";
import { generateObject, ModelMessage } from 'ai';
import {
    parseDocx,
    parseDoc,
} from './extractors';
import { createOutputFolderIfNeeded, getFileExtension } from '../../utils';
import { writeFile } from "fs/promises";
import { PATH_NORMALIZATION_MARK } from "../../lib/nlp";
import 'dotenv/config';
import { hideBin } from 'yargs/helpers';
import { therapyExtractionPrompt } from '../../lib/prompt';

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
        text = await parseDocx({ source: source! });
    }
    else if (sourceExtension === 'doc') {
        console.log('Will parse .doc file');
        text = await parseDoc({ source: source! });
    }
    else {
        console.error('Unsupported file type');
        process.exit(1);
    }

    if (!text) throw new Error('No conversion result returned.')

    console.log('Extracting therapy...');
    const rawTherapy = await extractTherapy(text);

    let outputFile = `${createOutputFolderIfNeeded('output/document-ingestion/therapy')}/therapy-${source!.replaceAll('/', PATH_NORMALIZATION_MARK)}.md`;
    await writeFile(outputFile, rawTherapy);
    console.log('Extracted therapy written to:', outputFile);
}


main().catch(console.error).then(() => process.exit(0));