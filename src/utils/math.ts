export const sum = (arr: number[]) => arr.reduce((acc, el) => acc + el, 0);

export const softmax = (values: number[]): number[] => {
  const max = Math.max(...values); // for numerical stability
  const exps = values.map(v => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map(v => v / sum);
};

export const computeVectorNorm = (vec: number[]) => Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));

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
