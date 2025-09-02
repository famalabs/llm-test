export declare type LargeLanguageModel = {
    value: string;
    hub: string;
};

export declare type LargeLanguageModels = Record<string, Record<string, LargeLanguageModel>>;
export const LargeLanguageModels: LargeLanguageModels = {
    Mistral: {
        Medium: {
            value: "mistral-large-latest",
            hub: "Xenova/mistral-tokenizer-v3",
        },
        Small: {
            value: "mistral-small-latest",
            hub: "Xenova/mistral-tokenizer-v3",
        },
    }
}