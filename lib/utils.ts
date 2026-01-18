// Utility functions
import { spawnSync, SpawnSyncOptions } from 'child_process';
import { GitError } from './errors';
import CONSTANTS from './constants';

export interface GitResult {
  stdout: string;
  stderr: string;
}

// Run a git command and handle errors
export function runGit(args: string[], options: SpawnSyncOptions = {}): GitResult {
  const res = spawnSync('git', args, {
    encoding: 'utf8',
    maxBuffer: CONSTANTS.GIT_BUFFER_SIZE,
    ...options
  });

  if (res.error) {
    throw new GitError(`Git command failed: ${res.error.message}`, res.error);
  }

  if (res.status !== 0) {
    const stdout = typeof res.stdout === 'string' ? res.stdout : '';
    const stderr = typeof res.stderr === 'string' ? res.stderr : '';
    const errorMsg = (stderr || stdout || `git ${args.join(' ')} failed`).trim();
    throw new GitError(errorMsg);
  }

  return {
    stdout: typeof res.stdout === 'string' ? res.stdout : '',
    stderr: typeof res.stderr === 'string' ? res.stderr : '',
  };
}

// Check if we're in a git repo
export function isInsideRepo(): boolean {
  try {
    const result = runGit(['rev-parse', '--is-inside-work-tree']);
    return result.stdout.trim() === 'true';
  } catch (error) {
    return false;
  }
}

// Retry with exponential backoff
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = CONSTANTS.API_RETRY_ATTEMPTS,
  delay: number = CONSTANTS.API_RETRY_DELAY
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const err = error as Error;
      
      // Don't retry validation/config errors
      if (err instanceof Error && ('code' in err) && 
          (err.code === 'VALIDATION_ERROR' || err.code === 'CONFIG_ERROR')) {
        throw error;
      }
      
      if (attempt < maxAttempts) {
        const waitTime = delay * Math.pow(CONSTANTS.API_RETRY_BACKOFF, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      lastError = err;
    }
  }
  
  throw lastError || new Error('Retry failed');
}

// Basic API key validation
export function validateApiKey(apiKey: unknown): boolean {
  if (!apiKey || typeof apiKey !== 'string') {
    return false;
  }
  
  const trimmed = apiKey.trim();
  // Just check for reasonable length (Gemini keys are usually ~39 chars)
  return trimmed.length >= 20 && trimmed.length <= 200;
}

// Mask sensitive strings (show first/last few chars)
export function maskString(str: string | null | undefined, start: number = 8, end: number = 4): string {
  if (!str || str.length <= start + end) {
    return '***';
  }
  return str.substring(0, start) + '...' + str.substring(str.length - end);
}

// Simple pluralization
export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

// Truncate string with suffix
export function truncate(str: string, maxLength: number, suffix: string = '...'): string {
  if (!str || str.length <= maxLength) {
    return str;
  }
  return str.substring(0, maxLength - suffix.length) + suffix;
}
