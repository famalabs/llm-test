import 'dotenv/config';
import { GoogleGenAI } from "@google/genai";

class GoogleGenerativeAIEmbeddings {
    private apiKey: string;
    private model: string;
    private ai: GoogleGenAI;

    constructor({ model }: { model: string }) {
        this.apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY!;
        if (!this.apiKey) {
            throw new Error("GOOGLE_GENERATIVE_AI_API_KEY environment variable is not set.");
        }
        this.model = model;
        this.ai = new GoogleGenAI({
            apiKey: this.apiKey,
        });
    }

    private async requestEmbeddings(input: string | string[]): Promise<any> {
        try {
            const response = await this.ai.models.embedContent({
                model: this.model,
                contents: input,
            });

            return response.embeddings?.map(el => el.values);
        } catch (err) {
            console.error("Error fetching embeddings:", err);
            throw err;
        }
    }

    public async embedQuery(text: string): Promise<number[]> {
        return (await this.requestEmbeddings(text))[0];
    }

    public async embedDocuments(texts: string[]): Promise<number[][]> {
        return await this.requestEmbeddings(texts);
    }
}

export { GoogleGenerativeAIEmbeddings };
