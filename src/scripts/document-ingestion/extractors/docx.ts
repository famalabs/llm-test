import mammoth from 'mammoth';
import { getFileExtension } from '../../../utils';
import { writeFile } from 'fs/promises';
import { ExtractionOptions } from './interfaces';

export const parseDocx = async ({ source, dest, format } : ExtractionOptions) => {

    const sourceExtension = getFileExtension(source!);

    if ('docx' != sourceExtension) throw new Error('Source must be a .docx file');

    let operation = 'extractRawText';
    let destinationFile: string | null = dest ? dest : null;

    if (dest) {
        const destinationExtension = getFileExtension(dest);
        if (destinationExtension == 'html') {
            operation = 'convertToHtml';
        }
        else if (destinationExtension == 'md') {
            operation = 'convertToMarkdown';
        }
        else if (destinationExtension != 'txt') {
            throw new Error('Unsupported destination extension.');
        }
    }
    else {
        if (format == 'html') {
            operation = 'convertToHtml';
        }
        else if (format == 'md') {
            operation = 'convertToMarkdown';
        }
    }

    const { value, messages } = await (mammoth as any)[operation]({ path: source! });

    if (messages.length > 0) {
        console.warn(messages);
    }

    if (!value) throw new Error('No conversion result returned.')

    if (destinationFile) {
        await writeFile(dest!, value);
        console.log('Result written in file:', dest!);
    }
    return value;
}
