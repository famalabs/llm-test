import { readFile } from 'fs/promises';
import yargs from 'yargs';
import { createClient, RedisClientType, SCHEMA_FIELD_TYPE, SCHEMA_VECTOR_FIELD_ALGORITHM } from "redis";
import "dotenv/config";
import { randomUnitVector } from '../../utils';
import { hideBin } from 'yargs/helpers';

const EMBEDDING_DIMENSION = 1024;
let ALGORITHM: 'FLAT' | 'HNSW' | null = null;

// Serve per convertire un array di numeri in un Buffer Float32, necessario per Redis
function float32Buffer(arr: number[]) {
  return Buffer.from(new Float32Array(arr).buffer);
}


async function createIndex(client: RedisClientType, indexName: string) {
  console.log(`Creating index "${indexName}"...`);
  try {
    await client.ft.dropIndex(indexName);
    console.log(`Dropped previous index "${indexName}"`);
  }

  catch (e: any) {
    if (!e.message.includes("Unknown Index name")) {
      throw e;
    }
  }

  await client.ft.create(
    indexName,
    {
      content: { type: SCHEMA_FIELD_TYPE.TEXT },
      embedding: {
        type: SCHEMA_FIELD_TYPE.VECTOR,
        ALGORITHM: ALGORITHM === 'FLAT' ? SCHEMA_VECTOR_FIELD_ALGORITHM.FLAT : SCHEMA_VECTOR_FIELD_ALGORITHM.HNSW,
        TYPE: 'FLOAT32',
        DIM: EMBEDDING_DIMENSION,
        DISTANCE_METRIC: 'COSINE',
      },
      source: { type: SCHEMA_FIELD_TYPE.TAG },
      doc_type: { type: SCHEMA_FIELD_TYPE.TAG },
      version: { type: SCHEMA_FIELD_TYPE.NUMERIC },
    },
    {
      ON: 'HASH',
      PREFIX: `${indexName}:`,
    }
  );
  console.log(`Index "${indexName}" created.`);
}

const main = async () => {
  const argv = await yargs(hideBin(process.argv))
    .option('scale', { alias: 's', choices: ['xs', 's', 'm', 'l'], demandOption: true, type: 'string', description: 'Dataset scale: xs|s|m|l' })
    .option('algorithm', { alias: 'a', choices: ['FLAT', 'HNSW'], demandOption: true, type: 'string', description: 'Redis vector index algorithm' })
    .help()
    .parse();

  const { scale, algorithm } = argv;

  ALGORITHM = algorithm!.toUpperCase() as 'FLAT' | 'HNSW';

  const scaleName: Record<string, string> = {
    xs: 'extra-small', s: 'small', m: 'medium', l: 'large'
  };

  const filePath = `output/vector-store/fake-data/fake-patients-data-${scaleName[scale!]}.json`;
  console.log(`Loading fake data from ${filePath}...`);
  const raw = await readFile(filePath, 'utf-8');
  const fakeData: { metadata: Record<string, any>; chunk: string }[] = JSON.parse(raw);
  console.log(`Loaded ${fakeData.length} documents.`);

  const indexName = `patients_${scaleName[scale!]}`.replace(/-/g, '_');
  if (!process.env.REDIS_URL) throw new Error("Missing REDIS_URL in environment variables.");

  const client: RedisClientType = createClient({ url: process.env.REDIS_URL });
  await client.connect();

  await createIndex(client, indexName);

  console.log(`Inserting ${fakeData.length} documents into Redis...`);
  const t0 = performance.now();

  const multi = client.multi();

  for (let i = 0; i < fakeData.length; i++) {
    const doc = fakeData[i];
    const key = `${indexName}:${doc.metadata.patient_id}`;
    const vector = randomUnitVector(EMBEDDING_DIMENSION, false) as number[];

    const redisObject = {
      content: doc.chunk,
      embedding: float32Buffer(vector),
      patient_id: doc.metadata.patient_id,
      doc_type: doc.metadata.doc_type,
      date: new Date(doc.metadata.date).getTime().toString(),
      version: doc.metadata.version.toString(),
      source: doc.metadata.source,
    };

    multi.hSet(key, redisObject);
  }

  const replies = await multi.exec();
  const errors = replies.filter((reply) => reply instanceof Error);

  if (errors.length > 0) {
    console.error(`Encountered ${errors.length} errors during Redis pipeline execution.`);
    console.error('First error:', errors[0]);
  }

  else {
    const successfulInserts = replies.length;
    const t1 = performance.now();
    console.log(`Finished. Inserted ${successfulInserts} docs in ${(t1 - t0).toFixed(2)} ms`);
  }

  await client.quit();
};

main().catch(console.error).then(() => process.exit(0));