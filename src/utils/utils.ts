import csv from 'csv-parser';
import { existsSync, mkdirSync } from 'fs';

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
  return asBuffer ? Buffer.from(new Float32Array(normalized).buffer) : normalized;
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

export const createOutputFolderIfNeeded = (outputFolder: string) => {
  if (!existsSync(outputFolder)) mkdirSync(outputFolder, { recursive: true });
  return outputFolder;
}