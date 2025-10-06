import { existsSync, mkdirSync } from "fs";
import { readFile } from "fs/promises";
import csv from 'csv-parser';
import path from "path";

export const PATH_NORMALIZATION_MARK = '+';

export const documentCache: Record<string, string> = {};

export const readDocument = async (source: string, avoidCache: boolean = false) => {
  if (avoidCache) {
    const text = await readFile(source, "utf-8");
    return text;
  }

  if (!documentCache[source]) {
    const text = await readFile(source, "utf-8");
    documentCache[source] = text;
  }

  return documentCache[source];
}


export const createOutputFolderIfNeeded = (...segments: string[]) => {
  const outputFolder = segments.length === 0
    ? '.'
    : (segments.length === 1 ? segments[0] : path.join(...segments));
  if (!existsSync(outputFolder)) mkdirSync(outputFolder, { recursive: true });
  return outputFolder;
}

export const parseCSV = (csvContent: string) => {
  return new Promise<any[]>((resolve, _) => {
    const results: any[] = [];
    const parser = csv();
    parser.on('data', (data) => results.push(data));
    parser.on('end', () => resolve(results));
    parser.end(csvContent);
  });
}

export const checkCallFromRoot = () => {
  const currentDir = process.cwd();
  if (!currentDir.endsWith('llm-test')) {
    console.error('Error: This script must be run from the root of the repository (llm-test/).');
    process.exit(1);
  }
}

export const getFileExtension = (fileName: string) => fileName.split('.').pop();