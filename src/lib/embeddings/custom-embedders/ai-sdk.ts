import { embed, embedMany, Provider } from 'ai';
import 'dotenv/config';

class AiSdkEmbeddings {
    private providerName: 'mistral' | 'openai' | 'google';
    private provider: Provider;
    private dimensions: number | undefined = undefined;
    private model: string;

    constructor({ model, dimensions, providerName }: { model: string, dimensions?: number, providerName: 'mistral' | 'openai' | 'google' }) {
        switch (providerName) {
            case 'mistral':
                if (dimensions) console.warn("Mistral embeddings have a fixed dimension of 1024. The provided dimension will be ignored.");
                const { mistral } = require('@ai-sdk/mistral');
                this.provider = mistral;
                break;
            case 'openai':
                const { openai } = require('@ai-sdk/openai');
                this.provider = openai;
                break;
            case 'google':
                const { google } = require('@ai-sdk/google');
                this.provider = google;
                break;
            default:
                throw new Error(`Unsupported embedding provider: ${providerName}`);
        }

        if (dimensions) {
            this.dimensions = dimensions;
        }
        this.model = model;
        this.providerName = providerName;
    }

    private addDimensionsArg(args: Record<string, any>) {
        if (this.dimensions && this.providerName == 'google') {
            args.providerOptions = { google: { outputDimensionality: this.dimensions } };
        }

        if (this.dimensions && this.providerName == 'openai') {
            args.providerOptions = { openai: { dimensions: this.dimensions } };
        }
    }

    public async embedQuery(text: string): Promise<number[]> {
        const args = {
            value: text,
            model: this.provider.textEmbeddingModel(this.model),
        };

        this.addDimensionsArg(args);

        const { embedding } = await embed(args);
        return embedding;
    }

    public async embedDocuments(texts: string[]): Promise<number[][]> {
        const args = {
            values: texts,
            model: this.provider.textEmbeddingModel(this.model),
        }

        this.addDimensionsArg(args);

        const { embeddings } = await embedMany(args);

        return embeddings;
    }
}

export { AiSdkEmbeddings };
