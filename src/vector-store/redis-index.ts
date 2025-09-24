import Redis from "ioredis";
import { EMBEDDING_DIMENSION } from "../lib/embeddings";
import { EMBEDDING_FIELD } from "./vector-store";

export const ensureIndex = async (client: Redis, indexName: string, indexSchema: string[]) => {
    try {
        await client.call('FT.INFO', indexName);
        return; // exists
    } catch (e: any) {
        if (!e?.message?.includes('Unknown Index name')) throw e;
    }
    console.log(`Creating index ${indexName} ...`);
    const args: (string | number)[] = [
        'FT.CREATE', indexName,
        'ON', 'HASH',
        'PREFIX', '1', `${indexName}:`,
        'SCHEMA',
    ...indexSchema,
    EMBEDDING_FIELD, 'VECTOR', 'FLAT', '6',
        'TYPE', 'FLOAT32',
        'DIM', EMBEDDING_DIMENSION.toString(),
        'DISTANCE_METRIC', 'COSINE'
    ];
    await (client as any).call(...args);
    console.log(`Index ${indexName} created.`);
}