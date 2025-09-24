import mammoth from 'mammoth';
import { NodeHtmlMarkdown } from 'node-html-markdown';
import { DocumentIngester } from './interfaces';

export const parseDocx: DocumentIngester = async (inputBuffer: Buffer, outputFormat: 'text' | 'markdown' | 'html') => {

    let operation: keyof typeof mammoth = outputFormat == 'text' ? 'extractRawText' : 'convertToHtml';

    let { value, messages } = await (mammoth)[operation]({
        buffer: inputBuffer
    });

    if (messages.length > 0) {
        console.warn(messages);
    }

    if (outputFormat == 'markdown') {
        const nhm = new NodeHtmlMarkdown();
        const markdown = nhm.translate(value);
        value = markdown;
    }

    return value;
}
