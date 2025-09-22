import { readFile, writeFile } from "fs/promises";
import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";


const main = async () => {
    const argv = await yargs(hideBin(process.argv))
        .option('algorithm', { alias: 'a', choices: ['FLAT', 'HNSW'], type: 'string', demandOption: true, description: 'Algorithm used for benchmarks' })
        .option('k', { type: 'number', demandOption: true, description: 'K used in benchmarks' })
        .strict()   
        .help()
        .parse();
    
    const { algorithm, k } = argv;

    if (!k || isNaN(Number(k)) || Number(k) <= 0) {
        throw new Error("k must be a positive number");
    }

    const K = Number(k);

    const ALGORITHM = algorithm!.toUpperCase();

    const scales = ["extra-small", "small", "medium", "large"];
    const categories = ["No filter", "doc_type", "doc_type + source", "doc_type + source + version"];
    const all: Record<string, Record<string, { mean_ms: number; p95_ms: number; p99_ms: number; qps: number }>> = {};

    for (const scale of scales) {
        const jsonResult = await readFile(`output/vector-store/benchmark-${K}-${scale}-${ALGORITHM.toLocaleLowerCase()}.json`, "utf-8")
            .then(r => JSON.parse(r));
        all[scale] = jsonResult;
    }

    const width = 1000;
    const height = 600;
    const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height, backgroundColour: 'white' });

    const meanDatasets = scales.map((scale, i) => ({
        label: `${scale}`,
        data: categories.map(c => all[scale][c].mean_ms),
        backgroundColor: `hsl(${i * 90}, 70%, 50%)`,
    }));

    const configuration = {
        type: "bar" as const,
        data: {
            labels: categories,
            datasets: meanDatasets,
        },
        options: {
            responsive: false,
            plugins: {
                title: {
                    display: true,
                    text: "Vector Store Benchmark Summary (Mean Latency)",
                },
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: "Latency (ms)" },
                },
            },
        },
    };

    const buffer = await chartJSNodeCanvas.renderToBuffer(configuration);
    const outputFile = `output/vector-store/benchmark-summary-${K}-${ALGORITHM.toLocaleLowerCase()}.png`;
    await writeFile(outputFile, buffer);
    console.log(`Benchmark summary chart saved to ${outputFile}`);
};

main().catch(console.error).then(() => process.exit(0));
