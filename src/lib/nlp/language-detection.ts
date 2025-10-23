import os from 'os';
import fs, { existsSync } from 'fs';
import fetch, { Response } from 'node-fetch';
import path from 'path';
import unzipper from 'unzipper';
import { Pipeline } from '@huggingface/transformers';
import { TqdmProgress } from 'node-console-progress-bar-tqdm';
import { LanguageLabel } from './interfaces';

let languageDetectionModel: Pipeline | null = null;

const FILE_ID = '1_umuMSwHj57JefzsgUPW3tVqpnjqythf';
const BASE_URL = `https://drive.google.com/uc?export=download&id=${FILE_ID}`;

const MODEL_NAME = 'xlm-roberta-base-language-detection-onnx';
const ZIP_PATH = path.join(os.tmpdir(), 'xlm-roberta-base-language-detection-onnx.zip');
const DEST_FOLDER = path.join('local', 'models');
const MODEL_PATH = path.join(DEST_FOLDER, MODEL_NAME);

const cookieJar = new Map<string, string>();

const extractDownloadHref = (html: string): string | null => {
    const m = html.match(/confirm=([0-9A-Za-z_]+)/);
    if (m) return `${BASE_URL}&confirm=${m[1]}`;
    const m2 = html.match(/href="(\/uc\?export=download[^"]+)"/);
    if (m2) return `https://drive.google.com${m2[1].replace(/&amp;/g, '&')}`;
    return null;
}

const fetchWithCookies = async (url: string): Promise<Response> => {
    const cookieHeader = (cookieJar.size == 0) ? undefined : Array.from(cookieJar.entries())
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');

    const res = await fetch(url, {
        redirect: 'follow',
        headers: {
            ...(cookieHeader ? { cookie: cookieHeader } : {}),
            'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari',
            accept: '*/*',
        },
    });

    const setCookie: string[] | undefined = res.headers.raw()?.['set-cookie'];
    if (setCookie) {
        for (const c of setCookie) {
            const m = /^([^=]+)=([^;]*)/.exec(c);
            if (m) cookieJar.set(m[1], m[2]);
        }
    }
    return res;
}

const getDownloadResponse = async (): Promise<Response> => {
    let res = await fetchWithCookies(BASE_URL);

    const isHtml = (res: Response) => (res.headers.get('content-type') || '').includes('text/html');
    const hasContentDisposition = (res: Response) => { const cd = res.headers.get('content-disposition') || ''; return /attachment/i.test(cd) || /filename=/i.test(cd); };

    const html = await res.text();
    if (/quota|too many users have viewed or downloaded this file/i.test(html)) {
        throw new Error('Quota exceeded su Google Drive: too many users have viewed or downloaded this file.');
    }
    const downloadUrl = extractDownloadHref(html);
    if (!downloadUrl) throw new Error('Impossible to find download link.');

    res = await fetchWithCookies(downloadUrl);
    if (hasContentDisposition(res) && !isHtml(res)) return res;

    throw new Error('Download failed');
}

const saveResponseToFile = async (res: Response, output: string) => {
    await new Promise<void>((resolve, reject) => {
        const file = fs.createWriteStream(output);
        const totalBytes = Number(res.headers.get('content-length')) || undefined;
        const MB = 1_000_000;
        const totalMB = totalBytes ? Math.ceil(totalBytes / MB) : undefined;

        const pb = new TqdmProgress({
            description: 'Downloading model...',
            total: totalMB,          
            unit: 'MB',              
            unitScale: false,        
            minInterval: 250,        
        });

        pb.render();

        const bodyStream = res.body as unknown as NodeJS.ReadableStream;

        let downloadedBytes = 0;
        let reportedMB = 0;
        let pendingBytes = 0;
        let lastTick = Date.now();

        bodyStream.on('data', (chunk: Buffer) => {
            downloadedBytes += chunk.length;
            pendingBytes += chunk.length;

            const now = Date.now();
            const have1MB = pendingBytes >= MB;
            const timeUp = now - lastTick >= 250;

            if (have1MB || timeUp) {
                const currentMB = Math.floor(downloadedBytes / MB);
                const deltaMB = currentMB - reportedMB;
                if (deltaMB > 0) {
                    pb.update(deltaMB);
                    reportedMB = currentMB;
                    pendingBytes -= deltaMB * MB;
                }
                lastTick = now;
            }
        });

        bodyStream.on('end', () => {
            try {
                if (totalMB != undefined && reportedMB < totalMB) {
                    pb.update(totalMB - reportedMB);
                }
                pb.close();
            } catch { }
        });

        bodyStream.on('error', (err: any) => {
            try { pb.close(); } catch { }
            reject(err);
        });

        bodyStream.pipe(file);

        file.on('finish', resolve);
        file.on('error', (err) => {
            try { pb.close(); } catch { }
            reject(err);
        });
    });
}


async function unzipIfZip(zipPath: string, dest: string) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

    console.log('Extracting ZIP...');
    await fs.createReadStream(zipPath).pipe(unzipper.Extract({ path: dest })).promise();
    console.log(`Extraction completed in: ${dest}`);
}

const cleanUp = async () => {
    console.log('Cleaning up temporary files...');

    if (fs.existsSync(ZIP_PATH)) {
        fs.unlinkSync(ZIP_PATH);
        console.log(`Temporary file deleted: ${ZIP_PATH}`);
    }

    const macOsDsStore = path.join(DEST_FOLDER, '__MACOSX');
    if (fs.existsSync(macOsDsStore)) {
        fs.rmSync(macOsDsStore, { recursive: true, force: true });
        console.log(`Removed macOS __MACOSX folder: ${macOsDsStore}`);
    }

    cookieJar.clear();
}

async function downloadLanguageDetectionModel() {
    try {
        console.log('Starting model download from Google Drive...');
        const res = await getDownloadResponse();

        await saveResponseToFile(res, ZIP_PATH);

        const sizeGB = (fs.statSync(ZIP_PATH).size / (1024 ** 3)).toFixed(2);
        console.log(`Download completed (${sizeGB} GB) → [temp file] ${ZIP_PATH}`);

        await unzipIfZip(ZIP_PATH, DEST_FOLDER)

        await cleanUp();

        console.log('All done!');
    } catch (err: any) {
        console.error('Error:', err?.message || err);
    }
}

const languageMap: Record<string, LanguageLabel> = {
    'ar': 'arabic',
    'bg': 'bulgarian',
    'de': 'german',
    'el': 'modern greek',
    'en': 'english',
    'es': 'spanish',
    'fr': 'french',
    'hi': 'hindi',
    'it': 'italian',
    'ja': 'japanese',
    'nl': 'dutch',
    'pl': 'polish',
    'pt': 'portuguese',
    'ru': 'russian',
    'sw': 'swahili',
    'th': 'thai',
    'tr': 'turkish',
    'ur': 'urdu',
    'vi': 'vietnamese',
    'zh': 'chinese',
}

export const loadLanguageDetectionModel = async (): Promise<void> => {
    if (!existsSync(MODEL_PATH)) {
        await downloadLanguageDetectionModel();
    }

    if (!languageDetectionModel) {
        const { pipeline } = await import('@huggingface/transformers'); // lazy import for perf.
        //@ts-ignore complex return type.
        languageDetectionModel = await pipeline('text-classification', './local/models/xlm-roberta-base-language-detection-onnx', { dtype: 'fp32' });
    }
}

export const detectLanguage = async (text: string, returnFullLanguageLabel: boolean = false): Promise<LanguageLabel> => {
    if (!languageDetectionModel) {
        await loadLanguageDetectionModel();
    }

    const result = await languageDetectionModel!(text);
    return returnFullLanguageLabel ? (languageMap[result[0]['label'] as keyof typeof languageMap] || 'unknown') : result[0].label;
}