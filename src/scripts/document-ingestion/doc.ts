import WordExtractor from "word-extractor";
import { parseCliArgs } from '../../lib/cli';
import { getFileExtension } from '../../lib/utils';
import { writeFile } from 'fs/promises';

const extractor = new WordExtractor();

const main = async () => {
    const { source, dest } = parseCliArgs(['source', 'dest'], ['dest']);

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
    else {
        console.log(value);
    }
}

main().catch(console.error).then(() => process.exit(0))