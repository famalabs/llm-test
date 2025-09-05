import * as readline from 'node:readline/promises';

const terminal = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

export const getUserInput = async (prompt: string) => {
    return await terminal.question(prompt)
}

export const parseCliArgs = (args: string[]) => {

    const result: { [key: string]: string | undefined } = {};

    for (const requiredArg of args) {
        result[requiredArg] = process.argv.find(arg => arg.startsWith('--' + requiredArg + '='))?.split('=')[1];
        if (!result[requiredArg]) {
            console.error(`Missing required CLI argument: --${requiredArg}`);
            process.exit(1);
        }
    }


    return result;
}