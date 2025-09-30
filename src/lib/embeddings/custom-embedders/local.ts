import 'dotenv/config';
import { pipeline } from "@huggingface/transformers";
import { exec } from "child_process";
import os from "os";

class LocalEmbeddings {
    private model: string;
    private extractor: any = null;
    private usePythonBackend: boolean = false;

    constructor({ model }: { model: string }) {
        this.model = model;
    }

    private async load() {
        if (this.extractor || this.usePythonBackend) return;

        if (this.model == "Qwen/Qwen3-Embedding-0.6B") {
            console.log("⚠️ Using Python backend (ONNX not supported yet)");
            this.usePythonBackend = true;
            return;
        }

        this.extractor = await pipeline("feature-extraction", this.model);
    }

    private async pythonEmbed(texts: string | string[]): Promise<number[][]> {
        const textsArray = Array.isArray(texts) ? texts : [texts];
        const pythonCode = `
from sentence_transformers import SentenceTransformer
import json
model = SentenceTransformer("${this.model}")
embeddings = model.encode(${JSON.stringify(textsArray)}, prompt_name="query")
print(json.dumps(embeddings.tolist()))
        `.trim();

        return new Promise((resolve, reject) => {

            let command:any;

            const platform = os.platform();

            if (platform === 'win32') {
                // x EMA
            } 
            else if (platform == 'darwin' || platform == 'linux') {
                command = `source .venv/bin/activate && python -c "${pythonCode.replace(/"/g, '\\"')}"`;
            }
            else {
                return reject(new Error(`Unsupported platform: ${platform}`));
            }

            exec(command, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Error executing Python script:`, error);
                    return reject(error);
                }
                try {
                    const result = JSON.parse(stdout);
                    resolve(result);
                } catch (parseError) {
                    console.error(`Failed to parse Python output:`, parseError);
                    reject(parseError);
                }
            });
        });
    }

    public async embedQuery(text: string): Promise<number[]> {
        await this.load();

        if (this.usePythonBackend) {
            const result = await this.pythonEmbed(text);
            return result[0];
        }

        const result = await this.extractor(text);
        return Array.isArray(result[0]) ? result[0] : result;
    }

    public async embedDocuments(texts: string[]): Promise<number[][]> {
        await this.load();

        if (this.usePythonBackend) {
            return await this.pythonEmbed(texts);
        }

        const result = await this.extractor(texts);
        return result;
    }
}

export { LocalEmbeddings };
