import Redis from "ioredis";
import { ensureIndex, VectorStore } from "../vector-store";
import path from "path";
import { writeFile } from "fs/promises";
import { createOutputFolderIfNeeded } from "../utils";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { exec } from "child_process";

const baseStructure = {
    provider: "mistral",
    llm: "mistral-medium-latest",
    reasoningEnabled: false,
    includeCitations: true,
    fewShotsEnabled: true,
    verbose: false
};

const client = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
const fixedSizeIndexName = "vector_store_index_fixed_size";
const agenticIndexName = "vector_store_index_agentic";

function generateCombinations(base: any, parameters: Record<string, any>): any[] {
    const keys = Object.keys(parameters);

    function helper(index: number, currentConfig: any): any[] {
        if (index === keys.length) return [currentConfig];

        const key = keys[index];
        const { values, condition } = parameters[key];

        const combinations: any[] = [];

        for (const value of values) {
            // Se c'è una condizione e non è soddisfatta, salta il set ma continua
            if (condition && !condition(currentConfig)) {
                combinations.push(...helper(index + 1, currentConfig));
                continue;
            }

            const nextConfig = { ...currentConfig, [key]: value };
            combinations.push(...helper(index + 1, nextConfig));
        }

        return combinations;
    }

    return helper(0, { ...base });
}


const main = async () => {

    const { runTests, test } = await yargs(hideBin(process.argv))
        .option('runTests', {
            alias: 'r',
            type: 'boolean',
            demandOption: true,
            description: 'Whether to run tests after generating each configuration'
        })
        .option('test', {
            alias: 't',
            type: 'string',
            demandOption: false,
            description: 'Path to the test file to use'
        })
        .parse();

    if (runTests && !test) {
        throw new Error("If you want to run tests, you must provide a test file using the -t option.");
    }

    await ensureIndex(client, fixedSizeIndexName, ['pageContent', 'TEXT', 'source', 'TAG']);
    await ensureIndex(client, agenticIndexName, ['pageContent', 'TEXT', 'source', 'TAG']);

    const fixedSizeDocStore = new VectorStore({
        client,
        indexName: fixedSizeIndexName,
        fieldToEmbed: 'pageContent'
    });

    const agenticDocStore = new VectorStore({
        client,
        indexName: agenticIndexName,
        fieldToEmbed: 'pageContent'
    });

    const parametersToTune = {
        docStore: {
            values: [fixedSizeDocStore, agenticDocStore]
        },
        numResults: {
            values: [1, 3, 5]
        },
        parentPageRetrieval: {
            values: [{ offset: 5 }],
            condition: (config: any) => {
                return config.docStore.getConfig().indexName == fixedSizeIndexName
            }
        }
    };

    const allCombinations = generateCombinations(baseStructure, parametersToTune);

    const outputPath = path.join('output', 'parameters-tuning');
    createOutputFolderIfNeeded(outputPath);
    const executionQueue = [];

    for (let i = 0; i < allCombinations.length; i++) {
        const config = allCombinations[i];
        const docStore = config.docStore;
        delete config.docStore; // Non serializziamo l'istanza del docStore
        const fileName = path.join(outputPath, `config-${i + 1}.json`);
        await writeFile(fileName, JSON.stringify({
            rag: config, 
            docStore: {
                indexName: docStore.getConfig().indexName
            }
        }, null, 2));

        const command = `npx tsx src/scripts/run-test.ts -t ${test ? test : 'your_test_file.json'} -c ${fileName}`;

        if (runTests) {
            executionQueue.push(command);
        }
    }

    for (const cmd of executionQueue) {
        console.log(`Executing: ${cmd}`);

        await new Promise((resolve, reject) => {
            exec(cmd, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Error executing command: ${error.message}`);
                    reject(error);
                    return;
                }
                if (stderr) {
                    console.error(`stderr: ${stderr}`);
                }
                console.log(`stdout: ${stdout}`);
                resolve(true);
            });
        });
    }
}

main().catch(err => {
    console.error("Error:", err);
    process.exit(1);
}).then(_ => process.exit(0));
