export interface MetricArguments {
    reference: string,
    prediction: string,
    query?: string,
    llm?: string,
}

export interface Metric {
    name: string,
    execute: ({ reference, prediction }: MetricArguments) => Promise<{ score: number }>,
}