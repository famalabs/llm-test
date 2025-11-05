import { experimental_transcribe as transcribe } from 'ai';
import { openai } from '@ai-sdk/openai';
import { readFile } from 'fs/promises';
import 'dotenv/config';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const main = async () => {
    const { input }  = await yargs(hideBin(process.argv))
        .option('input', { alias: 'i', type: 'string', demandOption: true, description: 'Path to the audio file to transcribe' })
        .help()
        .parse() as {
            input: string
        };

    const audioBuffer = await readFile(input);

    const start = performance.now();
    const result = await transcribe({
        model: openai.transcription('whisper-1'),
        audio: audioBuffer,
        providerOptions: {
            openai: {
                language: 'it',
            },
        },
    });
    const end = performance.now();

    console.log('Text:', result.text);
    console.log(`Transcription took ${end - start} milliseconds`);
}


main().catch(console.error).then(() => process.exit(0));