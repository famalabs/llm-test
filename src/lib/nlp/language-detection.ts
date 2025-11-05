import { Pipeline, PipelineType } from '@huggingface/transformers';
import { LanguageLabel } from './interfaces';
import { loadModel } from './load-model';

let languageDetectionModel: Pipeline | null = null;

const languageMap: Record<string, LanguageLabel> = {
    'ar': 'arabic',
    'bg': 'bulgarian',
    'de': 'german',
    'el': 'modern greek',
    'en': 'english',
    'es': 'spanish',
    'fr': 'french',
    'hi': 'hindi',
    'it': 'italian',
    'ja': 'japanese',
    'nl': 'dutch',
    'pl': 'polish',
    'pt': 'portuguese',
    'ru': 'russian',
    'sw': 'swahili',
    'th': 'thai',
    'tr': 'turkish',
    'ur': 'urdu',
    'vi': 'vietnamese',
    'zh': 'chinese',
}

export const detectLanguage = async (text: string, returnFullLanguageLabel: boolean = false): Promise<LanguageLabel> => {
    if (!languageDetectionModel) {
        //@ts-ignore "too complex type to represent"
        languageDetectionModel = await loadModel(
            'text-classification' as PipelineType, 
            './local/models/xlm-roberta-base-language-detection-onnx'
        );
    }

    const result = await languageDetectionModel!(text);
    return returnFullLanguageLabel ? (languageMap[result[0]['label'] as keyof typeof languageMap] || 'unknown') : result[0].label;
}