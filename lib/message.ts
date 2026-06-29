// Commit message generation (AI + simple fallback)

import { GoogleGenerativeAI } from '@google/generative-ai';
import * as https from 'https';
import { APIError } from './errors';
import { retry, plural } from './utils';
import { getApiKey, getModel, getProvider } from './config';
import { getCachedMessage, cacheMessage } from './cache';
import { buildPromptFromTemplate } from './templates';
import CONSTANTS from './constants';
import Logger from './logger';
import { ProviderId, getProviderDefinition } from './providers';

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
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
    text?: string;
  }>;
}

// Parse git status porcelain v2 output
export function parseStatus(output: string): StatusSummary {
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
        const m = ab.match(/\+(-?\d+)\s+\-(-?\d+)/);
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
      if (type === '2' && parts.length >= 3) {
        origPath = parts[parts.length - 2];
        filePath = parts[parts.length - 1];
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
        if (summary.samples.modified.length < CONSTANTS.MAX_FILE_SAMPLES) {
          summary.samples.modified.push(filePath);
        }
      } else if (worktreeStatus === 'D') {
        summary.unstaged.deleted += 1;
        if (summary.samples.deleted.length < CONSTANTS.MAX_FILE_SAMPLES) {
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

function isModelUnavailableError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return message.includes('404') ||
    message.includes('not found') ||
    message.includes('not supported') ||
    message.includes('model_not_found') ||
    message.includes('does not exist');
}

function isAuthError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return message.includes('401') ||
    message.includes('403') ||
    message.includes('api_key') ||
    message.includes('api key') ||
    message.includes('unauthorized') ||
    message.includes('forbidden') ||
    message.includes('invalid x-api-key');
}

function isQuotaError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return message.includes('429') ||
    message.includes('quota') ||
    message.includes('rate limit') ||
    message.includes('rate_limit');
}

function postJson<T>(url: string, body: unknown, headers: Record<string, string>): Promise<T> {
  return new Promise((resolve, reject) => {
    const requestBody = JSON.stringify(body);
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody).toString(),
        ...headers
      }
    }, (res) => {
      let responseBody = '';

      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        responseBody += chunk;
      });
      res.on('end', () => {
        const statusCode = res.statusCode || 0;

        if (statusCode < 200 || statusCode >= 300) {
          reject(new Error(`${statusCode} ${res.statusMessage || 'API error'}: ${responseBody}`));
          return;
        }

        try {
          resolve(JSON.parse(responseBody) as T);
        } catch (error) {
          reject(new Error(`Invalid JSON response: ${(error as Error).message}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy(new Error('API request timed out'));
    });
    req.write(requestBody);
    req.end();
  });
}

async function generateWithGeminiModel(apiKey: string, model: string, prompt: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const geminiModel = genAI.getGenerativeModel({ model: model });

  const result = await geminiModel.generateContent(prompt);
  const response = await result.response;
  return response.text().trim();
}

function extractChatCompletionMessage(response: ChatCompletionResponse): string {
  const choice = response.choices?.[0];
  const content = choice?.message?.content;

  if (typeof content === 'string') {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => part.text || '')
      .join('')
      .trim();
  }

  if (typeof choice?.text === 'string') {
    return choice.text.trim();
  }

  return '';
}

async function generateWithOpenAICompatibleProvider(
  provider: ProviderId,
  apiKey: string,
  model: string,
  prompt: string
): Promise<string> {
  const providerConfig = getProviderDefinition(provider);
  if (!providerConfig.baseUrl) {
    throw new APIError(`${providerConfig.name} does not support OpenAI-compatible chat completions.`, 'UNSUPPORTED_PROVIDER');
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`
  };

  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://github.com/solomonmarvel97/gitcommitmessage';
    headers['X-Title'] = 'gitcommitmessage';
  }

  const response = await postJson<ChatCompletionResponse>(
    `${providerConfig.baseUrl}/chat/completions`,
    {
      model,
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 400
    },
    headers
  );

  return extractChatCompletionMessage(response);
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
  const providerConfig = getProviderDefinition(provider);
  const apiKey = getApiKey(provider);
  if (!apiKey) {
    throw new APIError(`${providerConfig.name} API key not configured. Run "gcm config set" to set your API key.`, 'NO_API_KEY');
  }
  
  // Check cache first
  const cacheKey = `${provider}:${diff || JSON.stringify(files)}`;
  const cachedMessage = getCachedMessage(cacheKey);
  if (cachedMessage) {
    if (logger) {
      logger.debug('Using cached commit message');
    }
    return cachedMessage;
  }
  
  const defaultModel = getModel(providerConfig.defaultModels[0], provider);
  const requestedModel = defaultModel;
  const modelsToTry = requestedModel ? [requestedModel, ...providerConfig.defaultModels] : providerConfig.defaultModels;
  const uniqueModels = [...new Set(modelsToTry)];
  const templateName = opts.template || 'default';
  const prompt = buildPromptFromTemplate(summary, diff, files, opts, templateName);

  let lastError: Error | null = null;
  
  const generateFn = async (): Promise<string> => {
    for (const model of uniqueModels) {
      try {
        return await retry(async () => {
          let message = provider === 'gemini'
            ? await generateWithGeminiModel(apiKey, model, prompt)
            : await generateWithOpenAICompatibleProvider(provider, apiKey, model, prompt);

          // Strip markdown code blocks if present
          message = stripMarkdownCodeBlocks(message);

          if (!message) {
            throw new APIError('Generated message is empty', 'EMPTY_RESPONSE');
          }

          // Save to cache
          cacheMessage(cacheKey, message);

          return message;
        }, CONSTANTS.API_RETRY_ATTEMPTS);
      } catch (error) {
        const err = error as Error;
        // Model not found? Try the next one
        if (isModelUnavailableError(err)) {
          if (logger) {
            logger.debug(`Model ${model} unavailable, trying next...`);
          }
          lastError = err;
          continue;
        }
        
        // Other errors - bail out
        if (isAuthError(err) || (err as any).code === 'NO_API_KEY') {
          throw new APIError(`Invalid or missing ${providerConfig.name} API key. Get your API key from ${providerConfig.apiKeyUrl}`, 'INVALID_API_KEY');
        }
        if (isQuotaError(err)) {
          throw new APIError(`${providerConfig.name} API quota exceeded or rate limited. Please try again later or use --simple flag.`, 'QUOTA_EXCEEDED');
        }
        throw error;
      }
    }
    
    // All models failed
    if (lastError) {
      throw new APIError(
        `No available ${providerConfig.name} model found. Tried: ${uniqueModels.join(', ')}. Error: ${lastError.message}. You can set a specific model via ${providerConfig.modelEnvVar} or GCM_MODEL environment variable, or in config.`,
        'MODEL_NOT_FOUND'
      );
    }
    
    throw new APIError('Failed to generate message with any available model.', 'GENERATION_FAILED');
  };

  // Always use progress indicator (the caller can control visibility)
  return await generateFn();
}

export const generateWithGemini = generateWithAI;
