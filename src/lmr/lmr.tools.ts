import { tool } from 'ai';
import { z } from 'zod';
import { Rag } from '../rag';
import { detectLanguage } from '../lib/nlp';
import { ensureIndex, VectorStore } from '../vector-store';
import { Chunk } from '../lib/chunks';
import Redis from 'ioredis';

const docStoreRedisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const docStoreIndexName = 'vs_section_gpt4_300';
const docStoreIndexSchema = ['pageContent', 'TEXT', 'source', 'TAG', 'id', 'TAG', "childId", "TAG"];
const docStore = new VectorStore<Chunk>({
    client: docStoreRedisClient,
    indexName: docStoreIndexName,
    fieldToEmbed: 'pageContent'
});

const rag = new Rag({
    llmConfig: {
        provider: 'mistral',
        model: 'mistral-small-latest',
    },
    numResults: 5,
    reasoningEnabled: true,
    includeCitations: true,
    fewShotsEnabled: false,
    verbose: false,
    docStore,
    parentPageRetrieval: {
        type: 'full-section'
    }
});

let inited = false;
const initRag = async () => {
    if (inited) return
    await ensureIndex(docStoreRedisClient, docStoreIndexName, docStoreIndexSchema);
    await rag.init();
    inited = true;
}

export const ragFromDocs = tool({
    description: "Retrieve information from internal documents about pharmaceutical products.",
    inputSchema: z.object({
        query: z.string().describe("User question to answer from the docs")
    }),

    async execute({ query }) {
        await initRag();
        const lang = await detectLanguage(query, true);
        const { answer, citations } = await rag.search(query, true, lang);
        return { answer, citations };
    },
});

export const therapy = tool({
    description: "Retrieve the user's current therapy plan and dosages.",
    inputSchema: z.object({
        date: z.string().nullish().describe("Optional date (YYYY-MM-DD) to view historical therapy"),
    }),
    async execute({ date }) {
        return {
            date: date ?? new Date().toISOString(),
            medications: [
                { name: "Amoxicillin", dose: "500 mg", schedule: "1-0-1", notes: "After meals" },
                { name: "Ibuprofen", dose: "200 mg", schedule: "0-1-0", notes: "If pain > 5/10" },
            ],
        };
    },
});

export const logs = tool({
    description: "Retrieve user's logs including vitals, medications, and symptoms for a given date.",
    inputSchema: z.object({
        date: z.string().describe("Date in YYYY-MM-DD format"),
    }),
    async execute({ date }) {
        return {
            date,
            vitals: { hr: 72, bp: "120/78", tempC: 36.7 },
            takenMedications: ["Amoxicillin 500 mg", "Vitamin D 1000 IU"],
            symptoms: [{ name: "Headache", severity: 3, note: "Mild, morning only" }],
        };
    },
});

export const chats = tool({
    description: "Retrieve messages from previous chat conversations with the user.",
    inputSchema: z.object({
        date: z.string().describe("Date in YYYY-MM-DD format"),
    }),
    async execute({ date }) {
        return {
            date,
            messages: [
                { role: "user", content: "I had mild stomach pain today." },
                { role: "assistant", content: "Did you change any medication or diet?" },
            ],
        };
    },
});

export const userProfile = tool({
    description: "Retrieve the user profile information.",
    inputSchema: z.object({}), // no params
    async execute() {
        return {
            id: "user_123",
            name: "Gianni Verdi",
            age: 42,
            allergies: ["Penicillin"],
            conditions: ["Hypertension"],
        };
    },
});

export const doctors = tool({
    description: "Retrieve information about the user's doctors.",
    inputSchema: z.object({}),
    async execute() {
        return {
            primaryCare: { name: "Dr. Rossi", phone: "+39 055 123456", email: "rossi@example.com" },
            specialists: [
                { name: "Dr.ssa Bianchi (Cardiology)", phone: "+39 02 987654", email: "bianchi@example.com" },
            ],
        };
    },
});

export const lmrToolbox = {
    "rag-from-docs": ragFromDocs,
    therapy,
    logs,
    chats,
    user_profile: userProfile,
    doctors,
};

export const disconnectRedis = async () => {
    await docStoreRedisClient.quit();
};