export interface MetricArguments {
    keyRef: string,
    fullRef: string,
    prediction: string,
    query?: string,
    llm?: string,
}

export interface Metric {
    name: string,
    execute: ({ query, keyRef, fullRef, prediction }: MetricArguments) => Promise<{ score: number }>,
}