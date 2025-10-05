import { readDocument } from "../utils";
import { addLineNumbers } from "../lib/nlp";
import { ragCorpusInContext } from "../lib/prompt";
import { getLLMProvider } from "./factory";
import { generateObject } from "ai";
import z from "zod";
import { customLLMAsAJudge } from '../scripts/evaluations/metrics';

jest.setTimeout(30 * 1000);

const testData = [
    {
        question: "Quali sono le controindicazioni di OKI?",
        fullRef: "OKI è controindicato in diverse condizioni ...",
        keyRef: "OKI è controindicato in caso di ...",
        objective: "Verificare la completezza..."
    },
    {
        "question": "OKI crea dipendenza?",
        "fullRef": "Non è noto che il farmaco OKI dia origine a fenomeni di assuefazione o di dipendenza.",
        "keyRef": "Non ci sono evidenze che OKI crei dipendenza.",
        "objective": "Verificare l'interpretazione corretta: la risposta deve riflettere che 'non è noto' non equivale a 'NO', ma indica assenza di evidenze."
    }
];

let chunks: any[];

beforeAll(async () => {
    const doc = await readDocument("local/oki_full.txt");
    chunks = [{
        pageContent: doc,
        metadata: {
            source: "data/oki_full.txt",
        },
        distance: 0.1,
    }];
});

async function testPrompt(idx: number) {
    const prompt = ragCorpusInContext(
        chunks.map((document) => ({
            ...document,
            pageContent: addLineNumbers(document.pageContent),
        })),
        testData[idx].question
    );

    const { object: result } = await generateObject({
        model: (await getLLMProvider("mistral"))("mistral-small-latest"),
        prompt,
        schema: z.object({ answer: z.string() }),
    });

    const { answer } = result;
    const { score } = await customLLMAsAJudge.execute({
        query: testData[idx].question,
        keyRef: testData[idx].keyRef,
        fullRef: testData[idx].fullRef,
        prediction: answer,
        llm: "mistral-small-latest",
    });

    expect(score).toBeGreaterThanOrEqual(0.8);
}

test("Test prompt RAG (corpus in context, question 1)", async () => await testPrompt(0));
test("Test prompt RAG (corpus in context, question 2)", async () => await testPrompt(1));