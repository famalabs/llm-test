import { parseCliArgs } from '../lib/cli';
import { VectorStore } from '../lib/vector-store';
import { readFile } from 'fs/promises';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { Document } from 'langchain/document';

async function main() {
    const vectorStore = new VectorStore('vector_store_index');
    await vectorStore.load();
    const { files } = parseCliArgs(['files']);
    const filesPath = files!.split(',');

    const docs = await Promise.all(
        filesPath.map(async (path) => {
            const content = await readFile(path, 'utf-8');
            return new Document({
                pageContent: content,
                metadata: { source: path }
            });
        })
    );
 
    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 300,
        chunkOverlap: 50,
    });

    const allSplits = await splitter.splitDocuments(docs);
    await vectorStore.add(allSplits);

    console.log(allSplits.length, 'document chunks embedded and stored');
}

main().catch(console.error).then(() => process.exit());