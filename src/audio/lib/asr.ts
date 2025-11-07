import { experimental_transcribe } from 'ai';
import { openai } from '@ai-sdk/openai';

export async function transcribe(input: Buffer): Promise<string> {
    const result = await experimental_transcribe({
        model: openai.transcription('gpt-4o-mini-transcribe'),
        audio: input,
        providerOptions: {
            openai: {
                language: 'it',
            },
        },
    });
    return result.text;
}
