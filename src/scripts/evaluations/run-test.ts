import { readFile, writeFile } from "fs/promises"
import { parseCliArgs } from "../../lib/cli"
import { Rag } from "../../rag";
import { AnswerFormatInterface, getRagAgentToolFunction } from "../../rag/rag-tool";
import { existsSync, mkdirSync } from "fs";
import { tqdm } from "node-console-progress-bar-tqdm";
import { PATH_NORMALIZATION_MARK } from "../../lib/nlp";

const createOutputFolderIfNeeded = () => {
    const outputFolder = 'output/candidates';
    if (!existsSync(outputFolder)) mkdirSync(outputFolder, { recursive: true });
    return outputFolder;
}

const main = async () => {
    const { test : testFile, config : configFile } = parseCliArgs(['test', 'config']);

    if (
        testFile?.includes('_') || configFile?.includes('_') ||
        testFile?.includes(PATH_NORMALIZATION_MARK) || configFile?.includes(PATH_NORMALIZATION_MARK)
    ) {
        throw new Error('Filenames cannot contain underscores or colons');
    }

    const test: { questions: { question: string; expectedAnswer: string }[] } = await JSON.parse(await readFile(testFile!, 'utf-8'));
    const config = await JSON.parse(await readFile(configFile!, 'utf-8'));

    const rag = new Rag(config);

    await rag.init();

    const output : {
        results: { question: string; reference: string; candidate: string }[],
        config : object
    } = {
        results: [],
        config
    }
    const getRagAnswer = getRagAgentToolFunction(rag);

    for (const { question, expectedAnswer : reference } of tqdm(test.questions)) {
        const { answer: candidate } = await getRagAnswer(question) as AnswerFormatInterface;
        output.results.push({ question, reference, candidate });
    }

    const normalizedTestFile = (testFile!).replaceAll('/', PATH_NORMALIZATION_MARK);
    const normalizedConfigFile = (configFile!).replaceAll('/', PATH_NORMALIZATION_MARK);

    const fileName = `${createOutputFolderIfNeeded()}/${normalizedTestFile}_${normalizedConfigFile}.json`;
    await writeFile(fileName, JSON.stringify(output, null, 2));
    console.log('Report written to', fileName);
}

main().catch(console.error).then(_ => process.exit(0));