
export type LLMConfigProvider = 'mistral' | 'google' | 'openai';

export interface LLMConfig {
    /**
     * Name of the main LLM used for generating answers.
     */
    model: string;

    /**
     * Name of the LLM provider.
     */
    provider: LLMConfigProvider;
}
