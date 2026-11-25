// All colors, symbols and layout. Everything here writes to stderr except
// the commit message itself, so `gcm | pbcopy` stays clean.

import * as chalk from 'chalk';

// chalk 4 does not honor NO_COLOR on its own
const colors = new chalk.Instance(process.env.NO_COLOR ? { level: 0 } : {});

export const theme = {
  accent: colors.hex('#a78bfa'),
  success: colors.green,
  error: colors.red,
  warn: colors.yellow,
  dim: colors.dim,
  bold: colors.bold,
  added: colors.green,
  removed: colors.red
};

export const symbols = {
  brand: '◆',
  success: '✓',
  error: '✗',
  warn: '!',
  bar: '│'
};

export function line(text: string = ''): void {
  process.stderr.write(`${text}\n`);
}

export function header(detail: string): void {
  line();
  line(` ${theme.accent(symbols.brand)} ${theme.bold('gcm')}  ${theme.dim(detail)}`);
  line();
}

export function success(text: string): void {
  line(` ${theme.success(symbols.success)} ${text}`);
}

export function warn(text: string): void {
  line(` ${theme.warn(symbols.warn)} ${text}`);
}

export function error(text: string, hint?: string): void {
  line(` ${theme.error(symbols.error)} ${text}`);
  if (hint) line(`   ${theme.dim(hint)}`);
}

export function changeStats(files: number, insertions: number, deletions: number, branch: string | null): void {
  const lines = insertions || deletions
    ? `  ${theme.added(`+${insertions}`)} ${theme.removed(`−${deletions}`)}`
    : '';
  const on = branch ? `  ${theme.dim('on')} ${theme.accent(branch)}` : '';
  success(`${files} ${files === 1 ? 'file' : 'files'}${lines}${on}`);
}

export function formatMessage(message: string): string {
  const [subject, ...body] = message.split('\n');
  return [theme.bold(subject), ...body]
    .map((text) => ` ${theme.accent(symbols.bar)} ${text}`.trimEnd())
    .join('\n');
}

// Framed on a terminal, raw when piped or redirected
export function commitMessage(message: string): void {
  if (process.stdout.isTTY) {
    process.stdout.write(`\n${formatMessage(message)}\n\n`);
  } else {
    process.stdout.write(`${message}\n`);
  }
}

export function actionMenu(): string {
  const key = (name: string, label: string) => `${theme.accent(`[${name}]`)} ${label}`;
  return ` ${key('enter', 'commit')}   ${key('e', 'edit')}   ${key('r', 'regenerate')}   ${key('q', 'quit')} `;
}
