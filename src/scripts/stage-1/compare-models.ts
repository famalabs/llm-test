import { mistral } from "@ai-sdk/mistral";
import { generateObject } from "ai";
import { sleep } from '../../lib/utils';
import { writeFile, readFile } from "fs/promises";
import 'dotenv/config';
import { corpusInContext } from "../../lib/prompt/corpus-in-context";
import { addLineNumbers, getCitationText } from "../../lib/nlp";
import z from "zod";

const questions = [
    "Ho sentito che alcuni farmaci possono dare problemi allo stomaco anche senza sintomi. Devo preoccuparmi con Oki?",
    "Che cosa mangia solitamente l'Orca?", 
    "Qual è il significato della parola OK?", 
    "OKI può farmi venire un infarto?", 
    "OKI causa dipendenza?", 
    "Ho allergie e a volte attacchi di asma. Posso avere problemi con Oki?", 
    "Quali altri farmaci posso assumere con Oki?"
]
const llms = ['mistral-small-latest', 'mistral-medium-latest', 'mistral-large-latest'];
let comparison = '';

const main = async () => {
    const document = await readFile('data/document_1.txt', 'utf-8');
    for (const llm of llms) {
        console.log('>> processing LLM: ', llm);
        comparison += `# ===== ${llm} =====\n\n`;
        for (const question of questions) {
            const { object: result } = await generateObject({
                model: mistral(llm),
                prompt: corpusInContext([document].map(addLineNumbers), question),
                schema: z.object({
                    answer: z.string(),
                    citations: z.array(
                        z.object({
                            startLine: z.number(),
                            endLine: z.number()
                        })
                    )
                })
            });

            const { answer, citations } = result;

            comparison += `### ${question}\n\n`;
            comparison += `${answer}\n\n`;
            comparison += `Citations:\n`;
            comparison += `${citations.map(({ startLine, endLine }, idx) => `\t[${idx + 1} / {${startLine}-${endLine}}] ${getCitationText(document, startLine, endLine)}`).join('\n')}\n\n`; 
 
            await sleep(2); 
        } 
    } 
    await writeFile('output/stage-1/model-comparison.md', comparison); 
}

main().catch(console.error);