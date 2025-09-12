import { PreTrainedTokenizer } from "@huggingface/transformers";
import keywordExtractor from 'keyword-extractor';

export const splitTextIntoSentences = (text: string, language: 'it'): string[] => {
    const segmenter = new Intl.Segmenter(language, { granularity: 'sentence' });
    return Array.from(segmenter.segment(text)).map(segment => segment.segment.trim()).filter(sentence => sentence.length > 0);
};

export const addLineNumbers = (text: string): string => {
    return text.split('\n').map((line, idx) => `${idx}: ${line}`).join('\n');
};

export const getCitationText = (document: string, startIndex: number, endIndex: number): string => {
    return document.split('\n').slice(startIndex, endIndex + 1).join('\n') || '';
};

export const computeTokenNumber = async (document: string, model: { hub: string }): Promise<number> => {
    const tokenizer = await PreTrainedTokenizer.from_pretrained(model.hub);
    const tokens = tokenizer.encode(document);
    return tokens.length;
}

export const extractKeywords = (text: string): string[] => {
    return keywordExtractor.extract(text, {
        language: 'italian',
        remove_digits: true,
        return_changed_case: true,
        remove_duplicates: true
    });
}