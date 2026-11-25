// Commit message generation (AI + simple fallback)

import { APIError } from './errors';
import { retry, plural } from './utils';
import { getApiKey, getModel, getProvider } from './config';
import { getCachedMessage, cacheMessage } from './cache';
import { buildPromptFromTemplate } from './templates';
import CONSTANTS from './constants';
import Logger from './logger';
import { getProviderDefinition } from './providers';
import { generate } from './providers/generate';

export interface StatusSummary {
  branch: string | null;
  ahead: number;
  behind: number;
  staged: {
    added: number;
    modified: number;
    deleted: number;
    renamed: number;
    copied: number;
  };
  unstaged: {
    modified: number;
    deleted: number;
  };
  untracked: number;
  conflicts: number;
  samples: {
    added: string[];
    modified: string[];
    deleted: string[];
    renamed: string[];
    untracked: string[];
  };
}

export interface MessageOptions {
  stagedOnly?: boolean;
  commit?: boolean;
  simple?: boolean;
  verbose?: boolean;
  template?: string;
  model?: string;
  skipCache?: boolean;
}

// Parse git status porcelain v2 output
export function parseStatus(output: string, stagedOnly: boolean = false): StatusSummary {
  const lines = output.split(/\r?\n/).filter(Boolean);
  const summary: StatusSummary = {
    branch: null,
    ahead: 0,
    behind: 0,
    staged: { added: 0, modified: 0, deleted: 0, renamed: 0, copied: 0 },
    unstaged: { modified: 0, deleted: 0 },
    untracked: 0,
    conflicts: 0,
    samples: { added: [], modified: [], deleted: [], renamed: [], untracked: [] }
  };

  for (const line of lines) {
    if (line.startsWith('# ')) {
      if (line.startsWith('# branch.head ')) {
        summary.branch = line.slice('# branch.head '.length).trim();
      } else if (line.startsWith('# branch.ab ')) {
        const ab = line.slice('# branch.ab '.length).trim();
        const m = ab.match(/\+(-?\d+)\s+-(-?\d+)/);
        if (m) {
          summary.ahead = parseInt(m[1], 10) || 0;
          summary.behind = parseInt(m[2], 10) || 0;
        }
      }
      continue;
    }

    const type = line[0];
    if (type === '?') {
      summary.untracked += 1;
      const filePath = line.slice(2);
      if (summary.samples.untracked.length < CONSTANTS.MAX_FILE_SAMPLES) {
        summary.samples.untracked.push(filePath);
      }
      continue;
    }
    if (type === '!') continue; // ignored files
    if (type === 'u') {
      summary.conflicts += 1;
      continue;
    }
    if (type === '1' || type === '2') {
      const parts = line.split(/\s+/);
      if (parts.length < 2) continue;
      
      const xy = parts[1];
      if (!xy || xy.length < 2) continue;
      
      const indexStatus = xy[0];
      const worktreeStatus = xy[1];
      
      let filePath = parts[parts.length - 1];
      let origPath: string | null = null;
      if (type === '2') {
        // Rename/copy lines end with "<score> <path>\t<origPath>"
        const [entry, orig] = line.split('\t');
        filePath = entry.split(' ').slice(9).join(' ');
        origPath = orig || null;
      }

      // Staged changes
      if (indexStatus === 'A') {
        summary.staged.added += 1;
        if (summary.samples.added.length < CONSTANTS.MAX_FILE_SAMPLES) {
          summary.samples.added.push(filePath);
        }
      } else if (indexStatus === 'M') {
        summary.staged.modified += 1;
        if (summary.samples.modified.length < CONSTANTS.MAX_FILE_SAMPLES) {
          summary.samples.modified.push(filePath);
        }
      } else if (indexStatus === 'D') {
        summary.staged.deleted += 1;
        if (summary.samples.deleted.length < CONSTANTS.MAX_FILE_SAMPLES) {
          summary.samples.deleted.push(filePath);
        }
      } else if (indexStatus === 'R') {
        summary.staged.renamed += 1;
        if (summary.samples.renamed.length < CONSTANTS.MAX_FILE_SAMPLES) {
          summary.samples.renamed.push(origPath ? `${origPath} -> ${filePath}` : filePath);
        }
      } else if (indexStatus === 'C') {
        summary.staged.copied += 1;
        if (summary.samples.renamed.length < CONSTANTS.MAX_FILE_SAMPLES) {
          summary.samples.renamed.push(origPath ? `${origPath} -> ${filePath}` : filePath);
        }
      }

      // Unstaged changes
      if (worktreeStatus === 'M') {
        summary.unstaged.modified += 1;
        if (!stagedOnly && summary.samples.modified.length < CONSTANTS.MAX_FILE_SAMPLES) {
          summary.samples.modified.push(filePath);
        }
      } else if (worktreeStatus === 'D') {
        summary.unstaged.deleted += 1;
        if (!stagedOnly && summary.samples.deleted.length < CONSTANTS.MAX_FILE_SAMPLES) {
          summary.samples.deleted.push(filePath);
        }
      }
    }
  }
  return summary;
}

// Get list of files that changed
export function getChangedFiles(summary: StatusSummary, stagedOnly: boolean): string[] {
  const files = new Set<string>();
  
  if (stagedOnly) {
    summary.samples.added.forEach(f => files.add(f));
    summary.samples.modified.forEach(f => files.add(f));
    summary.samples.deleted.forEach(f => files.add(f));
    summary.samples.renamed.forEach(f => {
      const match = f.match(/^(.+?)\s*->\s*(.+)$/);
      if (match) {
        files.add(match[1]);
        files.add(match[2]);
      } else {
        files.add(f);
      }
    });
  } else {
    [...summary.samples.added, ...summary.samples.modified, 
     ...summary.samples.deleted, ...summary.samples.untracked].forEach(f => files.add(f));
    summary.samples.renamed.forEach(f => {
      const match = f.match(/^(.+?)\s*->\s*(.+)$/);
      if (match) {
        files.add(match[1]);
        files.add(match[2]);
      } else {
        files.add(f);
      }
    });
  }
  
  return Array.from(files);
}

// Build simple commit message (no AI)
export function buildSimpleMessage(summary: StatusSummary, opts: MessageOptions): string {
  const parts: string[] = [];
  const scope = summary.branch ? `on ${summary.branch}` : '';

  const addPart = (n: number, label: string) => { if (n > 0) parts.push(`${plural(n, label)}`); };

  const includeStaged = opts.stagedOnly || (
    summary.staged.added + summary.staged.modified + summary.staged.deleted + 
    summary.staged.renamed + summary.staged.copied > 0
  );

  if (includeStaged) {
    addPart(summary.staged.added, 'added');
    addPart(summary.staged.modified, 'modified');
    addPart(summary.staged.deleted, 'deleted');
    addPart(summary.staged.renamed + summary.staged.copied, 'renamed');
  }
  if (!opts.stagedOnly) {
    addPart(summary.unstaged.modified, 'modified (unstaged)');
    addPart(summary.unstaged.deleted, 'deleted (unstaged)');
    addPart(summary.untracked, 'untracked');
    addPart(summary.conflicts, 'conflict');
  }

  const titleCore = parts.length ? parts.join(', ') : 'no changes';
  const ab = (summary.ahead || summary.behind) ? `, ahead ${summary.ahead}, behind ${summary.behind}` : '';
  const title = `${titleCore}${scope ? ` — ${scope}` : ''}${ab}`;

  const limitList = (list: string[]) => list.length > CONSTANTS.MAX_FILE_SAMPLES 
    ? { list: list.slice(0, CONSTANTS.MAX_FILE_SAMPLES), more: list.length - CONSTANTS.MAX_FILE_SAMPLES } 
    : { list, more: 0 };
  
  const addedL = limitList(summary.samples.added);
  const modL = limitList(summary.samples.modified);
  const delL = limitList(summary.samples.deleted);
  const renL = limitList(summary.samples.renamed);
  const untrackedL = limitList(summary.samples.untracked);

  const bodyParts: string[] = [];
  if (addedL.list.length) bodyParts.push(`added: ${addedL.list.join(', ')}${addedL.more ? ` (+${addedL.more} more)` : ''}`);
  if (modL.list.length) bodyParts.push(`modified: ${modL.list.join(', ')}${modL.more ? ` (+${modL.more} more)` : ''}`);
  if (delL.list.length) bodyParts.push(`deleted: ${delL.list.join(', ')}${delL.more ? ` (+${delL.more} more)` : ''}`);
  if (renL.list.length) bodyParts.push(`renamed: ${renL.list.join(', ')}${renL.more ? ` (+${renL.more} more)` : ''}`);
  if (!opts.stagedOnly && untrackedL.list.length) bodyParts.push(`untracked: ${untrackedL.list.join(', ')}${untrackedL.more ? ` (+${untrackedL.more} more)` : ''}`);

  return bodyParts.length ? `${title}\n\n${bodyParts.join('\n')}` : title;
}

function stripMarkdownCodeBlocks(message: string): string {
  return message.replace(/^```[\w]*\n?/gm, '').replace(/\n?```$/gm, '').trim();
}

type ErrorWithStatus = Error & { status?: number };

function isModelUnavailableError(error: ErrorWithStatus): boolean {
  return error.status === 404 ||
    /model_not_found|model_decommissioned|decommissioned|model .*(not found|does not exist|not supported)/i.test(error.message);
}

// Only rate limits, server errors and network failures are worth retrying
export function isRetryableError(error: ErrorWithStatus): boolean {
  if (typeof error.status === 'number') {
    return error.status === 408 || error.status === 429 || error.status >= 500;
  }
  return /timed out|timeout|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|socket|network|connection error|empty/i.test(error.message);
}

// The model that will be tried first
export function resolveModel(opts: MessageOptions = {}): string {
  const provider = getProvider();
  return opts.model || getModel(getProviderDefinition(provider).defaultModels[0], provider);
}

// Generate commit message using the configured AI provider
export async function generateWithAI(
  summary: StatusSummary,
  diff: string,
  files: string[],
  opts: MessageOptions,
  logger?: Logger
): Promise<string> {
  const provider = getProvider();
  const definition = getProviderDefinition(provider);
  const apiKey = getApiKey(provider);
  if (!apiKey) {
    throw new APIError(`${definition.name} API key not configured. Run "gcm config set" to set your API key.`, 'NO_API_KEY');
  }

  const requestedModel = resolveModel(opts);
  const prompt = buildPromptFromTemplate(summary, diff, files, opts, opts.template || 'default');
  const cacheKey = `${provider}:${requestedModel}:${prompt}`;

  const cached = opts.skipCache ? null : getCachedMessage(cacheKey);
  if (cached) {
    logger?.debug('Using cached commit message');
    return cached;
  }

  // A model passed on the command line is never silently swapped for another
  const models = opts.model ? [opts.model] : [...new Set([requestedModel, ...definition.defaultModels])];
  let lastError: Error | null = null;

  for (const model of models) {
    try {
      const message = await retry(async () => {
        const text = stripMarkdownCodeBlocks(await generate({ provider, model, apiKey, prompt }));
        if (!text) {
          throw new APIError('Generated message is empty', 'EMPTY_RESPONSE');
        }
        return text;
      }, CONSTANTS.API_RETRY_ATTEMPTS, CONSTANTS.API_RETRY_DELAY, isRetryableError);

      if (model !== requestedModel) {
        logger?.warn(`Model ${requestedModel} is unavailable; used ${model}.`);
      }
      cacheMessage(cacheKey, message);
      return message;
    } catch (error) {
      const err = error as ErrorWithStatus;

      if (isModelUnavailableError(err)) {
        logger?.debug(`Model ${model} unavailable, trying next...`);
        lastError = err;
        continue;
      }
      if (err.status === 401 || err.status === 403) {
        throw new APIError(`Invalid ${definition.name} API key. Get one at ${definition.apiKeyUrl}`, 'INVALID_API_KEY');
      }
      if (err.status === 429) {
        throw new APIError(`${definition.name} rate limit or quota reached. Try again later or use --simple.`, 'QUOTA_EXCEEDED');
      }
      throw error;
    }
  }

  throw new APIError(
    `No available ${definition.name} model. Tried: ${models.join(', ')}. ${lastError?.message || ''} Set one with --model or ${definition.modelEnvVar}.`,
    'MODEL_NOT_FOUND'
  );
}
