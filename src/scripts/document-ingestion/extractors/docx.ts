import mammoth from 'mammoth';
import { getFileExtension } from '../../../utils';
import { writeFile } from 'fs/promises';
import { ExtractionOptions } from './interfaces';
import { NodeHtmlMarkdown } from 'node-html-markdown';

export const parseDocx = async ({ source, dest, format } : ExtractionOptions) => {

    const sourceExtension = getFileExtension(source!);

    if ('docx' != sourceExtension) throw new Error('Source must be a .docx file');

    let operation: keyof typeof mammoth = 'extractRawText';
    let destinationFile: string | null = dest ? dest : null;

    if (dest) {
        const destinationExtension = getFileExtension(dest);
        if (destinationExtension == 'html' || format == 'md')  {
            operation = 'convertToHtml';
        }
        else if (destinationExtension != 'txt') {
            throw new Error('Unsupported destination extension.');
        }
    }
    else {
        if (format == 'html' || format == 'md') {
            operation = 'convertToHtml';
        }
    }

    let { value, messages } = await (mammoth)[operation]({ path: source! });

    if (messages.length > 0) {
        console.warn(messages);
    }

    if (format=='md'){
        const nhm = new NodeHtmlMarkdown();
        const markdown = nhm.translate(value);
        value = markdown;
    }

    if (!value) throw new Error('No conversion result returned.')

    if (destinationFile) {
        await writeFile(dest!, value);
        console.log('Result written in file:', dest!);
    }
    return value;
}
