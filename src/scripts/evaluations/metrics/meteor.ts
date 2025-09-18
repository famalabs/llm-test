import natural from "natural";
import { Metric, MetricArguments } from "./interfaces";

const stemmer = natural.PorterStemmer;
const wn = new natural.WordNet();

const tokenize = (s: string): string[] => {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

type Match = { refIdx: number; candIdx: number };

const align = async (
  reference: string[],
  candidate: string[]
): Promise<Match[]> => {
  const usedRef = new Set<number>();
  const matches: Match[] = [];

  // matches
  for (let ci = 0; ci < candidate.length; ci++) {
    const w = candidate[ci];
    for (let ri = 0; ri < reference.length; ri++) {
      if (!usedRef.has(ri) && reference[ri] === w) {
        usedRef.add(ri);
        matches.push({ refIdx: ri, candIdx: ci });
        break;
      }
    }
  }

  // stem
  const refStems = reference.map((w) => stemmer.stem(w));
  for (let ci = 0; ci < candidate.length; ci++) {
    if (matches.some((m) => m.candIdx === ci)) continue;
    const stem = stemmer.stem(candidate[ci]);
    for (let ri = 0; ri < reference.length; ri++) {
      if (!usedRef.has(ri) && refStems[ri] === stem) {
        usedRef.add(ri);
        matches.push({ refIdx: ri, candIdx: ci });
        break;
      }
    }
  }

  // synonym 
  for (let ci = 0; ci < candidate.length; ci++) {
    if (matches.some((m) => m.candIdx === ci)) continue;

    const synonyms = await getSynonyms(candidate[ci]);
    for (let ri = 0; ri < reference.length; ri++) {
      if (!usedRef.has(ri) && synonyms.has(reference[ri])) {
        usedRef.add(ri);
        matches.push({ refIdx: ri, candIdx: ci });
        break;
      }
    }
  }

  matches.sort((a, b) => a.candIdx - b.candIdx);
  return matches;
}

const countChunks = (matches: Match[]): number => {
  if (matches.length === 0) return 0;
  let chunks = 1;
  for (let i = 1; i < matches.length; i++) {
    const prev = matches[i - 1];
    const cur = matches[i];
    if (cur.refIdx !== prev.refIdx + 1) chunks++;
  }
  return chunks;
}

const getSynonyms = async (word: string): Promise<Set<string>> => {
  return new Promise((resolve) => {
    wn.lookup(word, (results) => {
      const set = new Set<string>();
      results.forEach((result) => {
        result.synonyms.forEach((syn) => set.add(syn.toLowerCase().replace(/_/g, " ")));
      });
      resolve(set);
    });
  });
}

const execute = async ({ reference, prediction }: MetricArguments): Promise<{score: number}> => {
  const ref = tokenize(reference);
  const cand = tokenize(prediction);

  const matches = await align(ref, cand);
  const m = matches.length;
  if (m === 0) return { score: 0 };

  const P = m / cand.length;
  const R = m / ref.length;
  const Fmean = (10 * P * R) / (R + 9 * P);

  const chunks = countChunks(matches);
  const penalty = 0.5 * Math.pow(chunks / m, 3);

  return { score: Fmean * (1 - penalty) };
}

export const meteor: Metric = {
  name: 'meteor',
  execute,
}