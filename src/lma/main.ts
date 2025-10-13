import yargs from "yargs";
import { analyzeSentiment } from "./sentiment-analysis";
import { hideBin } from "yargs/helpers";
import { tqdm } from 'node-console-progress-bar-tqdm';
import { readFile, writeFile } from "fs/promises";
import { LLMConfigProvider } from "../llm";
import { createOutputFolderIfNeeded, PATH_NORMALIZATION_MARK } from "../utils";
import path from "path";

const computeScores = (actual: Record<string, number>, predicted: Record<string, number>) => {
    const polarityDiff = Math.abs(actual.polarity - predicted.polarity);
    const polarityScore = 1 - polarityDiff / 2;
    const moodDiff = Math.abs(actual.mood - predicted.mood);
    const toneDiff = Math.abs(actual.tone - predicted.tone);
    const registryDiff = Math.abs(actual.registry - predicted.registry);
    const moodScore = 1 - moodDiff / 2;
    const toneScore = 1 - toneDiff / 2;
    const registryScore = 1 - registryDiff / 2;

    let generalDiffSum = 0;
    const dimensions = ['polarity', 'involvement', 'energy', 'temper', 'mood', 'tone', 'registry'] as const;

    for (const dim of dimensions) {
        const actualValue = actual[dim] ?? 0;
        const predictedValue = predicted[dim] ?? 0;
        generalDiffSum += Math.pow(predictedValue - actualValue, 2);
    }

    const generalScore = 1 - Math.sqrt(generalDiffSum / dimensions.length) / 2;

    return { polarityScore, generalScore, moodScore, toneScore, registryScore };
}

const main = async () => {
    const { input, model, provider } = await yargs(hideBin(process.argv))
        .option("input", {
            alias: "i",
            type: "string",
            description: "Input text or path to a JSON file with an array of sentences / conversations",
            demandOption: true,
        })
        .option("model", {
            alias: "m",
            type: "string",
            description: "LLM model to use",
            demandOption: true,
        })
        .option("provider", {
            alias: "p",
            type: "string",
            description: "LLM provider",
            choices: ['openai', 'google', 'mistral'],
            demandOption: true,
        })
        .parse();


    const data = JSON.parse(await readFile(input, "utf-8")) as Array<{ input: string; scores: Record<string, number> }>;
    const output = [];

    for (const { input: sentenceOrConversation, scores } of tqdm(data, { description: 'Analyzing sentiment', total: data.length })) {
        const result = await analyzeSentiment({
            model,
            provider: provider as LLMConfigProvider,
            sentenceOrConversation,
        });

        output.push({
            input: sentenceOrConversation,
            actual: scores,
            prediction: result.scores,
            computedScores: computeScores(scores, result.scores)
        });
    }

    createOutputFolderIfNeeded('output', 'sentiment-analysis');
    const outputPath = path.join('output', 'sentiment-analysis', `sentiment_analysis_${input.replaceAll(path.sep, PATH_NORMALIZATION_MARK)}_${model}_${provider}.json`);
    await writeFile(outputPath, JSON.stringify(output, null, 2), "utf-8");
    console.log(`Results written to ${outputPath}`);

    const avgPolarityScore = output.reduce((acc, curr) => acc + curr.computedScores.polarityScore, 0) / output.length;
    const avgGeneralScore = output.reduce((acc, curr) => acc + curr.computedScores.generalScore, 0) / output.length;

    console.log(`Average Polarity Score: ${avgPolarityScore.toFixed(4)}`);
    console.log(`Average Mood Score: ${(output.reduce((acc, curr) => acc + curr.computedScores.moodScore, 0) / output.length).toFixed(4)}`);
    console.log(`Average Tone Score: ${(output.reduce((acc, curr) => acc + curr.computedScores.toneScore, 0) / output.length).toFixed(4)}`);
    console.log(`Average Registry Score: ${(output.reduce((acc, curr) => acc + curr.computedScores.registryScore, 0) / output.length).toFixed(4)}`);
    console.log(`Average General Score: ${avgGeneralScore.toFixed(4)}`);
}

main().catch(console.error).then(() => process.exit(0));