import evaluationData from '../../data/evaluation.json';
import { existsSync, mkdirSync } from "fs";
import { parseCliArgs } from "../lib/cli";
import { generateObject } from "ai";
import { google } from '@ai-sdk/google';
import { allPrompts } from '../lib/prompt';
import z from 'zod';
import { Rag } from '../rag';
import { writeFile } from 'fs/promises';
import { sleep } from '../lib/utils';
import { getRagAgentToolFunction } from '../rag/rag-tool';

const compare = async (expectedAnswer:string, givenAnswer:string, llm: string) => {
    const { object: result} = await generateObject({
        model: google(llm),
        temperature: 0,
        prompt: allPrompts.evaluationSystemPrompt(expectedAnswer, givenAnswer),
        schema: z.object({
            score: z.number().min(0).max(1).describe('A score from 0 to 1, where 0 means the answer is completely wrong and 1 means the answer is completely correct.'),
            explanation: z.string().describe('A short explanation (1-2 sentences) justifying the score.')
        })
    });

    return { score: result.score, explanation: result.explanation  };
}

const createOutputFolderIfNeeded = () =>{
    const outputFolder = 'output/evaluations';
    if (!existsSync(outputFolder)) mkdirSync(outputFolder, { recursive: true });
    return outputFolder;
}

const main = async () => {

    const { llm, chunking } = parseCliArgs(['llm', 'chunking']);
    const { evaluationConfiguration, questions } = evaluationData;
    const rag = new Rag({
        vectorStoreName: `vector_store_index_${chunking}`,
        llm: llm, 
        numResults: 3, 
        output: {
            chunksOrAnswerFormat: 'answer',
            reasoningEnabled: true,
            includeCitations: false,
            fewShotsEnabled: true,
        }
    });

    await rag.init();
    rag.printSummary();
    const getRagAnswer = getRagAgentToolFunction(rag);

    const outCome = {};

    for (const { question, expectedAnswer } of questions) {
        console.log('Processing question:', question);
        
        const ragAnswer = await getRagAnswer(question);
        
        console.log('Evaluating answer...');
        const { score, explanation } = await compare(
            expectedAnswer,
            ragAnswer as string, 
            evaluationConfiguration.llm
        );

        outCome[question] = { score, explanation };
        console.log('Score:', score, 'Explanation:', explanation, '\n\n');
        await sleep(5);
    }

    const outputFolder = createOutputFolderIfNeeded();
    const outFile = `${outputFolder}/evaluation_${llm}_${Date.now()}.json`;
    await writeFile(outFile, JSON.stringify(outCome, null, 2));
    console.log('Evaluation results saved to', outFile);
}

main().catch(console.error).then(() => process.exit());