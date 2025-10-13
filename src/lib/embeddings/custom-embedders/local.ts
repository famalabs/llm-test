import { pipeline } from "@huggingface/transformers";
import { exec, execFile } from "child_process";
import os from "os";
import path from "path";

class LocalEmbeddings {
    private model: string;
    private truncate_dim: number | null = null;
    private extractor: any = null;
    private usePythonBackend: boolean = false;

    constructor({ model, dimensions }: { model: string, dimensions?: number }) {
        this.model = model;
        if (dimensions) {
            this.truncate_dim = dimensions;
        }
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
embeddings = model.encode(${JSON.stringify(textsArray)}, prompt_name="query"${this.truncate_dim ? `, truncate_dim=int("${this.truncate_dim}")` : ''})
print(json.dumps(embeddings.tolist()))
        `.trim();
        
        return new Promise((resolve, reject) => {

            let commandFunction: (callback: (error: Error | null, stdout: string, stderr: string) => void) => void;

            const platform = os.platform();

            if (platform === 'win32') {
                const venvPython = path.join(process.cwd(), ".venv", "Scripts", "python.exe");
                commandFunction = (callback: (error: Error | null, stdout: string, stderr: string) => void) => {
                    execFile(
                        venvPython, ['-u', '-c', pythonCode], 
                        { maxBuffer: textsArray.length * 1024 * 24 }, 
                        callback);
                }
            } 
            else if (platform == 'darwin' || platform == 'linux') {
                commandFunction = (callback: (error: Error | null, stdout: string, stderr: string) => void) => {
                    exec(`source .venv/bin/activate && python -c "${pythonCode.replace(/"/g, '\\"')}"`, callback);
                }
            }
            else {
                return reject(new Error(`Unsupported platform: ${platform}`));
            }

            commandFunction((error, stdout, stderr) => {
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
