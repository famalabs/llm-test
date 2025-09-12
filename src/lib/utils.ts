export const sleep = (seconds: number) => new Promise(resolve => setTimeout(resolve, seconds * 1000));
export const getFileExtension = (fileName: string) => fileName.split('.').pop();
export function zip<T>(...arrays: T[][]): T[][] {
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
