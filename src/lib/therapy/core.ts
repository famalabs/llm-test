import { generateObject, ModelMessage } from "ai";
import { getLLMProvider, LLMConfigProvider } from "../../llm";
import { STRUCTURED_THERAPY_PROMPT, THERAPY_EXTRACTION_PROMPT } from "../prompt";
import { TherapySchema, MarkdownTableTherapySchema } from "./schema";

export const extractStructuredTherapy = async (text: string, model: string, provider: LLMConfigProvider, language?: string) => {

    const llm = (await getLLMProvider(provider))(model);

    const { object: result } = await generateObject({
        model: llm,
        schema: TherapySchema,
        temperature: 0,
        seed: 42,
        messages: [
            { role: "system", content: STRUCTURED_THERAPY_PROMPT(language) },
            { role: "user", content: `Extract the structure of the therapy from the following medical text:\n\n TEXT:"""${text}"""` }
        ]
    });

    return result.therapy_drugs;
};


export const extractTherapyAsMarkdownTable = async (text: string, model: string, provider: LLMConfigProvider, language?: string) => {

    const llm = (await getLLMProvider(provider))(model);

    const { object: result } = await generateObject({
        model: llm,
        schema: MarkdownTableTherapySchema,
        temperature: 0,
        seed: 42,
        messages: [
            { role: "system", content: THERAPY_EXTRACTION_PROMPT(language) },
            { role: "user", content: `Extract the current therapy from the following medical text:\n\n TEXT:"""${text}"""` }
        ] as ModelMessage[]
    });

    return result.markdown;
};
