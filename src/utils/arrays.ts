export const float32Buffer = (arr: number[]) => {
    return Buffer.from(new Float32Array(arr).buffer);
}

export const randomUnitVector = (dim: number, asBuffer: boolean = false): Buffer | number[] => {
    const arr = Array.from({ length: dim }, () => Math.random() * 2 - 1);
    const norm = Math.sqrt(arr.reduce((acc, x) => acc + x * x, 0));
    const normalized = arr.map((x) => x / norm);
    return asBuffer ? float32Buffer(normalized) : normalized;
};

export const zip = <T>(...arrays: T[][]): T[][] => {
    const minLen = Math.min(...arrays.map(a => a.length));
    return Array.from({ length: minLen }, (_, i) =>
        arrays.map(arr => arr[i])
    );
}