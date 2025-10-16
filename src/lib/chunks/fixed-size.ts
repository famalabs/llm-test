import { RecursiveCharacterTextSplitter, RecursiveCharacterTextSplitterParams } from "langchain/text_splitter";
import { Chunk } from "./interfaces";

export class FixedSizeChunker {
    private splitter: RecursiveCharacterTextSplitter;

    constructor(fields?: Partial<RecursiveCharacterTextSplitterParams> | undefined) {
        this.splitter = new RecursiveCharacterTextSplitter(fields);
    }

    async splitDocuments(docs: { pageContent: string; metadata: Record<string, any> }[]): Promise<Chunk[]> {
        const chunks = await this.splitter.splitDocuments(docs) as Chunk[];

        for (let i = 0; i < chunks.length; i++) {
            chunks[i].id = i.toString();
            chunks[i].distance = 0;
        }

        return chunks;
    }
}