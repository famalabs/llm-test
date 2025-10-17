import { SentimentScores } from "../sentiment-analysis";

export const evaluateSentimentAnalysis = ({
    generatedScores,
    expectedScores
}: {
    generatedScores: SentimentScores[];
    expectedScores: SentimentScores[];
}) => {
    if (generatedScores.length != expectedScores.length) {
        throw new Error("Generated scores and expected scores arrays must have the same length.");
    }

    const allMaes: number[] = [];
    for (let i = 0;  i< expectedScores.length; i++) {
        const generated: SentimentScores = generatedScores[i];
        const expected: SentimentScores = expectedScores[i];

        const mae = (a:number, b:number) => Math.abs(a - b);

        const mae8 = [];
        for (const dimension of Object.keys(expected) as (keyof SentimentScores)[]) {
            mae8.push(
                mae(
                    generated[dimension], 
                    expected[dimension]
                )
            )
        }
        const meanMae = mae8.reduce((a, b) => a + b, 0) / mae8.length;
        allMaes.push(meanMae);
    }
    
    const meanOfMeansMae = allMaes.reduce((a, b) => a + b, 0) / allMaes.length;

    return meanOfMeansMae;
}