import { readFile, writeFile } from "fs/promises"
import yargs from "yargs"
import { Rag } from "../../rag";
import ragTestSuiteQuestions from '../../../data/rag-test-suite.json';
import { AnswerFormatInterface, getRagAgentToolFunction } from "../../rag/rag-tool";
import { createOutputFolderIfNeeded } from "../../utils";
import { hideBin } from "yargs/helpers";


const main = async () => {
    const { json } = await yargs(hideBin(process.argv))
        .option('json', { alias: 'j', type: 'string', demandOption: true, description: 'Path to RAG config JSON' })
        .help()
        .parse();

    const fileContent = await readFile(json!, 'utf-8');
    const config = JSON.parse(fileContent);
    const rag = new Rag(config);

    await rag.init();
    const summary = rag.printSummary();

    const getRagAnswer = getRagAgentToolFunction(rag);
    let reportFile = summary + '\n\n';

    for (const { question } of ragTestSuiteQuestions.questions) {
        console.log('[ === User\'s Question === ]:');
        console.log(question, '\n\n');
        const { answer } = await getRagAnswer(question) as AnswerFormatInterface;
        console.log('[ === Answer === ]:');
        console.log(answer, '\n\n');
        reportFile += `Question:\n${question}\n\nAnswer:\n${answer}\n\n========================\n\n`;
    }

    console.log('-----------------------------------\n');

    const fileName = `${createOutputFolderIfNeeded('output/evaluations/qualitative')}/qualitative-evaluation-${Date.now()}.txt`;
    await writeFile(fileName, reportFile);
    console.log('Report written to', fileName);
}

main().catch(console.error).then(_ => process.exit(0));