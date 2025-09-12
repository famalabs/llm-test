import { Metric, MetricArguments } from "./interfaces";

type TestSpecificProps = MetricArguments & { keywords: string[] }

const execute = async ({
    prediction,
    keywords
}: TestSpecificProps) => {
    const predLower = prediction.toLowerCase();
    const hits = keywords.filter((kw: string) => predLower.includes(kw.toLowerCase())).length;
    const score = keywords.length > 0 ? hits / keywords.length : 0;
    return { score }
}

export const testSpecific: Metric = {
    name: 'test-specific',
    execute,
    weight: 0.2
}