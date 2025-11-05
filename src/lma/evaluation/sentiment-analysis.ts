import { SentimentScores } from "../interfaces";

export const evaluateSentimentAnalysis = ({
    generatedScore,
    expectedScore,
    threshold = 0,
}: {
    generatedScore: SentimentScores;
    expectedScore: SentimentScores;
    threshold?: number; // default 0
}) => {

    const mae = (a: number, b: number) => Math.abs(a - b);
    const bin = (x: number) => (x > threshold ? 1 : 0);

    const g = generatedScore;
    const e = expectedScore;

    const dims = Object.keys(e) as (keyof SentimentScores)[];

    const rawMaePerDim = dims.map((d) => mae(g[d], e[d]));
    const rawMeanMae = rawMaePerDim.reduce((a, b) => a + b, 0) / rawMaePerDim.length;

    const binMaePerDim = dims.map((d) => mae(bin(g[d]), bin(e[d])));
    const binMeanMae = binMaePerDim.reduce((a, b) => a + b, 0) / binMaePerDim.length;

    return {
        raw: rawMeanMae,
        binarized: binMeanMae,
        rawMaePerDim,
        binMaePerDim,
    };
};
