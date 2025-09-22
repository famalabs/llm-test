import { createClient } from "redis";
import yargs from "yargs";
import { readFile } from "fs/promises";
import { writeFile } from "fs/promises";
import { mean, stddev, percentile, randomUnitVector } from "../../utils";
import { hideBin } from "yargs/helpers";

const EMBEDDING_DIMENSION = 1024;
const NUM_QUERIES = 100;

async function runBenchmark(client: any, indexName: string, query: string, label: string) {
  const latencies: number[] = [];

  for (let i = 0; i < NUM_QUERIES; i++) {
    const vector = randomUnitVector(EMBEDDING_DIMENSION, true);
    const t0 = performance.now();
    await client.ft.search(indexName, query, {
      PARAMS: { BLOB: vector },
      SORTBY: "vector_score",
      DIALECT: 2,
      RETURN: ["vector_score"],
    });
    const t1 = performance.now();
    latencies.push(t1 - t0);
  }

  const totalTime = latencies.reduce((a, b) => a + b, 0);
  return {
    label,
    mean: mean(latencies),
    stddev: stddev(latencies),
    p95: percentile(latencies, 95),
    p99: percentile(latencies, 99),
    qps: NUM_QUERIES / (totalTime / 1000),
  };
}

const main = async () => {
  const argv = await yargs(hideBin(process.argv))
    .option('scale', { alias: 's', choices: ['xs', 's', 'm', 'l'], demandOption: true, type: 'string', description: 'Dataset scale: xs|s|m|l' })
    .option('algorithm', { alias: 'a', choices: ['FLAT', 'HNSW'], demandOption: true, type: 'string', description: 'Redis vector index algorithm' })
    .option('k', { type: 'number', demandOption: true, description: 'K for KNN' })
    .help()
    .parse();

  const { scale, algorithm, k } = argv;

  if (!k || isNaN(Number(k)) || Number(k) <= 0) {
    throw new Error("k must be a positive number");
  }

  const K = Number(k);
  const ALGORITHM = algorithm!.toUpperCase();

  const scaleName: Record<string, string> = {
    xs: "extra-small",
    s: "small",
    m: "medium",
    l: "large",
  };

  const indexName = `patients_${scaleName[scale!]}`.replace(/-/g, "_");
  const filePath = `output/vector-store/fake-data/fake-patients-data-${scaleName[scale!]}.json`;
  const raw = await readFile(filePath, "utf-8");
  const fakeData: any[] = JSON.parse(raw);

  // selezione valori più frequenti
  const countBy = (key: string) => fakeData.reduce((acc, d) => {
      const val = d.metadata[key];
      acc[val] = (acc[val] ?? 0) + 1;
      return acc;
    }, 
    {} as Record<string, number>
);
  const pickMostFrequent = (obj: Record<string, number>) => Object.entries(obj).sort((a, b) => b[1] - a[1])[0][0];

  const sampleDocType = pickMostFrequent(countBy("doc_type"));
  const sampleSource = pickMostFrequent(countBy("source"));
  const sampleVersion = pickMostFrequent(countBy("version"));

  console.log(`Using filters: doc_type=${sampleDocType}, source=${sampleSource}, version=${sampleVersion}`);

  const client = createClient({ url: process.env.REDIS_URL });
  await client.connect();

  try {
    console.log(`\nChecking index "${indexName}" status...`);
    const info = await client.ft.info(indexName);
    const numDocs = Number((info as { num_docs: any }).num_docs);
    if (numDocs === 0) {
      throw new Error(`Index "${indexName}" is empty.`);
    }
    console.log(`Index contains ${numDocs} documents. Starting benchmark...`);
  }

  catch (e: any) {
    if (e.message.includes("Unknown Index name")) {
      console.error(`Error: Index "${indexName}" does not exist.`);
    } else {
      console.error("An error occurred while checking the index:", e.message);
    }
    await client.quit();
    process.exit(1);
  }


  const results = [];
  results.push(
    await runBenchmark(
      client, 
      indexName, 
      `*=>[KNN ${K} @embedding $BLOB AS vector_score]`, "No filter"));
  console.log("Running benchmark with no filter...");
      results.push(
    await runBenchmark(
      client, 
      indexName, 
      `(@doc_type:{${sampleDocType}})=>[KNN ${K} @embedding $BLOB AS vector_score]`, "doc_type"));
  results.push(
    await runBenchmark(
      client, 
      indexName, 
      `(@doc_type:{${sampleDocType}} @source:{${sampleSource}})=>[KNN ${K} @embedding $BLOB AS vector_score]`, "doc_type + source"));
  results.push(
    await runBenchmark(
      client, 
      indexName, 
      `(@doc_type:{${sampleDocType}} @source:{${sampleSource}} @version:[${sampleVersion} ${sampleVersion}])=>[KNN ${K} @embedding $BLOB AS vector_score]`, "doc_type + source + version"));

  await client.quit();

  let jsonResult: Record<string, any> = {};
  let output = "=".repeat(50) + "\nREDIS BENCHMARK RESULT\n" + "=".repeat(50) + "\n";
  output += "-------------------------------------------------------------------------------\n";
  output += "| Filter                         | Mean (ms) | StdDev | p95   | p99   | QPS    |\n";
  output += "-------------------------------------------------------------------------------\n";
  results.forEach((r) => {
    output += `| ${r.label.padEnd(30)} | ${r.mean.toFixed(2).padStart(8)} | ${r.stddev.toFixed(2).padStart(6)} | ${r.p95.toFixed(2).padStart(5)} | ${r.p99.toFixed(2).padStart(5)} | ${r.qps.toFixed(1).padStart(7)} |\n`;
    jsonResult[
      r.label
    ] = {
      mean_ms: r.mean,
      stddev_ms: r.stddev,
      p95_ms: r.p95,
      p99_ms: r.p99,
      qps: r.qps,
    }
  });
  output += "-------------------------------------------------------------------------------\n";

  console.log(output);
  const txtFile = `output/vector-store/benchmark-${K}-${scaleName[scale!]}-${ALGORITHM.toLocaleLowerCase()}.txt`;
  const jsonFile = `output/vector-store/benchmark-${K}-${scaleName[scale!]}-${ALGORITHM.toLocaleLowerCase()}.json`;

  await writeFile(txtFile, output);
  await writeFile(jsonFile, JSON.stringify(jsonResult, null, 2));
  console.log(`Benchmark results saved to ${txtFile}`);
  console.log(`Benchmark results saved to ${jsonFile}`);
};

main().catch(console.error).then(() => process.exit(0));
