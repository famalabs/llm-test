import { z } from 'zod';
import { mistral } from '@ai-sdk/mistral';
import yargs from "yargs";
import { generateObject, ModelMessage } from 'ai';
import {
    parseDocx,
    parseDoc,
} from './extractors';
import { createOutputFolderIfNeeded, getFileExtension } from "../../lib/utils";
import { writeFile } from "fs/promises";
import { PATH_NORMALIZATION_MARK } from "../../lib/nlp";
import 'dotenv/config';
import { hideBin } from 'yargs/helpers';

const extractTherapy = async (text: string) => {
    const systemPrompt = `You are a precise medical assistant specialized in therapy extraction, normalization, and summarization.

Your task:
- Take the provided medical text and return **only one Markdown table** with the *current, final therapy*.
- Use the **same language as the input text** for headers and content.
- The table must have exactly these columns: 

  | Nome del Farmaco | Scopo / Utilizzo | Frequenza Prescritta | Istruzioni Speciali |

### STRICT EXTRACTION & NORMALIZATION RULES

1. **ONLY FINAL, ACTIVE THERAPY**
   - If a drug is replaced, **remove the old one completely** and include **only the new one**.
     - Example: If the text says “shift from A to B", remove A entirely and list only B with its dosage.
   - If a dosage is updated (e.g. “reduce A to 30 mg”), include only the new dosage, never the previous one.
   - If a drug is discontinued, do not include it.

2. **NO DUPLICATES**
   - Each drug appears **only once**.
   - Merge all notes, timings, and frequency into a single row.

3. **COMPLETE DOSAGE, FREQUENCY, TIMING & DURATION**
   - Include: exact dosage, number of tablets/capsules, frequency (x 2/die -> due volte al giorno), timing (“al mattino a digiuno”, “alle ore 18”).
   - Include any duration/end date (e.g. “per almeno 6 mesi”, “vita natural durante”).
   - Always put duration inside *Istruzioni Speciali*.

4. **PRN (AS NEEDED) & VARIABLE SCHEMES**
   - If a drug is "al bisogno" (as needed), write that explicitly.
   - If a regimen is variable (“1 cp + 2 cp”), write it as is and add “secondo schema indicato” in *Istruzioni Speciali* if needed.

5. **STANDARDIZE CLASSIFICATION**
   - Always fill *Scopo / Utilizzo* with a short, standardized category:
     - Examples: immunosoppressore, profilassi antibatterica, profilassi antivirale, profilassi antifungina, gastroprotettore, ansiolitico, beta-bloccante, antipsicotico, anticoagulante, integratore, lassativo, antiacido.
   - Infer the category from context when clear.

6. **EXPAND ALL ABBREVIATIONS & SIGLA**
   - Convert shorthand, abbreviation and more into full human-readable text, always in the language of the input.
   - SIGLE -> DA RIMUOVERE E RIMPIAZZARE CON IL NOME COMPLETO -> NECESSARIO PER CHIAREZZA.
   - ESEMPIO: "cp" nonva bene! -> "compresse"
   - ESEMPIO: "mg" va bene -> "mg"
   - ESEMPIO: "x" non va bene -> "per"
   - ESEMPIO: "die" non va bene -> "al giorno"
   - ESEMPIO: "1 cp x 2/die" non va bene -> "1 compressa per due volte al giorno"
   - ESEMPIO: "a.c." non va bene -> "a digiuno"
   ETC...

7. **NEVER LEAVE CELLS EMPTY**
   - If a drug has no dosage, put “-” in *Frequenza Prescritta*.
   - Always include route of administration in *Istruzioni Speciali* (even if obvious).
   - Every row must have all 4 columns filled with meaningful, human-readable information.

8. **OUTPUT FORMAT**
   - Return only a single, clean Markdown table.
   - No narrative text, no outdated dosages, no duplicates.
   - The result must represent exactly the *final, current therapy* as of the last update in the text.
`;

    const { object: result } = await generateObject({
        model: mistral('mistral-small-latest'),
        schema: z.object({
            markdown: z.string().describe('Single Markdown string containing ONLY a well-formatted drug table with all current therapy information (no extra text), using the same language as the input text.')
        }),
        temperature: 0,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Extract the current therapy from the following medical text:\n\n TEXT:"""${text}"""` }
        ] as ModelMessage[]
    });

    return result.markdown;
};


const main = async () => {
    const argv = await yargs(hideBin(process.argv))
        .option('source', { alias: 's', type: 'string', demandOption: true, description: 'Path to the source file (.doc or .docx)' })
        .help()
        .parse();
    const { source } = argv;

    const sourceExtension = getFileExtension(source!);
    let text: string | undefined = undefined;

    if (sourceExtension === 'docx') {
        console.log('Will parse .docx file');
        text = await parseDocx({ source: source! });
    }
    else if (sourceExtension === 'doc') {
        console.log('Will parse .doc file');
        text = await parseDoc({ source: source! });
    }
    else {
        console.error('Unsupported file type');
        process.exit(1);
    }

    if (!text) throw new Error('No conversion result returned.')

    console.log('Extracting therapy...');
    const rawTherapy = await extractTherapy(text);

    let outputFile = `${createOutputFolderIfNeeded('output/document-ingestion/therapy')}/therapy-${source!.replaceAll('/', PATH_NORMALIZATION_MARK)}.md`;
    await writeFile(outputFile, rawTherapy);
    console.log('Extracted therapy written to:', outputFile);
}


main().catch(console.error).then(() => process.exit(0));