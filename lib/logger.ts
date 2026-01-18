// Simple logger with log levels
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
} as const;

type LogLevel = keyof typeof LOG_LEVELS;

export class Logger {
  private level: number;
  private verbose: boolean;

  constructor(level: LogLevel | string = 'INFO', verbose: boolean = false) {
    this.level = LOG_LEVELS[level.toUpperCase() as LogLevel] || LOG_LEVELS.INFO;
    this.verbose = verbose;
  }

  error(...args: unknown[]): void {
    if (this.level >= LOG_LEVELS.ERROR) {
      console.error('ERROR:', ...args);
    }
  }

  warn(...args: unknown[]): void {
    if (this.level >= LOG_LEVELS.WARN) {
      console.error('WARN:', ...args);
    }
  }

  info(...args: unknown[]): void {
    if (this.level >= LOG_LEVELS.INFO) {
      console.error(...args);
    }
  }

  debug(...args: unknown[]): void {
    if (this.level >= LOG_LEVELS.DEBUG || this.verbose) {
      console.error('DEBUG:', ...args);
    }
  }
}

export default Logger;
