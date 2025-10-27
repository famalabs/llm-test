import { splitTextIntoSentences } from '../lib/nlp';
import { LmaInput, LmaOutput } from './interfaces';
import { example_lma_tools } from './example.tools';
import { LLMConfigProvider } from '../llm';
import { Lma } from "./lma";
import * as allEval from './evaluation';
import 'dotenv/config';

jest.setTimeout(60 * 1000);

const MODEL_PROVIDER = {
    model: 'mistral-small-latest',
    provider: 'mistral' as LLMConfigProvider
};

const testData: {
    input: LmaInput,
    expected_output: LmaOutput
}[] = [{
    "input": {
        "message": "Ho avuto nausea e un po' di vertigini, comunque vorrei parlare con un medico.",
        "chat_status": "request",
        "task": {
            "name": "side-effects",
            "type": "string",
            "description": "Side effects, or strange feelings, that the patient can feel."
        },
        "history": [
            {
                "sender": "user",
                "message": "Da stamattina ho mal di stomaco e non mi sento molto bene."
            },
            {
                "sender": "agent",
                "message": "Hai assunto qualche farmaco oggi?"
            },
            {
                "sender": "user",
                "message": "Sì, dhe bimbo, ho preso una compressa di paracetamolo."
            },
            {
                "sender": "agent",
                "message": "Hai avuto effetti collaterali?"
            }
        ],
        "summary": {
            "text": "Paziente riferisce mal di stomaco e malessere generale. Ha assunto una compressa di paracetamolo.",
            "span": 3
        }
    },
    "expected_output": {
        "user_request": "L'utente vuole parlare con un medico.",
        "request_satisfied": false,
        "sentiment": {
            "single": {
                "polarity": 0.0,
                "involvement": 0.3,
                "energy": 0.0,
                "temper": 0.6,
                "mood": 0.0,
                "empathy": 0.3,
                "tone": 0.3,
                "registry": 0.6
            },
            "cumulative": {
                "polarity": 0.0,
                "involvement": 0.3,
                "energy": 0.0,
                "temper": 0.6,
                "mood": 0.0,
                "empathy": 0.3,
                "tone": 0.3,
                "registry": 1
            }
        },
        "task": {
            "status": "answered",
            "answer": "nausea, vertigini"
        },
        "summary": {
            "text": "Paziente riferisce mal di stomaco e malessere generale. Ha assunto una compressa di paracetamolo. Riporta nausea e vertigini e chiede di parlare con un medico.",
            "span": 3
        }
    }
},
{
    "input": {
        "message": "Ok, ora ho misurato: 102 bpm a riposo (ero un po’ agitato). Sto meglio dopo il Ventolin. Per favore annulla l’appuntamento di domani e riprogrammalo per lunedì mattina, tra le 9 e le 11. E mandami il PDF della terapia aggiornato appena puoi.",
        "chat_status": "request",
        "task": {
            "name": "heart-rate",
            "type": "number",
            "description": "The heart rate of the patient, measured in beats per minute."
        },
        "history": [
            {
                "sender": "user",
                "message": "Ieri notte ho avuto tosse e un po’ di fiato corto."
            },
            {
                "sender": "agent",
                "message": "Hai una diagnosi di asma? Usi un inalatore?"
            },
            {
                "sender": "user",
                "message": "Sì, asma lieve. Ho il Ventolin."
            },
            {
                "sender": "agent",
                "message": "Lo hai usato oggi? Quante puff?"
            },
            {
                "sender": "user",
                "message": "Due puff stamattina alle 8."
            },
            {
                "sender": "agent",
                "message": "I sintomi sono migliorati? Dolore toracico?"
            },
            {
                "sender": "user",
                "message": "Un po’ meglio, ma ho ancora capogiro e ansia."
            },
            {
                "sender": "agent",
                "message": "Per favore misura la frequenza cardiaca a riposo per 60 secondi (task: heart-rate). Se puoi, anche la saturazione."
            },
            {
                "sender": "user",
                "message": "Non ho il saturimetro. Prendo l’Apple Watch, arrivo."
            },
            {
                "sender": "agent",
                "message": "Ok, quando ce l’hai dimmelo. Vuoi che prenoti una visita pneumologica per domani alle 18?"
            },
            {
                "sender": "user",
                "message": "Sì, per favore. E puoi mandarmi il piano terapeutico aggiornato in PDF?"
            },
            {
                "sender": "agent",
                "message": "Visita prenotata per domani h 18:00 al Centro Respiro XYZ. Invio il PDF appena mi confermi l’email."
            },
            {
                "sender": "user",
                "message": "La mail è leonardo@example.com"
            },
            {
                "sender": "agent",
                "message": "Ricevuta. Invio il PDF a breve. Intanto, per favore, misura i battiti a riposo."
            },
            {
                "sender": "user",
                "message": "Sto salendo le scale, te la dico appena mi fermo."
            },
            {
                "sender": "agent",
                "message": "Perfetto, aspetto. Hai avuto effetti collaterali dai farmaci?"
            },
            {
                "sender": "user",
                "message": "Stamattina ho preso 1000 mg di paracetamolo per il mal di testa, forse troppi."
            },
            {
                "sender": "agent",
                "message": "Nota: dose superiore alla compressa standard da 500 mg. Evita di ripetere. Riesci ora a misurare i battiti?"
            },
            {
                "sender": "user",
                "message": "Sto provando, ma l’orologio segna valori ballerini."
            },
            {
                "sender": "agent",
                "message": "Siediti 5 minuti, poi misura di nuovo. Quando hai il numero, scrivimelo. Vuoi che sposti l’appuntamento se non stai bene?"
            },
            {
                "sender": "user",
                "message": "Valuto tra poco. Puoi verificare se c’è disponibilità anche lunedì mattina?"
            }
        ],
        "summary": {
            "text": "Paziente con asma lieve, usa Ventolin (2 puff alle 8). Tosse e dispnea notturna, lieve capogiro/ansia. Prenotata visita pneumologica per domani h 18:00 (Centro Respiro XYZ). Richiesto PDF piano terapeutico via email (leonardo@example.com). In corso richiesta di misurazione frequenza cardiaca a riposo.",
            "span": 14
        }
    },
    "expected_output": {
        "user_request": "L'utente vuole annullare la visita di domani e riprogrammarla a lunedì mattina tra le 9 e le 11; inoltre, vuole inviare il PDF della terapia aggiornato.",
        "request_satisfied": false,
        "sentiment": {
            "single": {
                "polarity": 0.3,
                "involvement": 0.6,
                "energy": 0.3,
                "temper": 0.3,
                "mood": 0.3,
                "empathy": 0.3,
                "tone": 0.3,
                "registry": 0
            },
            "cumulative": {
                "polarity": 0,
                "involvement": 0.6,
                "energy": 0.3,
                "temper": 0.3,
                "mood": 0,
                "empathy": 0.3,
                "tone": 0.3,
                "registry": 0
            }
        },
        "task": {
            "status": "answered",
            "answer": 102,
            "notes": "Misurazione riferita a riposo ma con agitazione; dispositivo: Apple Watch; possibile sovrastima. Migliorato dopo Ventolin."
        },
        "summary": {
            "text": "Paziente con asma lieve, usa Ventolin (2 puff alle 8). Tosse e dispnea notturna, lieve capogiro/ansia. Prenotata visita pneumologica per domani h 18:00 (Centro Respiro XYZ). Richiesto PDF piano terapeutico via email (leonardo@example.com). In corso richiesta di misurazione frequenza cardiaca a riposo. Paziente ha assunto 1000 mg di paracetamolo per mal di testa, dose superiore alla compressa standard da 500 mg. Evitare di ripetere.",
            "span": 18
        }
    }
}];

const toolTestData: {
    input: LmaInput,
    expected_output: Partial<LmaOutput>
}[] = [{
    "input": {
        "message": "Quali sono gli effetti collaterali?",
        "chat_status": "open",
        "task": {
            "name": "aspirina-dose",
            "type": "boolean",
            "description": "Prendere una compressa di Aspirina 325 mg."
        },
        "history": [
            {
                "sender": "agent",
                "message": "Buongiorno! Dovresti prendere una compressa di Aspirina 325 mg, l'hai presa?"
            }
        ]
    },
    "expected_output": {
        "user_request": "L'utente chiede informazioni sugli effetti collaterali dell'Aspirina 325 mg.",
        "useful_tools": [
            {
                "name": "rag-from-docs"
            }
        ]
    }
},
{
    "input": {
        "message": "Qual'è il numero del mio fiseoterapista?",
        "chat_status": "open",
        "history": []
    },
    "expected_output": {
        "user_request": "L'utente chiede il numero di telefono del suo fisioterapista.",
        "useful_tools": [
            {
                "name": "doctors"
            }
        ]
    }
}];

const lma1 = new Lma({
    baseConfig: { ...MODEL_PROVIDER, parallel: true },
    userRequestConfig: {
        satisfactionDetection: MODEL_PROVIDER,
        requestDetection: { ...MODEL_PROVIDER, mode: 'simple' }
    },
    summarizationConfig: {
        ...MODEL_PROVIDER,
        C_MIN: 500,
        C_MAX: 1000,
        maximumSentences: 2
    }
});

test.concurrent('LMA - Sentiment Analysis', async () => {

    const generatedOutputs: LmaOutput[] = [];
    const expectedOutputs: LmaOutput[] = [];

    for (const { input, expected_output } of testData) {
        const single = await lma1.getSingleMessageSentiment(input);
        const cumulative = await lma1.getCumulativeSentiment(input);
        generatedOutputs.push({ sentiment: { single, cumulative } });
        expectedOutputs.push(expected_output);
    }


    const singleDistance = allEval.evaluateSentimentAnalysis({
        expectedScores: expectedOutputs.map(e => e.sentiment!.single),
        generatedScores: generatedOutputs.map(e => e.sentiment!.single)
    });

    const cumulativeDistance = allEval.evaluateSentimentAnalysis({
        expectedScores: expectedOutputs.map(e => e.sentiment!.cumulative),
        generatedScores: generatedOutputs.map(e => e.sentiment!.cumulative)
    });

    expect(singleDistance.raw).toBeLessThanOrEqual(0.2);
    expect(cumulativeDistance.raw).toBeGreaterThanOrEqual(0.2);
});

test.concurrent('LMA - User Request Detection', async () => {

    const generatedOutputs: LmaOutput[] = [];
    const expectedOutputs: LmaOutput[] = [];

    for (const { input, expected_output } of testData) {
        const output = await lma1.detectUserRequest(input);
        generatedOutputs.push(output as LmaOutput);
        expectedOutputs.push(expected_output);
    }

    const {
        userRequestPresenceAccuracy,
        requestSatisfiedAccuracy,
        averageUserRequestScore
    } = await allEval.evaluateUserRequestDetection({
        expectedOutputs,
        generatedOutputs,
    });

    expect(userRequestPresenceAccuracy).toBe(1);
    expect(requestSatisfiedAccuracy).toBe(1);
    expect(averageUserRequestScore).toBeGreaterThanOrEqual(0.8);
});

test.concurrent('LMA - Task Analysis', async () => {

    const generatedOutputs: LmaOutput[] = [];
    const expectedOutputs: LmaOutput[] = [];

    for (const { input, expected_output } of testData) {
        const output = await lma1.analyzeTask(input);
        generatedOutputs.push({ task: output as any } as any);
        expectedOutputs.push(expected_output);
    }

    const {
        taskAnswerAccuracy,
        taskStatusAccuracy,
        taskNotesAverageScore
    } = await allEval.evalauteTaskAnalysis({
        expectedOutputs,
        generatedOutputs,
    });

    expect(taskAnswerAccuracy).toBe(1);
    expect(taskStatusAccuracy).toBe(1);
    // expect(taskNotesAverageScore).toBeGreaterThanOrEqual(0.8); for now we ignore it!
});

test.concurrent('LMA - Summarization', async () => {

    const generatedOutputs: LmaOutput[] = [];

    for (const { input } of testData) {
        const output = await lma1.summarizeChatHistory(input);
        generatedOutputs.push({ summary: output as any } as any);
    }

    for (const generatedOutput of generatedOutputs) {
        const generatedSentences = splitTextIntoSentences(generatedOutput.summary!.text);
        expect(generatedSentences.length).toBeLessThanOrEqual(2);
    }
})

const lma2 = new Lma({
    baseConfig: { ...MODEL_PROVIDER, parallel: true },
    userRequestConfig: {
        satisfactionDetection: { ...MODEL_PROVIDER },
        requestDetection: { ...MODEL_PROVIDER, mode: 'tools-params', tools: example_lma_tools }
    }
});

test.concurrent('LMA - Tools Detection', async () => {

    const generatedOutputs: LmaOutput[] = [];
    const expectedOutputs: LmaOutput[] = [];

    for (const { input, expected_output } of toolTestData) {
        const output = await lma2.detectUserRequest(input);
        generatedOutputs.push(output as LmaOutput);
        expectedOutputs.push(expected_output as LmaOutput);
    }

    const {
        toolNameIoU,
        toolParamAccuracy
    } = allEval.evaluateToolsDetection({
        expectedOutputs,
        generatedOutputs,
    });

    expect(toolNameIoU).toBe(1);
    expect(toolParamAccuracy).toBe(1);
});