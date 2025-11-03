import { SentimentScores } from "../interfaces";

export const evaluateSentimentAnalysis = ({
    generatedScores,
    expectedScores,
    threshold = 0,
}: {
    generatedScores: SentimentScores[];
    expectedScores: SentimentScores[];
    threshold?: number; // default 0
}) => {
    if (generatedScores.length != expectedScores.length) {
        throw new Error("Generated scores and expected scores arrays must have the same length.");
    }

    const mae = (a: number, b: number) => Math.abs(a - b);
    const bin = (x: number) => (x > threshold ? 1 : 0);

    const allRawMeans: number[] = [];
    const allBinMeans: number[] = [];

    for (let i = 0; i < expectedScores.length; i++) {
        const g = generatedScores[i];
        const e = expectedScores[i];

        const dims = Object.keys(e) as (keyof SentimentScores)[];

        const rawMaePerDim = dims.map((d) => mae(g[d], e[d]));
        const rawMeanMae = rawMaePerDim.reduce((a, b) => a + b, 0) / rawMaePerDim.length;
        allRawMeans.push(rawMeanMae);

        const binMaePerDim = dims.map((d) => mae(bin(g[d]), bin(e[d])));
        const binMeanMae = binMaePerDim.reduce((a, b) => a + b, 0) / binMaePerDim.length;
        allBinMeans.push(binMeanMae);
    }

    const meanOfMeans = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

    return {
        means: {
            raw: meanOfMeans(allRawMeans),
            binarized: meanOfMeans(allBinMeans),
        },
        allRawMeans,
        allBinMeans,
    };
};
