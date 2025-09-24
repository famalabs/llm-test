import { parseDoc, parsePDF, parseDocx } from "../../lib/ingestion";
import { readFile, writeFile } from "fs/promises";
import { getFileExtension } from '../../utils';
import { hideBin } from "yargs/helpers";
import yargs from "yargs";

const ingest = async () => {
    const argv = await yargs(hideBin(process.argv))
        .option('source', {
            alias: 's',
            description: 'Path to the source file (.doc, .docx, .pdf)',
            type: 'string',
            demandOption: true
        })
        .option('destination', {
            alias: 'd',
            description: 'Path to the destination file (optional)',
            type: 'string',
            demandOption: false
        })
        .help()
        .parse();

    const source = argv.source;
    const extension = getFileExtension(source!);
    const dest = argv.destination;
    const destinationFileType = dest ? getFileExtension(dest) : 'text';
    const destinationFileFormat =   destinationFileType === 'md' ? 'markdown' : destinationFileType === 'html' ? 'html' : 'text';

    const inputFileBuffer = await readFile(source!);
    let outputString: string;

    const start = performance.now();

    switch (extension) {
        case 'doc':
            outputString = await parseDoc(inputFileBuffer,  destinationFileFormat );
            break;
        case 'docx':
            outputString = await parseDocx(inputFileBuffer, destinationFileFormat );
            break;
        case 'pdf':
            outputString = await parsePDF(inputFileBuffer, destinationFileFormat);
            break;
        default:
            throw new Error('Unsupported file type. Supported types are .doc, .docx, .pdf');
    }

    const end = performance.now();

    console.log(`Ingestion completed in ${(end - start).toFixed(2)} ms`);

    if (dest) {
        await writeFile(dest!, outputString);
    }

    else {
        console.log(outputString);
    }
}

ingest().catch(console.error).then(() => process.exit(0));