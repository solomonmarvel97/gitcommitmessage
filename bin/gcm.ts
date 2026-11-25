#!/usr/bin/env node
import { Command } from 'commander';
import Logger from '../lib/logger';
import { hasApiKey, saveConfig, clearConfig, displayConfig, loadStore, getProvider } from '../lib/config';
import { isInsideRepo, getStatus, getDiff, getDiffStats, stageAll, commit } from '../lib/git';
import { parseStatus, getChangedFiles, buildSimpleMessage, generateWithAI, resolveModel, MessageOptions, StatusSummary } from '../lib/message';
import { GitError, ConfigError } from '../lib/errors';
import { validateApiKey, maskString } from '../lib/utils';
import { withProgress } from '../lib/progress';
import { DEFAULT_PROVIDER, ProviderId, getProviderDefinition, getProviderIds, normalizeProvider } from '../lib/providers';
import { ask, askAction, editMessage } from '../lib/prompt';
import * as ui from '../lib/ui';
import * as packageJson from '../package.json';

const program = new Command();

program
  .name('gcm')
  .description('Generate intelligent commit messages from git status using AI')
  .version(packageJson.version);

// Accept a list number or a name; blank means the default
function pick(input: string, choices: readonly string[], fallback: string): string {
  if (!input) return fallback;
  const index = Number(input);
  return Number.isInteger(index) && index >= 1 && index <= choices.length ? choices[index - 1] : input;
}

function printChoices(choices: readonly string[], labels: readonly string[], current: string): void {
  choices.forEach((choice, index) => {
    const marker = choice === current ? ui.theme.dim(' (default)') : '';
    ui.line(`   ${ui.theme.accent(String(index + 1))}  ${labels[index]}${marker}`);
  });
  ui.line();
}

function fail(message: string, hint?: string): never {
  ui.error(message, hint);
  process.exit(1);
}

// Config subcommands
const configCmd = program
  .command('config')
  .description('Configuration management');

configCmd
  .command('show')
  .alias('status')
  .description('Show current configuration')
  .action(() => {
    const config = displayConfig();
    if (!config.hasConfig) {
      fail('No configuration found.', 'Run: gcm config set');
    }
    ui.header('configuration');
    for (const entry of config.entries) {
      const marker = entry.active ? ui.theme.success('●') : ui.theme.dim('○');
      ui.line(` ${marker} ${ui.theme.bold(entry.name)} ${ui.theme.dim(`[${entry.id}]`)}`);
      ui.line(`     key    ${entry.apiKey}`);
      ui.line(`     model  ${entry.model}`);
    }
    ui.line();
  });

configCmd
  .command('set')
  .description('Set or update your AI provider, API key, and model')
  .action(async () => {
    try {
      const ids = getProviderIds();
      const current = loadStore()?.provider || DEFAULT_PROVIDER;

      ui.header('setup');
      printChoices(ids, ids.map((id) => `${getProviderDefinition(id).name} ${ui.theme.dim(`[${id}]`)}`), current);

      const provider = normalizeProvider(pick(await ask(` Provider (${current}): `), ids, current));
      if (!provider) fail('Invalid provider.', `Choose one of: ${ids.join(', ')}`);

      const definition = getProviderDefinition(provider);
      const saved = loadStore()?.providers[provider];

      ui.line();
      ui.line(` Get a key at ${ui.theme.accent(definition.apiKeyUrl)}`);
      const keep = saved ? ' (enter keeps the saved key)' : '';
      const apiKey = (await ask(` API key${keep}: `, { hidden: true })) || saved?.apiKey || '';

      if (!apiKey) fail('API key cannot be empty.');
      if (!validateApiKey(apiKey)) fail('Invalid API key format.');

      const models = definition.defaultModels;
      const defaultModel = saved?.model || models[0];
      ui.line();
      printChoices(models, models, defaultModel);
      const model = pick(await ask(` Model, number or name (${defaultModel}): `), models, defaultModel);

      saveConfig({ provider, apiKey, model });
      ui.line();
      ui.success(`Saved ${definition.name} · ${model} · ${maskString(apiKey)}`);
      ui.line();
    } catch (error) {
      fail((error as Error).message);
    }
  });

configCmd
  .command('clear')
  .description('Clear stored configuration')
  .action(() => {
    try {
      if (clearConfig()) {
        ui.success('Configuration cleared.');
      } else {
        ui.line('No configuration found.');
      }
    } catch (error) {
      fail((error as Error).message);
    }
  });

interface CliOptions {
  staged?: boolean;
  commit?: boolean;
  simple?: boolean;
  ai?: boolean;
  verbose?: boolean;
  provider?: string;
  model?: string;
}

// Show the message and act on the user's choice until they commit or quit
async function confirmAndCommit(
  first: string,
  stagedOnly: boolean,
  regenerate: () => Promise<string>
): Promise<void> {
  let message = first;
  ui.commitMessage(message);

  for (;;) {
    const action = await askAction(ui.actionMenu());

    if (action === 'quit') {
      ui.warn('Nothing committed.');
      return;
    }
    if (action === 'regenerate') {
      message = await regenerate();
      ui.commitMessage(message);
      continue;
    }
    if (action === 'edit') {
      const edited = editMessage(message);
      if (edited) {
        message = edited;
      } else {
        ui.warn('Empty message; kept the previous one.');
      }
      ui.commitMessage(message);
      continue;
    }

    // With --staged, commit only what is already staged
    if (!stagedOnly) stageAll();
    commit(message);
    ui.success('Committed.');
    return;
  }
}

// Main command
program
  .option('-s, --staged', 'Only consider staged changes')
  .option('-c, --commit', 'Show the message, then commit, edit, regenerate or quit')
  .option('-p, --provider <id>', `Provider for this run (${getProviderIds().join(', ')})`)
  .option('-m, --model <name>', 'Model for this run')
  .option('--simple', 'Use simple message format (no AI)')
  .option('--no-ai', 'Same as --simple')
  .option('-v, --verbose', 'Show verbose output')
  .action(async (options: CliOptions) => {
    const logger = new Logger('INFO', options.verbose || false);
    const opts: MessageOptions = {
      stagedOnly: options.staged || false,
      commit: options.commit || false,
      simple: options.simple || options.ai === false,
      verbose: options.verbose || false,
      model: options.model
    };

    try {
      if (options.provider) {
        const provider = normalizeProvider(options.provider);
        if (!provider) fail(`Unknown provider "${options.provider}".`, `Choose one of: ${getProviderIds().join(', ')}`);
        process.env.GCM_PROVIDER = provider;
      }

      const provider: ProviderId = getProvider();
      if (!opts.simple && !hasApiKey(provider)) {
        const definition = getProviderDefinition(provider);
        fail(
          `No ${definition.name} API key configured.`,
          `Run "gcm config set", set ${definition.apiKeyEnvVar}, or use --simple.`
        );
      }

      if (!isInsideRepo()) {
        fail('Not a git repository.', 'Run this command from within a git repository.');
      }

      const summary: StatusSummary = parseStatus(getStatus(), opts.stagedOnly);

      const stagedCount = summary.staged.added + summary.staged.modified + summary.staged.deleted +
        summary.staged.renamed + summary.staged.copied;
      const otherCount = opts.stagedOnly ? 0 :
        summary.unstaged.modified + summary.unstaged.deleted + summary.untracked;

      if (stagedCount + otherCount === 0) {
        ui.line(opts.stagedOnly ? 'No staged changes to commit.' : 'No changes detected. Working tree is clean.');
        return;
      }

      const files = getChangedFiles(summary, opts.stagedOnly || false);
      const stats = getDiffStats(opts.stagedOnly);

      ui.header(opts.simple ? 'simple mode' : `${provider} · ${resolveModel(opts)}`);
      ui.changeStats(files.length, stats.insertions, stats.deletions, summary.branch);

      const build = async (skipCache: boolean = false): Promise<string> => {
        if (opts.simple) return buildSimpleMessage(summary, opts);
        try {
          const diff = getDiff(files, opts.stagedOnly || false);
          return await withProgress('Writing commit message...', () =>
            generateWithAI(summary, diff, files, { ...opts, skipCache }, logger));
        } catch (error) {
          ui.error((error as Error).message, 'Using the simple format instead.');
          return buildSimpleMessage(summary, opts);
        }
      };

      const message = await build();

      if (opts.commit) {
        await confirmAndCommit(message, opts.stagedOnly || false, () => build(true));
      } else {
        ui.commitMessage(message);
      }
    } catch (error) {
      const err = error as Error;
      const prefix = error instanceof GitError ? 'Git error: ' : error instanceof ConfigError ? 'Config error: ' : '';
      if (process.env.DEBUG) {
        console.error(err.stack);
      }
      fail(`${prefix}${err.message}`);
    }
  });

// Handle unhandled promise rejections
process.on('unhandledRejection', (error: unknown) => {
  const err = error as Error;
  if (process.env.DEBUG) {
    console.error(err.stack);
  }
  fail(`Unhandled error: ${err.message}`);
});

program.parse(process.argv);
