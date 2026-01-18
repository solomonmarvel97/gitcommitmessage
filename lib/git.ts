// Git operations

import { spawnSync } from 'child_process';
import { runGit, isInsideRepo as checkRepo } from './utils';
import { GitError } from './errors';
import CONSTANTS from './constants';

export function isInsideRepo(): boolean {
  return checkRepo();
}

export function getStatus(): string {
  const result = runGit(['status', '--porcelain=v2', '-b']);
  return result.stdout;
}

export function getDiff(files: string[], stagedOnly: boolean = false): string {
  if (files.length === 0) return '';
  
  const filesToDiff = files.slice(0, CONSTANTS.MAX_FILES_FOR_DIFF);
  const remainingCount = files.length - filesToDiff.length;
  
  let diffOutput = '';
  
  try {
    if (stagedOnly) {
      const result = runGit(['diff', '--cached', '--', ...filesToDiff]);
      diffOutput = result.stdout || '';
    } else {
      const staged = runGit(['diff', '--cached', '--', ...filesToDiff]);
      const unstaged = runGit(['diff', '--', ...filesToDiff]);
      
      if (staged.stdout) {
        diffOutput += '=== STAGED CHANGES ===\n' + staged.stdout + '\n\n';
      }
      if (unstaged.stdout) {
        diffOutput += '=== UNSTAGED CHANGES ===\n' + unstaged.stdout;
      }
    }
  } catch (error) {
    // Diff might fail for new files, that's ok
    return '';
  }
  
  // Cap diff size
  if (diffOutput.length > CONSTANTS.MAX_DIFF_SIZE) {
    diffOutput = diffOutput.substring(0, CONSTANTS.MAX_DIFF_SIZE) + '\n\n[... diff truncated ...]';
  }
  
  if (remainingCount > 0) {
    diffOutput += `\n\n[${remainingCount} more file(s) changed but diff not shown]`;
  }
  
  return diffOutput;
}

export function stageAll(): boolean {
  const result = spawnSync('git', ['add', '.'], { stdio: 'inherit' });
  if (result.status !== 0) {
    throw new GitError('Failed to stage changes');
  }
  return true;
}

export function commit(message: string): boolean {
  const result = spawnSync('git', ['commit', '-m', message], { stdio: 'inherit' });
  if (result.status !== 0) {
    throw new GitError('Commit failed');
  }
  return true;
}
