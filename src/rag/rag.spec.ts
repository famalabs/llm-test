import { customLLMAsAJudge } from "../test/evaluations/llm-as-a-judge";
import { readDocument } from "../utils";
import { addLineNumbers, LanguageLabel } from "../lib/nlp";
import { RAG_CORPUS_IN_CONTEXT_PROMPT } from "../lib/prompt";
import { getLLMProvider, LLMConfigProvider } from "../llm";
import { generateObject } from "ai";
import z from "zod";
import 'dotenv/config';

global.AI_SDK_LOG_WARNINGS = false;

jest.setTimeout(60 * 1000);

const MODEL_PROVIDER = {
    model: "gpt-4.1-mini",
    provider: "openai" as LLMConfigProvider,
}

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
    const prompt = RAG_CORPUS_IN_CONTEXT_PROMPT(
        testData[idx].question,
        chunks.map((document) => ({
            ...document,
            pageContent: addLineNumbers(document.pageContent),
        })),
        { detectedLanguage: 'italian' as LanguageLabel }
    );

    const { object: result } = await generateObject({
        model: (await getLLMProvider(MODEL_PROVIDER.provider))(MODEL_PROVIDER.model),
        prompt,
        schema: z.object({ answer: z.string() }),
    });

    const { answer } = result;
    const { score } = await customLLMAsAJudge.execute({
        query: testData[idx].question,
        keyRef: testData[idx].keyRef,
        fullRef: testData[idx].fullRef,
        candidate: answer,
        model : 'mistral-small-latest',
        provider : 'mistral',
    });

    expect(score).toBeGreaterThanOrEqual(0.8);
}

test.concurrent("RAG - corpus in context, question 1", async () => await testPrompt(0));
test.concurrent("RAG - corpus in context, question 2", async () => await testPrompt(1));