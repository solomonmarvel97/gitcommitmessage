// Commit message templates

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import CONSTANTS from './constants';
import { StatusSummary, MessageOptions } from './message';

const TEMPLATES_DIR = path.join(os.homedir(), CONSTANTS.CONFIG_DIR_NAME, 'templates');

// Default prompt template for AI
export const DEFAULT_TEMPLATE = `You are an expert developer writing git commit messages. Generate a clear, concise commit message based on the following git changes.

Branch: {{branch}}
Changes: {{changes}}
{{#if branchStatus}}Branch status: {{branchStatus}}
{{/if}}Files changed:
{{files}}

{{#if diff}}
Git diff:
{{diff}}
{{else}}
No diff available (likely new/untracked files)
{{/if}}

Requirements:
- Use Conventional Commits format (e.g., "feat:", "fix:", "refactor:", "docs:", "style:", "test:", "chore:")
- Subject line should be ≤ {{maxSubjectLength}} characters
- Use present tense, imperative mood (e.g., "Add feature" not "Added feature")
- Be specific about what changed and why (if clear from diff)
- If there's a body, wrap at {{maxBodyLength}} characters
- Focus on the "what" and "why", not just "how"

Generate ONLY the commit message (title and optional body). Do not include any explanations or markdown formatting.`;

interface TemplateData {
  branch: string;
  changes: string;
  branchStatus?: string | null;
  files: string;
  diff?: string | null;
  maxSubjectLength: number;
  maxBodyLength: number;
}

// Simple template renderer - handles {{var}} and {{#if}} blocks
function renderTemplate(template: string, data: TemplateData): string {
  let result = template;

  // Replace {{var}} with values
  result = result.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = (data as any)[key];
    return value !== undefined ? String(value) : match;
  });

  // Handle {{#if var}}...{{/if}} conditionals
  result = result.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, key, content) => {
    return (data as any)[key] ? content : '';
  });

  return result;
}

// Load template by name, fallback to default
export function getTemplate(templateName: string = 'default'): string {
  if (templateName === 'default') {
    return DEFAULT_TEMPLATE;
  }

  const templatePath = path.join(TEMPLATES_DIR, `${templateName}.txt`);
  if (fs.existsSync(templatePath)) {
    return fs.readFileSync(templatePath, 'utf8');
  }

  return DEFAULT_TEMPLATE;
}

// Get list of available template names
export function listTemplates(): string[] {
  const templates = ['default'];

  if (!fs.existsSync(TEMPLATES_DIR)) {
    return templates;
  }

  try {
    const files = fs.readdirSync(TEMPLATES_DIR);
    for (const file of files) {
      if (file.endsWith('.txt')) {
        templates.push(file.replace('.txt', ''));
      }
    }
  } catch (error) {
    // Can't read templates dir? Just return default
  }

  return templates;
}

// Save a custom template to disk
export function saveTemplate(name: string, content: string): void {
  if (!fs.existsSync(TEMPLATES_DIR)) {
    fs.mkdirSync(TEMPLATES_DIR, { recursive: true, mode: 0o700 });
  }

  const templatePath = path.join(TEMPLATES_DIR, `${name}.txt`);
  fs.writeFileSync(templatePath, content, { mode: 0o600 });
}

// Delete a template (can't delete default)
export function deleteTemplate(name: string): boolean {
  if (name === 'default') {
    return false;
  }

  const templatePath = path.join(TEMPLATES_DIR, `${name}.txt`);
  if (fs.existsSync(templatePath)) {
    fs.unlinkSync(templatePath);
    return true;
  }

  return false;
}

// Render template with git status data to create AI prompt
export function buildPromptFromTemplate(
  summary: StatusSummary,
  diff: string,
  files: string[],
  opts: MessageOptions,
  templateName: string = 'default'
): string {
  const template = getTemplate(templateName);

  const changeSummary: string[] = [];
  if (summary.staged.added > 0) changeSummary.push(`${summary.staged.added} file(s) added`);
  if (summary.staged.modified > 0) changeSummary.push(`${summary.staged.modified} file(s) modified`);
  if (summary.staged.deleted > 0) changeSummary.push(`${summary.staged.deleted} file(s) deleted`);
  if (summary.staged.renamed > 0) changeSummary.push(`${summary.staged.renamed} file(s) renamed`);
  if (!opts.stagedOnly) {
    if (summary.unstaged.modified > 0) changeSummary.push(`${summary.unstaged.modified} file(s) modified (unstaged)`);
    if (summary.untracked > 0) changeSummary.push(`${summary.untracked} untracked file(s)`);
  }

  const branchStatus = (summary.ahead > 0 || summary.behind > 0)
    ? `${summary.ahead} ahead, ${summary.behind} behind remote`
    : null;

  const filesList = files.slice(0, CONSTANTS.MAX_FILE_LIST_DISPLAY)
    .map(f => `- ${f}`)
    .join('\n') +
    (files.length > CONSTANTS.MAX_FILE_LIST_DISPLAY
      ? `\n... and ${files.length - CONSTANTS.MAX_FILE_LIST_DISPLAY} more file(s)`
      : '');

  const data: TemplateData = {
    branch: summary.branch || 'unknown',
    changes: changeSummary.join(', '),
    branchStatus: branchStatus,
    files: filesList,
    diff: diff || null,
    maxSubjectLength: CONSTANTS.MAX_SUBJECT_LENGTH,
    maxBodyLength: CONSTANTS.MAX_BODY_LINE_LENGTH,
  };

  return renderTemplate(template, data);
}
