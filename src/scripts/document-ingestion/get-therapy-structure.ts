import { createOutputFolderIfNeeded, getFileExtension, PATH_NORMALIZATION_MARK } from '../../utils';
import { GET_THERAPY_STRUCTURE_PROMPT, THERAPY_EXTRACTION_PROMPT } from '../../lib/prompt';
import { parseDoc, parseDocx } from '../../lib/ingestion';
import { generateObject, ModelMessage } from 'ai';
import { readFile, writeFile } from "fs/promises";
import { getLLMProvider, LLMConfigProvider } from '../../llm';
import { hideBin } from 'yargs/helpers';
import { z } from 'zod';
import yargs from "yargs";
import path from 'path';
import 'dotenv/config';

const TherapySchema = z.object({
    therapy_drugs: z.array(z.object({
        drug: z.string().describe('Name of the drug'),
        notes: z.string().optional().describe('Additional notes about the drug administration'),
        schedule: z.object({
            day: z.number().describe('Starting day from 0'),
            hours: z.array(z.string().regex(/^\d{2}:\d{2}$/)).optional()
                .describe('Times in "HH:MM" 24h'),
            duration: z.number().optional().describe('Total duration in days'),
            period_duration: z.number().optional()
                .describe('Cycle length in days (1=daily, 2=q48h, 7=weekly, 30=monthly)'),
            dose: z.number().describe('Units per administration (tablets, ml, puffs, drops, etc.)'),
            period_days: z.array(z.object({
                day: z.number().describe('Index in cycle starting from 0'),
                hours: z.array(z.string().regex(/^\d{2}:\d{2}$/)).optional()
                    .describe('Times for this period day'),
                dose: z.number().describe('Units per administration for this period day (required)')
            })).optional().describe('Specific days within the period (must include dose per item)')
        }).describe('Therapy schedule including timing and duration details')
    }))
});


const getTherapyStructure = async (text: string, model: string, provider: LLMConfigProvider) => {

    const llm = (await getLLMProvider(provider))(model);

    const { object: result } = await generateObject({
        model: llm,
        schema: TherapySchema,
        temperature: 0,
        messages: [
            { role: "system", content: GET_THERAPY_STRUCTURE_PROMPT() },
            { role: "user", content: `Extract the structure of the therapy from the following medical text:\n\n TEXT:"""${text}"""` }
        ] as ModelMessage[]
    });

    return result.therapy_drugs;
};


const extractTherapy = async (text: string, model: string, provider: LLMConfigProvider) => {

    const llm = (await getLLMProvider(provider))(model);

    const { object: result } = await generateObject({
        model: llm,
        schema: z.object({
            markdown: z.string().describe('Single Markdown string containing ONLY a well-formatted drug table with all current therapy information (no extra text), using the same language as the input text.')
        }),
        temperature: 0,
        messages: [
            { role: "system", content: THERAPY_EXTRACTION_PROMPT() },
            { role: "user", content: `Extract the current therapy from the following medical text:\n\n TEXT:"""${text}"""` }
        ] as ModelMessage[]
    });

    return result.markdown;
};



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
    const markdown = await extractTherapy(text, model, provider as LLMConfigProvider);
    console.log(`Therapy table extraction took ${performance.now() - start} milliseconds`);


    console.log('Extracting structure...');
    start = performance.now();
    const therapyDrugs = await getTherapyStructure(markdown, model, provider as LLMConfigProvider);
    console.log(`Structure extraction took ${performance.now() - start} milliseconds`);

    const outDir = createOutputFolderIfNeeded('output', 'document-ingestion', 'therapy');
    let outputFile = path.join(outDir, `structured-therapy-${source!.replaceAll('/', PATH_NORMALIZATION_MARK)}.json`);
    await writeFile(outputFile, JSON.stringify(therapyDrugs, null, 2));
    console.log('Extracted structured therapy written to:', outputFile);
}


main().catch(console.error).then(() => process.exit(0));