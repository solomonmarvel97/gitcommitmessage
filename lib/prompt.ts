// Interactive input: questions, hidden input, single keys, external editor

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as readline from 'readline';
import { spawnSync } from 'child_process';
import { runGit } from './utils';

export type Action = 'commit' | 'edit' | 'regenerate' | 'quit';

let pipedLines: string[] | null = null;

// Piped input is read once, because readline drops lines between questions
function nextPipedLine(): string | null {
  if (pipedLines === null) {
    const input = fs.readFileSync(0, 'utf8');
    pipedLines = input === '' ? [] : input.replace(/\n$/, '').split('\n');
  }
  return pipedLines.length ? (pipedLines.shift() as string) : null;
}

export function ask(question: string, options: { hidden?: boolean } = {}): Promise<string> {
  process.stderr.write(question);
  if (!process.stdin.isTTY) {
    const answer = nextPipedLine();
    process.stderr.write('\n');
    return Promise.resolve((answer || '').trim());
  }

  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stderr, terminal: true });
    if (options.hidden) {
      // The question is already printed; swallow readline's echo
      (rl as any)._writeToOutput = () => {};
    }
    let answered = false;
    rl.on('close', () => {
      if (!answered) reject(new Error('Cancelled'));
    });
    rl.question('', (answer) => {
      answered = true;
      rl.close();
      if (options.hidden) process.stderr.write('\n');
      resolve(answer.trim());
    });
  });
}

export function toAction(input: string): Action | null {
  switch (input.toLowerCase()) {
    case '':
    case '\r':
    case '\n':
      return 'commit';
    case 'e':
      return 'edit';
    case 'r':
      return 'regenerate';
    case 'q':
    case '\u0003': // Ctrl+C
    case '\u0004': // Ctrl+D
    case '\u001b': // Esc
      return 'quit';
    default:
      return null;
  }
}

export function askAction(menu: string): Promise<Action> {
  process.stderr.write(menu);

  if (!process.stdin.isTTY) {
    const answer = nextPipedLine();
    process.stderr.write('\n');
    // End of input is not a confirmation
    return Promise.resolve(answer === null ? 'quit' : toAction(answer.trim()) || 'quit');
  }

  return new Promise((resolve) => {
    const onData = (data: Buffer) => {
      const action = toAction(data.toString());
      if (!action) return;
      process.stdin.removeListener('data', onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stderr.write('\n');
      resolve(action);
    };
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', onData);
  });
}

// Open the message in git's configured editor
export function editMessage(message: string): string {
  const editor = runGit(['var', 'GIT_EDITOR']).stdout.trim();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gcm-'));
  const file = path.join(dir, 'COMMIT_EDITMSG');

  try {
    fs.writeFileSync(file, `${message}\n`, { mode: 0o600 });
    const result = spawnSync('sh', ['-c', `${editor} "$@"`, editor, file], { stdio: 'inherit' });
    if (result.status !== 0) {
      throw new Error('Editor exited with an error');
    }
    return fs.readFileSync(file, 'utf8').trim();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
