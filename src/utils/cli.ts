import * as readline from 'node:readline/promises';
let terminal: readline.Interface | null = null;

export const getUserInput = async (prompt: string) => {
  if (!terminal) {
    terminal = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }
  return await terminal.question(prompt)
}

