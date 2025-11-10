import { LLMConfigProvider } from "../llm";
import { evaluate } from "./evaluation";
import { LmrInput } from "./interfaces";
import { Lmr } from "./lmr";
import 'dotenv/config';
import { disconnectRedis } from "./lmr.tools";

global.AI_SDK_LOG_WARNINGS = false;

/**
 * Jest has a bug with onnx runtime, follows the fix.
 * https://github.com/microsoft/onnxruntime/issues/16622
 */

const originalImplementation = Array.isArray;
// @ts-ignore
Array.isArray = jest.fn((value) => {
    try {
        if (
            value &&
            value.constructor &&
            (value.constructor.name === "Float32Array" || value.constructor.name === "BigInt64Array")
        ) {
            return true;
        }
    } catch (_) { ; }
    return originalImplementation(value);
});

jest.setTimeout(60 * 1000);

const MODEL_PROVIDER = {
    model: 'gpt-4.1-mini', // gpt-5-nano often asks for confermation on rag calls.
    provider: 'openai' as LLMConfigProvider
}

const lmr = new Lmr({ baseConfig: { ...MODEL_PROVIDER } });

const tests = [

    // -------------------------
    // --- Test con richiesta tools ---
    // -------------------------

    {
        "focus_on": "user_request:rags",
        "input": {
            "chat_status": "request",
            "user_request": "L'utente vuole sapere quante supposte al giorno di OKI deve prendere un bambino di 20 Kg.",
            "user_message": "Quante supposte al giorno di OKI deve prendere un bambino di 20 Kg? Sto parlando di OKi 30 mg supposte.",
            "style": "empathetic-clinical, concise",
            "history": [
                { "sender": "user", "message": "Ho mal di testa, pensavo a OKI." }
            ],
            "summary": { "text": "Utente valuta assunzione di OKI.", "span": 1 }
        },
        "expected_output": {
            "key_ref": "Per un bambino di 20 Kg, la dose raccomandata di OKI è 1 supposta 2-3 volte al giorno.",
            "full_ref": "",
        }
    },
    {
        "focus_on": "user_request:therapy",
        "input": {
            "chat_status": "request",
            "user_request": "Qual è la mia terapia attuale (farmaci e dosaggi)?",
            "style": "empathetic-clinical, concise",
            "history": [
                { "sender": "user", "message": "Mi puoi ricordare la terapia che sto seguendo?" }
            ],
            "summary": { "text": "Richiesta promemoria terapia.", "span": 1 }
        },
        "expected_output": {
            "key_ref": "Amoxicillin 500 mg schema 1-0-1 dopo i pasti; Ibuprofen 200 mg 0-1-0 se dolore > 5/10.",
            "full_ref": "Terapia attuale: Amoxicillin 500 mg con schema 1-0-1 (dopo i pasti, nota: after meals). Ibuprofen 200 mg con schema 0-1-0, da assumere solo se il dolore è > 5/10."
        }
    },
    {
        "focus_on": "user_request:logs",
        "input": {
            "chat_status": "request",
            "user_request": "Mostrami i miei log del 2025-10-29 (vitali, farmaci, sintomi).",
            "style": "empathetic-clinical, concise",
            "history": [
                { "sender": "user", "message": "Vorrei rivedere le misurazioni di ieri." }
            ],
            "summary": { "text": "Utente chiede log giornalieri.", "span": 1 }
        },
        "expected_output": {
            "key_ref": "2025-10-29: FC 72 bpm, PA 120/78, T 36.7 °C; assunti Amoxicillin 500 mg e Vitamin D 1000 IU; sintomo: mal di testa lieve (3/10).",
            "full_ref": "Log del 2025-10-29: vitali a riposo HR 72 bpm, pressione 120/78 mmHg, temperatura 36.7 °C. Farmaci assunti: Amoxicillin 500 mg, Vitamin D 1000 IU. Sintomi riportati: mal di testa lieve (3/10), al mattino, autolimitato."
        }
    },
    {
        "focus_on": "user_request:chats",
        "input": {
            "chat_status": "request",
            "user_request": "Mostrami gli ultimi messaggi della chat del 2025-10-29.",
            "style": "empathetic-clinical, concise",
            "history": [
                { "sender": "user", "message": "Voglio rivedere cosa ci siamo detti ieri." }
            ],
            "summary": { "text": "Richiesta cronologia chat.", "span": 1 }
        },
        "expected_output": {
            "key_ref": "Utente: lieve dolore di stomaco. Assistente: domanda su cambi farmaci/dieta.",
            "full_ref": "Messaggi del 2025-10-29: 1) user: 'I had mild stomach pain today.' 2) assistant: 'Did you change any medication or diet?'"
        }
    },
    {
        "focus_on": "user_request:doctors",
        "input": {
            "chat_status": "request",
            "user_request": "Dammi i contatti dei miei medici (medico di base e specialisti).",
            "style": "empathetic-clinical, concise",
            "history": [
                { "sender": "user", "message": "Devo chiamare il medico, hai i recapiti?" }
            ],
            "summary": { "text": "Richiesta contatti medici.", "span": 1 }
        },
        "expected_output": {
            "key_ref": "Medico di base: Dr. Rossi (+39 055 123456, rossi@example.com). Specialista: Dr.ssa Bianchi (Cardiology), +39 02 987654, bianchi@example.com.",
            "full_ref": "Contatti medici: Primary care: Dr. Rossi, telefono +39 055 123456, email rossi@example.com. Specialisti: Dr.ssa Bianchi (Cardiology), telefono +39 02 987654, email bianchi@example.com."
        }
    },

    // -------------------------
    //   --- Test task_due ---
    // -------------------------

    {
        "focus_on": "task:first_time",
        "input": {
            "task_due": {
                "name": "fasting-glucose",
                "description": "Misurare la glicemia a digiuno domattina seguendo la checklist allegata (mano calda, puntura laterale, segnare valore)."
            },
            "chat_status": "request",
            "style": "empathetic-clinical, concise",
            "history": [
                { "sender": "user", "message": "Sono preoccupato per la glicemia, cosa faccio domani?" }
            ],
            "summary": { "text": "Richiesta prima indicazione misura glicemia.", "span": 1 }
        },
        "expected_output": {
            "key_ref": "Proposta operativa: misurare glicemia a digiuno domani mattina; conferma disponibilità e invio checklist; chiedere di riferire il valore.",
            "full_ref": "Va bene: domattina misura la glicemia a digiuno. Ti invio una breve checklist (mano calda, seduto 5′, puntura laterale del polpastrello, prima goccia scartata, annota il valore in mg/dL). Confermi che riesci a farla? Quando hai il numero, scrivimelo qui. Se compare sintomatologia ipoglicemica (sudorazione, tremori, confusione), assumi 15 g di zuccheri semplici e avvisami."
        }
    },
    {
        "focus_on": "task:waited",
        "input": {
            "task_due": {
                "name": "set-reminder-antibiotic",
                "description": "Impostare promemoria per assunzione antibiotico alle 12:00 per 7 giorni.",
                "waited": true
            },
            "chat_status": "request",
            "style": "empathetic-clinical, concise",
            "history": [
                { "sender": "agent", "message": "Ti avevo proposto un promemoria per l’antibiotico a mezzogiorno." },
                { "sender": "user", "message": "Sì, mi ero distratto." }
            ],
            "summary": { "text": "Task in attesa: promemoria antibiotico.", "span": 2 }
        },
        "expected_output": {
            "full_ref": "Sto ancora aspettando l’esito della configurazione del promemoria. Puoi darmi un breve aggiornamento sull’esito o indicarmi un tempo stimato per procedere?",
            "key_ref": "Richiesta aggiornamento stato configurazione promemoria antibiotico; chiedere esito o tempo stimato."
        }
    }
];

for (const t of tests) {
    test.concurrent(`LMR Test - focus_on: ${t.focus_on}`, async () => {
        const input = t.input as LmrInput;
        const expected_output = t.expected_output;
        const candidate = await lmr.mainCall(input);
        const score = await evaluate({
            results: [{ expected_output, candidate, input }],
            model: 'mistral-small-latest',
            provider: 'mistral' as LLMConfigProvider,
        });

        const agentMessageScore = score.tests[0].metrics.agentMessageScore;

        if (agentMessageScore < 0.7) {
            console.log('Expected Output:', expected_output);
            console.log('Candidate Output:', candidate);
        }

        expect(agentMessageScore).toBeGreaterThanOrEqual(0.7);
    });
}

afterAll(async () => {
    await disconnectRedis();
})