import { appendFileSync, mkdirSync } from "fs";
import { RagMode } from "../constants/rag";
import { RAGSystemConfig } from "../types";
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

    constructor({ 
        llm, 
        ragMode, 
        chunkingStrategy = null, 
        corpusInContextFiles = null,
        parentPageRetrieval = false,
        parentPageRetrievalOffset = null, 
        reranking = false,
        reasoning = false,
        fewShots = false
    }: RAGSystemConfig) {
        let folder = `output/sessions/${ragMode}/`;
        if (ragMode == RagMode.CorpusInContext) {

            if (!corpusInContextFiles) {
                console.error('No files provided for corpus-in-context RAG');
                process.exit(1);
            }
        }
        
        mkdirSync(folder, { recursive: true });

        const fileName = `${llm}_${Date.now()}.txt`;
        this.recordingPath = `${folder}${fileName}`;

        const header = `====== SESSION CONFIGURATION =====
        LLM = ${llm}, 
        RAG_MODE = ${ragMode}
        CORPUS_IN_CONTEXT_FILES = ${corpusInContextFiles}
        CHUNKING_STRATEGY = ${chunkingStrategy}
        PARENT_PAGE_RETRIEVAL = ${parentPageRetrieval} (OFFSET = ${parentPageRetrievalOffset})
        RERANKING = ${reranking}
        REASONING = ${reasoning}
        FEW_SHOTS = ${fewShots}\n==================================\n\n`;

        this.printSilent(header);
    }

    printSilent(...args: any[]) {
        appendFileSync(this.recordingPath, args.join(' ') + '\n');
    }

    print(...args: any[]) {
        this.printSilent(...args);
        console.log(...args);
    }
}

