import { Rag } from "../rag";
import { AnswerFormatInterface, getRagAgentToolFunction } from "../rag/rag-tool";

const main = async () => {
    const rag = new Rag({
        vectorStoreName: 'vector_store_index_fixed_size',
        llm: 'mistral-small-latest',
        numResults: 15,
        reranking: {
            enabled: true,
            llm: 'mistral-small-latest',
            chunkFiltering: {
                enabled: true,
                thresholdMultiplier: 0.66,
            }
        }, 
        output: {
            chunksOrAnswerFormat: 'answer',
        },
        verbose: true,
    });

    await rag.init();
    rag.printSummary();
    const getRagAnswer = getRagAgentToolFunction(rag);

    const query = 'Quali sono gli effetti collaterali di OKI?'
    const ragAnswer = await getRagAnswer(query) as AnswerFormatInterface;
    console.log('RAG ANSWER:', ragAnswer.answer);
}

main().catch(console.error).then(_ => process.exit(0));