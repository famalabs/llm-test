import { readFile } from "fs/promises";

export const documentCache: Record<string, string[]> = {};

export const getDocumentLines = async (source: string) => {
  if (!documentCache[source]) {
    const text = await readFile(source, "utf-8");
    documentCache[source] = text.split("\n");
  }
  return documentCache[source];
}

export const readDocument = async (source: string, avoidCache: boolean = false) => {
  if (avoidCache) {
    const text = await readFile(source, "utf-8");
    return text;
  }

  if (!documentCache[source]) {
    const text = await readFile(source, "utf-8");
    documentCache[source] = text.split("\n");
  }

  return documentCache[source].join('\n');
}