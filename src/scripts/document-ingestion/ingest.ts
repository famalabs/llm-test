import { hideBin } from "yargs/helpers";
import { getFileExtension } from '../../utils';
import { parseDoc, parsePDF, parseDocx } from "./extractors";
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
    const dest = argv.destination;

    const extension = getFileExtension(source);

    switch (extension) {
        case 'doc':
            return await parseDoc({ source, dest });
        case 'docx':
            return await parseDocx({ source, dest });
        case 'pdf':
            return await parsePDF({ source, dest });
        default:
            throw new Error('Unsupported file type. Supported types are .doc, .docx, .pdf');
    }
}

ingest().catch(console.error).then(() => process.exit(0));