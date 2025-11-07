import { transcribe } from './lib';
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
    const text = await transcribe(audioBuffer);
    const end = performance.now();

    console.log('Text:', text);
    console.log(`Transcription took ${end - start} milliseconds`);
}


main().catch(console.error).then(() => process.exit(0));