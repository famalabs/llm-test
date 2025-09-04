import { parseCliArgs } from '../lib/cli';
import { VectorStore } from '../lib/vector-store';
import { readFile } from 'fs/promises';
import { RecursiveCharacterTextSplitter, TextSplitter } from 'langchain/text_splitter';
import { Document } from 'langchain/document';
import { ChunkingStrategy } from '../constants/rag';
import { AgenticChunker } from '../lib/experimental/agentic-chunker';
import { MistralGenie } from '../lib/experimental/agentic-chunker/genie/mistral';

async function main() {
    const { files, chunking } = parseCliArgs(['files', 'chunking']);
    const filesPath = files!.split(',');
    let splitter: TextSplitter | AgenticChunker;

    if (chunking == ChunkingStrategy.FixedSize) {
        splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 300,
            chunkOverlap: 50,
        });
    }

    else if (chunking == ChunkingStrategy.Agentic) {
        // da vedere
        splitter = new AgenticChunker(
          {
            genie : new MistralGenie('mistral-small-latest'),
            verbose : true
          }  
        );

    }

    else {
        console.error('Invalid chunking strategy');
        process.exit(1);
    }

    const vectorStore = new VectorStore(`vector_store_index_${chunking}`);
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


    const allSplits = splitter instanceof TextSplitter ? await splitter.splitDocuments(docs) : await splitter.chunkBatch(docs.map(d => d.pageContent)).then(results => { return results.map((chunks, idx) => {
        return chunks.map(chunk => new Document({
            pageContent: chunk.text,
            metadata: { source: docs[idx].metadata.source, startIndex: chunk.startIndex, endIndex: chunk.endIndex }
        }));
    })}).then(arrays => arrays.flat());
    
    console.log(allSplits)
    
    // await vectorStore.add(allSplits);

    console.log(allSplits.length, 'document chunks embedded and stored');
}

main().catch(console.error).then(() => process.exit());