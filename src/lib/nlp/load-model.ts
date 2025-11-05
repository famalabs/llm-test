import os from 'os';
import fs, { existsSync } from 'fs';
import fetch, { Response } from 'node-fetch';
import path from 'path';
import unzipper from 'unzipper';
import { TqdmProgress } from 'node-console-progress-bar-tqdm';
import { pipeline, PipelineType } from '@huggingface/transformers';

const LOCAL_MODELS = [
    {
        name: 'xlm-roberta-base-language-detection-onnx',
        remoteUrl: `https://drive.google.com/uc?export=download&id=1_umuMSwHj57JefzsgUPW3tVqpnjqythf`,
        getZipPath: () => path.join(os.tmpdir(), 'xlm-roberta-base-language-detection-onnx.zip')
    }
]

const LOCAL_MODELS_FOLDER = path.join('local', 'models');

const cookieJar = new Map<string, string>();

const extractDownloadHref = (html: string, remoteUrl: string): string | null => {
    const m = html.match(/confirm=([0-9A-Za-z_]+)/);
    if (m) return `${remoteUrl}&confirm=${m[1]}`;
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

const getDownloadResponse = async (remoteUrl: string): Promise<Response> => {
    let res = await fetchWithCookies(remoteUrl);

    const isHtml = (res: Response) => (res.headers.get('content-type') || '').includes('text/html');
    const hasContentDisposition = (res: Response) => { const cd = res.headers.get('content-disposition') || ''; return /attachment/i.test(cd) || /filename=/i.test(cd); };

    const html = await res.text();
    if (/quota|too many users have viewed or downloaded this file/i.test(html)) {
        throw new Error('Quota exceeded su Google Drive: too many users have viewed or downloaded this file.');
    }
    const downloadUrl = extractDownloadHref(html, remoteUrl);
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

const cleanUp = async (zipPath: string) => {
    console.log('Cleaning up temporary files...');

    if (fs.existsSync(zipPath)) {
        fs.unlinkSync(zipPath);
        console.log(`Temporary file deleted: ${zipPath}`);
    }

    const macOsDsStore = path.join(LOCAL_MODELS_FOLDER, '__MACOSX');
    if (fs.existsSync(macOsDsStore)) {
        fs.rmSync(macOsDsStore, { recursive: true, force: true });
        console.log(`Removed macOS __MACOSX folder: ${macOsDsStore}`);
    }

    cookieJar.clear();
}

async function downloadLocalModel(localModel: typeof LOCAL_MODELS[0]) {
    try {
        console.log('Starting model download from Google Drive...');
        const res = await getDownloadResponse(localModel.remoteUrl);

        await saveResponseToFile(res, localModel.getZipPath());

        const sizeGB = (fs.statSync(localModel.getZipPath()).size / (1024 ** 3)).toFixed(2);
        console.log(`Download completed (${sizeGB} GB) → [temp file] ${localModel.getZipPath()}`);

        await unzipIfZip(localModel.getZipPath(), LOCAL_MODELS_FOLDER);

        await cleanUp(localModel.getZipPath());

        console.log('All done!');
    } catch (err: any) {
        console.error('Error:', err?.message || err);
    }
}

export const loadModel = async (task: PipelineType, modelName: string) => {

    const localModel = LOCAL_MODELS.find(el => modelName.includes(el.name));
    if (localModel) {
        const modelPath = path.join(LOCAL_MODELS_FOLDER, localModel.name);
        if (!existsSync(modelPath)) {
            await downloadLocalModel(localModel);
        }
    }

    return await pipeline(task, modelName, { dtype: 'fp32' });
}
