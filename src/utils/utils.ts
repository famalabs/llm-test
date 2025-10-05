import csv from 'csv-parser';
import { existsSync, mkdirSync } from 'fs';
import * as readline from 'node:readline/promises';
import { exec, execFile } from 'node:child_process';
import path from 'path';
import os from 'os';

let terminal: readline.Interface | null = null;

export const sleep = (seconds: number) => new Promise(resolve => setTimeout(resolve, seconds * 1000));

export const getFileExtension = (fileName: string) => fileName.split('.').pop();

export const zip = <T>(...arrays: T[][]): T[][] => {
  const minLen = Math.min(...arrays.map(a => a.length));
  return Array.from({ length: minLen }, (_, i) =>
    arrays.map(arr => arr[i])
  );
}

export const sum = (arr: number[]) => arr.reduce((acc, el) => acc + el, 0);

export const softmax = (values: number[]): number[] => {
  const max = Math.max(...values); // for numerical stability
  const exps = values.map(v => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map(v => v / sum);
};

export const deepCopy = <T>(obj: T): T => {
  return JSON.parse(JSON.stringify(obj));
}

export const randomUnitVector = (dim: number, asBuffer: boolean = false): Buffer | number[] => {
  const arr = Array.from({ length: dim }, () => Math.random() * 2 - 1);
  const norm = Math.sqrt(arr.reduce((acc, x) => acc + x * x, 0));
  const normalized = arr.map((x) => x / norm);
  return asBuffer ? float32Buffer(normalized) : normalized;
};

export const percentile = (values: number[], p: number) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

export const mean = (values: number[]) => {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export const stddev = (values: number[]) => {
  const m = mean(values);
  return Math.sqrt(values.reduce((acc, v) => acc + (v - m) ** 2, 0) / values.length);
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

// Accepts either a single string (possibly already containing separators) or multiple
// path segments and ensures the directory exists. Returns the absolute/relative (as passed) path.
export const createOutputFolderIfNeeded = (...segments: string[]) => {
  const outputFolder = segments.length === 0
    ? '.'
    : (segments.length === 1 ? segments[0] : path.join(...segments));
  if (!existsSync(outputFolder)) mkdirSync(outputFolder, { recursive: true });
  return outputFolder;
}

export const getObjectLength = (obj: Record<string, any> | null | undefined) => {
  if (!obj) return 0;
  return Object.keys(obj).length;
}

export const getUserInput = async (prompt: string) => {
  if (!terminal) {
    terminal = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }
  return await terminal.question(prompt)
}

export const float32Buffer = (arr: number[]) => {
  return Buffer.from(new Float32Array(arr).buffer);
}

export const lemmatize = (text: string | string[]) => {
  const code = `import spacy; import json; nlp = spacy.load("it_core_news_lg"); texts = ${JSON.stringify(text)}; lem = [" ".join(doc.lemma_ if isinstance(doc, spacy.tokens.Token) else [t.lemma_ for t in doc]) for doc in nlp.pipe(texts)]; print(json.dumps(lem))`;
  return new Promise<string[]>((resolve, reject) => {
    let commandFunction: (callback: (error: Error | null, stdout: string, stderr: string) => void) => void;

    const platform = os.platform();

    if (platform === 'win32') {
      const venvPython = path.join(process.cwd(), ".venv", "Scripts", "python.exe");
      commandFunction = (callback: (error: Error | null, stdout: string, stderr: string) => void) => {
        execFile(
          venvPython, ['-u', '-c', code],
          { maxBuffer: JSON.stringify(text).length + 1024 },
          callback);
      }
    }
    else if (platform == 'darwin' || platform == 'linux') {
      commandFunction = (callback: (error: Error | null, stdout: string, stderr: string) => void) => {
        exec('source .venv/bin/activate && python -c ' + JSON.stringify(code), callback);
      }
    }
    else {
      return reject(new Error(`Unsupported platform: ${platform}`));
    }
    commandFunction((error, stdout, stderr) => {
      if (error) {
        reject(`Error: ${error.message}`);
        return;
      }
      if (stderr) {
        reject(`Stderr: ${stderr}`);
        return;
      }
      try {
        const result = JSON.parse(stdout);
        resolve(result);
      }
      catch (e) {
        reject(`Failed to parse output: ${stdout}`);
      }
    });
  });
}

export const checkCallFromRoot = () => {
  const currentDir = process.cwd();
  if (!currentDir.endsWith('llm-test')) {
    console.error('Error: This script must be run from the root of the repository (llm-test/).');
    process.exit(1);
  }
}