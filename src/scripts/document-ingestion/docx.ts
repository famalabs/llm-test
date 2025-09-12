import mammoth from 'mammoth';
import { parseCliArgs } from '../../lib/cli';
import { getFileExtension } from '../../lib/utils';
import { writeFile } from 'fs/promises';

const main = async () => {
    const { source, dest } = parseCliArgs(['source', 'dest'], ['dest']);

    const sourceExtension = getFileExtension(source!);

    if ('docx' != sourceExtension) throw new Error('Source must be a .docx file');

    let operation = 'extractRawText';
    let destinationFile: string | null = dest ? dest : null;

    if (dest) {
        const destinationExtension = getFileExtension(dest);
        if (destinationExtension == 'html') {
            operation = 'convertToHtml';
        }
        else if (destinationExtension != 'txt') {
            throw new Error('Unsupported destination extension.');
        }
    }

    const { value, messages } = await (mammoth as any)[operation]({ path: source! });

    if (messages) {
        console.warn(messages);
    }

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