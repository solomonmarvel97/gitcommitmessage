// Spinner for slow operations
import { theme, symbols } from './ui';

export class Spinner {
  private message: string;
  private interval: NodeJS.Timeout | null;
  private chars: string[];
  private index: number;

  constructor(message: string = 'Processing...') {
    this.message = message;
    this.interval = null;
    this.chars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    this.index = 0;
  }

  start(): void {
    // No animation when stderr is a pipe or file
    if (!process.stderr.isTTY) return;
    process.stderr.write('\x1B[?25l'); // hide cursor
    this.interval = setInterval(() => {
      process.stderr.write(`\r ${theme.accent(this.chars[this.index])} ${this.message}`);
      this.index = (this.index + 1) % this.chars.length;
    }, 80);
  }

  stop(message: string = ''): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      process.stderr.write('\r\x1B[2K\x1B[?25h'); // clear line, show cursor
    }
    if (message) {
      process.stderr.write(`${message}\n`);
    }
  }

  update(message: string): void {
    this.message = message;
  }
}

// Create a new spinner
export function createSpinner(message: string): Spinner {
  return new Spinner(message);
}

// Run async function with a spinner. The caller reports success.
export async function withProgress<T>(message: string, fn: () => Promise<T>): Promise<T> {
  const spinner = createSpinner(message);
  spinner.start();
  try {
    const result = await fn();
    spinner.stop();
    return result;
  } catch (error) {
    spinner.stop(` ${theme.error(symbols.error)} ${message} failed`);
    throw error;
  }
}
