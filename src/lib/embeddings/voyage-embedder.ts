import 'dotenv/config';

class VoyageAIEmbeddings {
    private apiKey: string;
    private model: string;
    private baseUrl = "https://api.voyageai.com/v1/embeddings";

    constructor({ model }: { model: string }) {
        this.apiKey = process.env.VOYAGE_API_KEY!;
        if (!this.apiKey) {
            throw new Error("VOYAGE_API_KEY environment variable is not set.");
        }
        this.model = model;
    }

    private async requestEmbeddings(input: string | string[]): Promise<any> {
        try {
            const response = await fetch(this.baseUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    input,
                    model: this.model,
                    input_type: "document"
                })
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Voyage API request failed (${response.status}): ${text}`);
            }

            return await response.json();
        } catch (err) {
            console.error("Error fetching embeddings:", err);
            throw err;
        }
    }

    public async embedQuery(text: string): Promise<number[]> {
        const result = await this.requestEmbeddings(text);
        if (!result?.data?.[0]?.embedding) {
            throw new Error("Invalid response format from Voyage API.");
        }
        return result.data[0].embedding;
    }

    public async embedDocuments(texts: string[]): Promise<number[][]> {
        const result = await this.requestEmbeddings(texts);
        if (!result?.data || !Array.isArray(result.data)) {
            throw new Error("Invalid response format from Voyage API.");
        }
        return result.data.map((item: any) => item.embedding);
    }
}

export { VoyageAIEmbeddings };
