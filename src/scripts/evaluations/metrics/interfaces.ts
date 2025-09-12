export interface MetricArguments {
    reference: string,
    prediction: string,
}

export interface Metric {
    name: string,
    execute: (args: any) => Promise<{ score: number }>,
    weight: number
}