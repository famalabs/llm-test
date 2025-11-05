// run with npx tsx src/tts/main.ts --text "Grande Tommaso, hai completato tutti i compiti\! Posso fare qualcos'altro per te?" --play true --tone friendly
// or, a bit funnier: npx tsx src/tts/main.ts --text "MUAHAHAHAHAHAHAHAHA, sarò io a vincere\!"  --play true --tone enthusiastic
// a longer test: npx tsx src/tts/main.ts --text "La mia vita può durare qualche ora, quello che produco mi divora. Sottile sono veloce, grossa sono lenta e il vento molto mi spaventa. Chi sono?" --play true --tone enthusiastic

import { exec } from "child_process";

import { experimental_generateSpeech as generateSpeech } from "ai";
import { openai } from "@ai-sdk/openai";
import { hideBin } from "yargs/helpers";
import os from "os";
import fs from "fs/promises";
import path from "path";
import 'dotenv/config';
import yargs from "yargs";
import { createOutputFolderIfNeeded } from "../utils";

const main = async () => {

    const { text, play, tone } = await yargs(hideBin(process.argv))
        .option("text", {
            alias: "t",
            type: "string",
            description: "Text to convert to speech",
            demandOption: true
        })
        .option("tone", {
            alias: "n",
            type: "string",
            choices: ["joyful", "professional", "friendly", "empathetic", "enthusiastic"],
            description: "Tone of the speech",
            default: "joyful"
        })
        .option('play', {
            alias: 'p',
            type: 'boolean',
            description: 'Play the audio after generation',
            default: false
        })
        .help()
        .parse() as {
            text: string,
            play: boolean,
            tone: string
        };

    const start = performance.now();
    const result = await generateSpeech({
        model: openai.speech("gpt-4o-mini-tts"),
        text,
        voice: "sage",
        outputFormat: "mp3",
        instructions: `You're talking as a professional medical AI assistant. Be ${tone}.`,
    });
    const end = performance.now();

    const { uint8Array, format } = result.audio;

    const outFile = path.join(createOutputFolderIfNeeded('output', 'tts'), `output-${Date.now()}.${format}`);
    await fs.writeFile(outFile, Buffer.from(uint8Array));
    console.log(`Audio file saved to ${outFile} (format: ${format})`);

    const audioDurationInSeconds = uint8Array.length / (16000); // this estimate assumes 16kHz mono PCM audio - it may not work for other formats / other providers.
    console.log(`Audio duration: approximately ${audioDurationInSeconds.toFixed(2)} seconds`);
    console.log(`Speech generation took ${end - start} milliseconds`);

    if (play) {
        const platform = os.platform();
        if (platform == 'darwin') {
            console.log("Playing audio on macOS...");
            exec(`afplay ${outFile}`, (error, _stdout, _stderr) => {
                if (error) {
                    console.error("Error while playing audio:", error);
                }
            });
            return;
        }
        else if (platform == 'win32') {
            console.log("Playing audio on Windows...");
            exec(`start ${outFile}`, (error) => {
                if (error) {
                    console.error("Error while playing audio:", error);
                }
            });
            return;
        }
        else if (platform =='linux') {
            console.log("Playing audio on Linux...");
            exec(`xdg-open ${outFile}`, (error) => {
                if (error) {
                    console.error("Error while playing audio:", error);
                }
            });
        }
        else throw new Error(`Unsupported platform for audio playback: ${platform}`);
    }
}

main().catch(console.error).then(() => process.exit(0));