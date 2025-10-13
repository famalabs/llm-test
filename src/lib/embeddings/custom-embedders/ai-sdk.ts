import { embed, embedMany, Provider } from 'ai';
import { EmbeddingProvider } from '../interfaces';

class AiSdkEmbeddings {
    private providerName: Omit<EmbeddingProvider, 'local'>;
    private provider: Provider;
    private dimensions: number | undefined = undefined;
    private model: string;
    private shouldNormalizeEmbeddings = false;

    constructor({ model, dimensions, providerName }: { model: string, dimensions?: number, providerName: Omit<EmbeddingProvider, 'local'> }) {
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

        if (providerName == 'google' && dimensions) { // mistral does not support dimension reduction, openai already normalizes embeddings
            this.shouldNormalizeEmbeddings = true;
        }

        this.model = model;
        this.providerName = providerName;
    }

    private normalizeEmbeddings(embedding: number[][]): number[][] {
        return embedding.map(vec => {
            const norm = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
            return vec.map(val => val / norm);
        });
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

        if (this.shouldNormalizeEmbeddings) {
            return this.normalizeEmbeddings([embedding])[0];
        }

        return embedding;
    }

    public async embedDocuments(texts: string[]): Promise<number[][]> {
        const args = {
            values: texts,
            model: this.provider.textEmbeddingModel(this.model),
        }

        this.addDimensionsArg(args);

        const { embeddings } = await embedMany(args);

        if (this.shouldNormalizeEmbeddings) {
            return this.normalizeEmbeddings(embeddings);
        }

        return embeddings;
    }
}

export { AiSdkEmbeddings };
