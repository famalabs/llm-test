import { readFile, writeFile } from "fs/promises";
import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import { parseCliArgs } from "../../lib/cli";

const main = async () => {

    const { k } = parseCliArgs(["k"]);
    if (!k || isNaN(Number(k)) || Number(k) <= 0) {
        throw new Error("k must be a positive number");
    }

    const K = Number(k);

    const scales = ["extra-small", "small", "medium", "large"];
    const categories = ["No filter", "doc_type", "doc_type + source", "doc_type + source + version"];

    for (const scale of scales) {
        const flatResults = await readFile(
            `output/vector-store/benchmark-${scale}-flat.json`,
            "utf-8"
        ).then(r => JSON.parse(r));

        const hnswResults = await readFile(
            `output/vector-store/benchmark-${scale}-hnsw.json`,
            "utf-8"
        ).then(r => JSON.parse(r));

        const meanFlat = categories.map(c => flatResults[c].mean_ms);
        const meanHnsw = categories.map(c => hnswResults[c].mean_ms);

        const width = 1000;
        const height = 600;
        const chartJSNodeCanvas = new ChartJSNodeCanvas({
            width,
            height,
            backgroundColour: "white",
        });

        const configuration = {
            type: "bar" as const,
            data: {
                labels: categories,
                datasets: [
                    {
                        label: "FLAT",
                        data: meanFlat,
                        backgroundColor: "hsl(0, 70%, 50%)", // rosso
                    },
                    {
                        label: "HNSW",
                        data: meanHnsw,
                        backgroundColor: "hsl(200, 70%, 50%)", // blu
                    },
                ],
            },
            options: {
                responsive: false,
                plugins: {
                    title: {
                        display: true,
                        text: `Algorithm Comparison (Mean Latency) — ${scale}`,
                    },
                    legend: {
                        position: "top" as const,
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
        const outFile = `output/vector-store/algorithm-comparison-${K}-${scale}.png`;
        await writeFile(outFile, buffer);
        console.log(`Chart saved to ${outFile}`);
    }
};

main().catch(console.error).then(() => process.exit(0));