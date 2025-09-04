import { unlink, readdir, stat } from "fs/promises";
import { join } from "path";

const getAllFiles = async (dir: string): Promise<string[]> => {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = await Promise.all(entries.map(async entry => {
        const res = join(dir, entry.name);
        if (entry.isDirectory()) {
            return await getAllFiles(res);
        } else {
            return res;
        }
    }));
    return files.flat();
};

const main = async () => {
    const sessionsDir = 'output/sessions';
    const files = await getAllFiles(sessionsDir);
    if (files.length === 0) {
        console.log('No session files found.');
        return;
    }
    // Sort by file name (lexicographically)
    const latestFile = files.sort().pop();
    if (latestFile) {
        await unlink(latestFile);
        console.log(`Deleted latest session file: ${latestFile}`);
    }
};

main().catch(console.error).then(_ => process.exit());