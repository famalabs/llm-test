import { evaluate } from "./evaluation";
import { LmrInput } from "./interfaces";
import { Lmr } from "./lmr";
import 'dotenv/config';

jest.setTimeout(60 * 1000);

const lmr = new Lmr({ baseConfig: { model: "gpt-5-mini", provider: "openai" } });

const tests = [

    // -------------------------
    // --- Test con richiesta tools ---
    // -------------------------

    {
        "focus_on": "user_request:rags",
        "input": {
            "chat_status": "request",
            "user_request": "Quali sono le controindicazioni di OKI?",
            "style": "empathetic-clinical, concise",
            "history": [
                { "sender": "user", "message": "Ho mal di testa, pensavo a OKI." }
            ],
            "summary": { "text": "Utente valuta assunzione di OKI.", "span": 1 }
        },
        "expected_output": {
            "key_ref": "OKI è controindicato in caso di ulcere o sanguinamenti gastrointestinali, gravi problemi cardiaci/epatici/renali, disturbi della coagulazione, allergie ai FANS, nel terzo trimestre di gravidanza e nei bambini < 6 anni.",
            "full_ref": "OKI 30 mg supposte è controindicato in varie condizioni: ipersensibilità a ketoprofene o eccipienti; reazioni allergiche a ketoprofene/ASA/altro FANS (asma, broncospasmo, orticaria, anafilassi); severa insufficienza cardiaca; ulcera peptica attiva o storia di ulcere ricorrenti; precedente sanguinamento o perforazione GI da FANS; diatesi emorragica; grave insufficienza epatica o renale; leucopenia/piastrinopenia; gravi disturbi della coagulazione; colite ulcerosa, gastrite, dispepsia cronica; storia di emorragia GI; terzo trimestre di gravidanza; proctite/proctorragia; bambini < 6 anni."
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
        "focus_on": "task:ignored",
        "input": {
            "task_due": {
                "name": "schedule-checkup",
                "description": "Prenotare un controllo con il MMG entro 7 giorni per rivalutazione pressione.",
                "ignored": true
            },
            "chat_status": "request",
            "style": "empathetic-clinical, concise",
            "history": [
                { "sender": "agent", "message": "La scorsa settimana avevamo proposto un controllo pressorio con il medico di base." },
                { "sender": "user", "message": "Non sono riuscito a prenotare." }
            ],
            "summary": { "text": "Task precedentemente ignorato: prenotazione controllo pressorio.", "span": 2 }
        },
        "expected_output": {
            "key_ref": "Promemoria gentile: riprendere prenotazione controllo entro 7 giorni; offrire aiuto nel fissare data/ora.",
            "full_ref": "Riprendiamo il controllo pressorio: ti va se lo prenotiamo entro i prossimi 7 giorni? Posso proporti alcune fasce orarie oppure, se preferisci, posso inviare una richiesta al tuo MMG. Indicami giorni/ore comode. Se hai avuto valori >140/90 con sintomi (cefalea intensa, dolore toracico, dispnea, deficit neurologici), valuta controllo urgente."
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
            "full_ref": "Sto aspettando l’esito della configurazione del promemoria per l’assunzione dell’antibiotico alle 12:00 per 7 giorni. Puoi darmi un breve aggiornamento sull’esito o indicarmi un tempo stimato per procedere?",
            "key_ref": "Richiesta aggiornamento stato configurazione promemoria antibiotico; chiedere esito o tempo stimato."
        }
    }
];

for (const t of tests) {
    /**
    * @jest-environment jest-environment-node-single-context
    */
    test.concurrent(`LMR Test - focus_on: ${t.focus_on}`, async () => {
        const input = t.input as LmrInput;
        const expected = t.expected_output;
        const prediction = await lmr.mainCall(input);
        const score = await evaluate({
            lmrInputs: [input],
            expectedOutputs: [expected],
            generatedOutputs: [prediction],
            model: "mistral-small-latest",
            provider: "mistral"
        });
        expect(score.mean).toBeGreaterThanOrEqual(0.7);
    });
}