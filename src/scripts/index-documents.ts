import yargs from 'yargs';
import { VectorStore } from '../vector-store';
import { readFile } from 'fs/promises';
import { RecursiveCharacterTextSplitter, TextSplitter } from 'langchain/text_splitter';
import { Document } from 'langchain/document';
import { hideBin } from 'yargs/helpers';

async function main() {
    const argv = await yargs(hideBin(process.argv))
        .option('files', { alias: 'f', type: 'string', demandOption: true, description: 'Comma-separated list of text file paths' })
        .option('chunking', { alias: 'c', type: 'string', choices: ['fixed-size', 'agentic'], demandOption: true, description: 'Chunking strategy' })
        .help()
        .parse();
        
    const { files, chunking } = argv;
    const filesPath = files!.split(',');
    let splitter: TextSplitter;

    if (chunking == 'fixed-size') {
        const tokenLength = 300;
        const tokenOverlap = 50;
        const tokenToCharRatio = 4; // approx
        
        splitter = new RecursiveCharacterTextSplitter({
            chunkSize: tokenLength * tokenToCharRatio,
            chunkOverlap: tokenOverlap * tokenToCharRatio,
        });
    }

    else if (chunking == 'agentic') {
        // da vedere
        throw new Error('AgenticChunking not implemented yet!')
    }

    else {
        console.error('Invalid chunking strategy. Available options: fixed-size, agentic');
        process.exit(1);
    }

    console.log('Will istantiate now')
    const vectorStore = new VectorStore(`vector_store_index_${chunking}`);
    console.log('Will load now')
    await vectorStore.load();

    const docs = await Promise.all(
        filesPath.map(async (path) => {
            const content = await readFile(path, 'utf-8');
            return new Document({
                pageContent: content,
                metadata: { source: path }
            });
        })
    );

    const allSplits = await splitter.splitDocuments(docs);    
    
    await vectorStore.add(allSplits);

    console.log(allSplits.length, 'document chunks embedded and stored');
}

main().catch(console.error).then(() => process.exit());