import * as readline from 'node:readline/promises';

const terminal = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

export const getUserInput = async (prompt: string) => {
    return await terminal.question(prompt)
}