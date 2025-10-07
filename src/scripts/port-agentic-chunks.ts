import { VectorStore, ensureIndex } from "../vector-store";
import { PATH_NORMALIZATION_MARK } from "../utils";
import { readdir, readFile } from "fs/promises";
import { Chunk } from "../lib/chunks";
import { hideBin } from "yargs/helpers";
import Redis from "ioredis";
import yargs from "yargs";
import path from "path";

function denormalizeSource(fileName: string): string {
    return fileName
        .replace(/_chunks\[agentic\]\.json$/, "")
        .replace(new RegExp(`\\${PATH_NORMALIZATION_MARK}`, "g"), path.sep);
}

async function main() {
    const { folder } = await yargs(hideBin(process.argv))
        .option("folder", {
            alias: "f",
            type: "string",
            description: "Folder containing the agentic-chunked JSON files",
            demandOption: true,
        })
        .parse();

    const files = await readdir(folder);
    const jsonFiles = files.filter((f) => f.endsWith(".json"));

    if (jsonFiles.length === 0) {
        console.error("No JSON files found in the specified folder.");
        process.exit(1);
    }

    const client = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
    const indexName = `vector_store_index_agentic`;

    await ensureIndex(client, indexName, [
        "pageContent",
        "TEXT",
        "source",
        "TAG",
        "metadata",
        "TEXT",
    ]);

    const vectorStore = new VectorStore({
        client,
        indexName,
        fieldToEmbed: "pageContent",
    });

    await vectorStore.load();

    for (const file of jsonFiles) {
        const filePath = path.join(folder, file);
        const chunks: string[] = JSON.parse(await readFile(filePath, "utf-8"));

        const source = denormalizeSource(file.replace(folder + path.sep, ""));
        const docs: Chunk[] = [];
        let globalLineOffset = 0;

        console.log(`Processing ${file} → source: ${source}`);
        for (let i = 0; i < chunks.length; i++) {
            const chunkText = chunks[i];
            const lineCount = chunkText.split("\n").length;

            const fromLine = globalLineOffset;
            const toLine = globalLineOffset + lineCount - 1;

            docs.push({
                pageContent: chunkText,
                metadata: {
                    source,
                    chunkIndex: i,
                    loc: { lines: { from: fromLine, to: toLine } },
                },
                distance: 0,
            });

            globalLineOffset += lineCount;
        }

        await vectorStore.add(docs);
    }

    console.log("All files processed and added to the vector store.");
    await client.quit();
}

main().catch(console.error);
