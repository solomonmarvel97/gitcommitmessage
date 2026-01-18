#!/usr/bin/env node
import * as readline from 'readline';
import { Command } from 'commander';
import Logger from '../lib/logger';
import { getApiKey, hasConfig, saveConfig, clearConfig, displayConfig, getConfig } from '../lib/config';
import { isInsideRepo, getStatus, getDiff, stageAll, commit } from '../lib/git';
import { parseStatus, getChangedFiles, buildSimpleMessage, generateWithGemini, MessageOptions } from '../lib/message';
import { ConfigError, GitError, APIError, ValidationError } from '../lib/errors';
import { validateApiKey, maskString } from '../lib/utils';
import { withProgress } from '../lib/progress';
import CONSTANTS from '../lib/constants';
import * as packageJson from '../package.json';

const program = new Command();

program
  .name('gcm')
  .description('Generate intelligent commit messages from git status using AI (Gemini)')
  .version(packageJson.version);

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
    if (config.hasConfig) {
      console.log('✓ Configuration found');
      console.log(`  API Key: ${config.apiKey}`);
      console.log(`  Model: ${config.model}`);
      console.log('');
      console.log('To update your API key, run: gcm config set');
    } else {
      console.log('No configuration found.');
      console.log('Run: gcm config set');
      process.exit(1);
    }
  });

configCmd
  .command('set')
  .description('Set or update your Gemini API key and model')
  .action(async () => {
    try {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const question = (prompt: string): Promise<string> => {
        return new Promise((resolve) => {
          rl.question(prompt, (answer) => {
            resolve(answer.trim());
          });
        });
      };

      console.log('Please enter your Google Gemini API key.');
      console.log(`Get one at: ${CONSTANTS.GEMINI_API_KEY_URL}`);
      console.log('');
      
      const apiKey = await question('API Key: ');

      if (!apiKey) {
        rl.close();
        console.error('Error: API key cannot be empty.');
        process.exit(1);
      }

      if (!validateApiKey(apiKey)) {
        rl.close();
        console.error('Error: Invalid API key format.');
        process.exit(1);
      }

      console.log('');
      console.log('Available models:');
      CONSTANTS.DEFAULT_MODELS.forEach((model) => {
        console.log(`  • ${model}`);
      });
      console.log('');
      
      const modelInput = await question(`Model name (default: ${CONSTANTS.DEFAULT_MODELS[0]}): `);
      
      rl.close();

      const model = modelInput || CONSTANTS.DEFAULT_MODELS[0];

      const config = {
        apiKey: apiKey,
        model: model
      };

      saveConfig(config);
      console.log('');
      console.log('✓ Configuration saved successfully!');
      console.log(`  API Key: ${maskString(apiKey)}`);
      console.log(`  Model: ${model}`);
      console.log('');
      console.log('You can now use gcm to generate AI-powered commit messages.');
    } catch (error) {
      if (error instanceof ValidationError || error instanceof ConfigError) {
        console.error(`Error: ${error.message}`);
      } else {
        const err = error as Error;
        console.error(`Error: ${err.message}`);
      }
      process.exit(1);
    }
  });

configCmd
  .command('clear')
  .description('Clear stored configuration')
  .action(() => {
    try {
      const cleared = clearConfig();
      if (cleared) {
        console.log('✓ Configuration cleared.');
      } else {
        console.log('No configuration found.');
      }
    } catch (error) {
      const err = error as Error;
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

// Main command
program
  .option('-s, --staged', 'Only consider staged changes')
  .option('-c, --commit', 'Stage changes, show message, wait for confirmation, then commit')
  .option('--simple, --no-ai', 'Use simple message format (no AI)')
  .option('-v, --verbose', 'Show verbose output')
  .action(async (options: { staged?: boolean; commit?: boolean; simple?: boolean; verbose?: boolean }) => {
    const logger = new Logger('INFO', options.verbose || false);
    const opts: MessageOptions = {
      stagedOnly: options.staged || false,
      commit: options.commit || false,
      simple: options.simple || false,
      verbose: options.verbose || false
    };

    try {
      // Check if config is required (unless using --simple)
      if (!opts.simple && !hasConfig() && !process.env.GEMINI_API_KEY) {
        console.error('Error: API key not configured.');
        console.error('');
        console.error('Before using AI-powered commit messages, you must configure your API key:');
        console.error(`  1. Get your API key from: ${CONSTANTS.GEMINI_API_KEY_URL}`);
        console.error('  2. Run: gcm config set');
        console.error('  3. Enter your API key when prompted');
        console.error('');
        console.error('Alternatively, use --simple flag for basic message format without AI.');
        process.exit(1);
      }

      // Check if we're in a git repo
      if (!isInsideRepo()) {
        console.error('Error: Not a git repository');
        console.error('Run this command from within a git repository.');
        process.exit(1);
      }

      // Get git status with progress
      const statusOutput = await withProgress('Analyzing git status...', async () => {
        return Promise.resolve(getStatus());
      });
      const summary = parseStatus(statusOutput);

      // Check if there are any changes
      const hasChanges = summary.staged.added + summary.staged.modified + summary.staged.deleted +
        summary.staged.renamed + summary.staged.copied > 0 ||
        (!opts.stagedOnly && (
          summary.unstaged.modified + summary.unstaged.deleted +
          summary.untracked > 0
        ));

      if (!hasChanges) {
        const msg = opts.stagedOnly
          ? 'No staged changes to commit.'
          : 'No changes detected. Working tree is clean.';
        console.log(msg);
        process.exit(0);
      }

      let message: string;

      // Check if we have API key (from config or env)
      const hasApiKey = hasConfig() || !!process.env.GEMINI_API_KEY;

      if (opts.simple || !hasApiKey) {
        // Use simple message format
        if (opts.verbose && !opts.simple) {
          logger.warn('API key not configured, using simple message format.');
          logger.info('Run "gcm config set" to configure your API key.');
        }
        message = await withProgress('Generating commit message...', async () => {
          return Promise.resolve(buildSimpleMessage(summary, opts));
        });
      } else {
        // Use AI to generate message
        try {
          const files = await withProgress('Collecting changed files...', async () => {
            return Promise.resolve(getChangedFiles(summary, opts.stagedOnly || false));
          });

          const diff = await withProgress('Collecting git diffs...', async () => {
            return Promise.resolve(getDiff(files, opts.stagedOnly || false));
          });

          message = await withProgress('Generating commit message with AI...', async () => {
            return await generateWithGemini(summary, diff, files, opts, logger);
          });
        } catch (error) {
          if (error instanceof APIError) {
            logger.error(`Error generating AI message: ${error.message}`);
          } else {
            const err = error as Error;
            logger.error(`Error generating AI message: ${err.message}`);
          }
          if (opts.verbose) {
            logger.info('Falling back to simple message format...');
          }
          message = await withProgress('Generating simple commit message...', async () => {
            return Promise.resolve(buildSimpleMessage(summary, opts));
          });
        }
      }

      console.log(message);

      if (opts.commit) {
        // Stage all changes first
        await withProgress('Staging all changes...', async () => {
          stageAll();
          return Promise.resolve();
        });

        // Show the commit message and wait for user confirmation
        console.log('');
        console.log('Generated commit message:');
        console.log('─'.repeat(72));
        console.log(message);
        console.log('─'.repeat(72));
        console.log('');

        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });

        await new Promise<void>((resolve) => {
          rl.question('Press Enter to commit, or Ctrl+C to cancel: ', () => {
            rl.close();

            if (opts.verbose) {
              logger.info('Committing changes...');
            }
            commit(message);
            resolve();
          });
        });
      }
    } catch (error) {
      if (error instanceof GitError) {
        logger.error(`Git error: ${error.message}`);
      } else if (error instanceof ConfigError) {
        logger.error(`Config error: ${error.message}`);
      } else {
        const err = error as Error;
        logger.error(`Error: ${err.message}`);
      }
      if (process.env.DEBUG) {
        const err = error as Error;
        console.error(err.stack);
      }
      process.exit(1);
    }
  });

// Handle unhandled promise rejections
process.on('unhandledRejection', (error: unknown) => {
  const err = error as Error;
  console.error('Unhandled error:', err.message);
  if (process.env.DEBUG) {
    console.error(err.stack);
  }
  process.exit(1);
});

program.parse(process.argv);
