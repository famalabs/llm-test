import { appendFileSync, mkdirSync } from "fs";
import { RagMode } from "../types/rag";

export const parseCliArgs = () => {
    const llm = process.argv.find(arg => arg.startsWith('--llm='))?.split('=')[1];
    const filesPath = process.argv.find(arg => arg.startsWith('--files='))?.split('=')[1];

    if (!llm || !filesPath) {
        console.error('Missing required CLI arguments: --llm and --files must be provided');
        process.exit(1);
    }

    return {
        llm,
        filesPath: filesPath.split(',')
    }
}

export class CliSessionRecording {
    private recordingPath: string;

    constructor(public llm: string, public ragMode: RagMode, public corpusInContextFiles: string[] | null = null) {
        let folder = `output/sessions/${ragMode}/`;
        if (ragMode == RagMode.CorpusInContext) {

            if (!corpusInContextFiles) {
                console.error('No files provided for corpus-in-context RAG');
                process.exit(1);
            }

            if (corpusInContextFiles.length > 1) {
                folder += `multiple_files/`;
            }
            else {
                folder += 'single_file/';
            }
        }

        mkdirSync(folder, { recursive: true });

        const fileName = `${llm}_${Date.now()}.txt`;
        this.recordingPath = `${folder}${fileName}`;
        const header = `[ === LLM = ${llm}, RAG_MODE = ${ragMode}${corpusInContextFiles ? (', FILES = ' + corpusInContextFiles) : ''} === ]`;
        this.printSilent(header)
    }

    printSilent(...args: any[]) {
        appendFileSync(this.recordingPath, args.join(' ') + '\n');
    }

    print(...args: any[]) {
        this.printSilent(...args);
        console.log(...args);
    }
}

