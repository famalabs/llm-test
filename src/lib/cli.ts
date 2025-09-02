import { appendFileSync, mkdirSync } from "fs";
import { RagMode } from "../constants/rag";
import * as readline from 'node:readline/promises';

const terminal = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

export const getUserInput = async (prompt: string) => {
    return await terminal.question(prompt)
}

export const parseCliArgs = (args: string[]) => {

    const result: { [key: string]: string | undefined } = {};

    for (const requiredArg of args) {
        result[requiredArg] = process.argv.find(arg => arg.startsWith('--' + requiredArg + '='))?.split('=')[1];
        if (!result[requiredArg]) {
            console.error(`Missing required CLI argument: --${requiredArg}`);
            process.exit(1);
        }
    }


    return result;
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

