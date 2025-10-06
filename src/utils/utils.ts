export const sleep = (seconds: number) => new Promise(resolve => setTimeout(resolve, seconds * 1000));

export const deepCopy = <T>(obj: T): T => {
  return JSON.parse(JSON.stringify(obj));
}