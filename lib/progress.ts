// Progress indicators (spinners and progress bars)
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
    process.stdout.write('\x1B[?25l'); // hide cursor
    this.interval = setInterval(() => {
      process.stdout.write(`\r${this.chars[this.index]} ${this.message}`);
      this.index = (this.index + 1) % this.chars.length;
    }, 100);
  }

  stop(message: string = ''): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    process.stdout.write('\r' + ' '.repeat(process.stdout.columns || 80) + '\r');
    process.stdout.write('\x1B[?25h'); // show cursor
    if (message) {
      console.log(message);
    }
  }

  update(message: string): void {
    this.message = message;
  }
}

// Progress bar for operations with a known total
export class ProgressBar {
  private total: number;
  private current: number;
  private message: string;
  private width: number;

  constructor(total: number, message: string = 'Progress') {
    this.total = total;
    this.current = 0;
    this.message = message;
    this.width = 40;
  }

  update(current: number, message?: string): void {
    this.current = current;
    if (message) {
      this.message = message;
    }
    this.render();
  }

  increment(message?: string): void {
    this.current++;
    if (message) {
      this.message = message;
    }
    this.render();
  }

  private render(): void {
    const percentage = Math.min(100, Math.round((this.current / this.total) * 100));
    const filled = Math.round((this.current / this.total) * this.width);
    const empty = this.width - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    process.stdout.write(`\r${this.message}: [${bar}] ${percentage}% (${this.current}/${this.total})`);
  }

  complete(message: string = 'Complete'): void {
    this.current = this.total;
    this.render();
    console.log(`\n${message}`);
  }
}

// Create a new spinner
export function createSpinner(message: string): Spinner {
  return new Spinner(message);
}

// Create a new progress bar
export function createProgressBar(total: number, message: string): ProgressBar {
  return new ProgressBar(total, message);
}

// Run async function with a spinner
export async function withProgress<T>(message: string, fn: () => Promise<T>): Promise<T> {
  const spinner = createSpinner(message);
  spinner.start();
  try {
    const result = await fn();
    spinner.stop(`✓ ${message}`);
    return result;
  } catch (error) {
    spinner.stop(`✗ ${message} failed`);
    throw error;
  }
}
