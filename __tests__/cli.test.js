// Runs the built CLI in throwaway git repositories
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const os = require('os');

const CLI = path.join(__dirname, '..', 'dist', 'bin', 'gcm.js');
const FAKE = path.join(__dirname, 'helpers', 'fake-https.js');

let root;
let repo;
let home;
let log;

const env = (extra = {}) => ({
  PATH: process.env.PATH,
  HOME: home,
  GIT_CONFIG_NOSYSTEM: '1',
  FAKE_LOG: log,
  ...extra
});

function git(...args) {
  const result = spawnSync('git', args, { cwd: repo, env: env(), encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout.trim();
}

function gcm(args, { input = '', extra = {} } = {}) {
  return spawnSync('node', ['-r', FAKE, CLI, ...args], { cwd: repo, env: env(extra), input, encoding: 'utf8' });
}

const ai = { OPENAI_API_KEY: 'k'.repeat(30), GCM_PROVIDER: 'openai' };
const write = (name, text) => fs.writeFileSync(path.join(repo, name), text);
const requests = () => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n') : []);
const commits = () => Number(git('rev-list', '--count', 'HEAD'));

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'gcm-cli-'));
  repo = path.join(root, 'repo');
  home = path.join(root, 'home');
  log = path.join(root, 'requests.log');
  fs.mkdirSync(repo);
  fs.mkdirSync(home);
  git('init', '-q');
  git('config', 'user.name', 'Test');
  git('config', 'user.email', 'test@example.test');
  git('config', 'commit.gpgsign', 'false');
  write('staged.txt', 'one\n');
  write('other.txt', 'one\n');
  git('add', '.');
  git('commit', '-qm', 'init');
  // one staged change, one unstaged change, one untracked file
  write('staged.txt', 'one\ntwo\nthree\n');
  git('add', 'staged.txt');
  write('other.txt', '');
  write('new.txt', 'new\n');
});

afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe('flags', () => {
  test.each(['--simple', '--no-ai'])('%s needs no key and calls no provider', (flag) => {
    const result = gcm([flag]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('untracked: new.txt');
    expect(requests()).toEqual([]);
  });

  test('--staged leaves unstaged files out of the message', () => {
    const { stdout } = gcm(['--simple', '--staged']);
    expect(stdout).toContain('staged.txt');
    expect(stdout).not.toContain('other.txt');
    expect(stdout).not.toContain('new.txt');
  });

  test('only the message goes to stdout, with line counts on stderr', () => {
    const result = gcm([], { extra: ai });
    expect(result.stdout).toBe('feat: fake message 1\n');
    expect(result.stderr).toContain('+2 −1');
  });

  test('a missing key and an unknown provider fail clearly', () => {
    expect(gcm(['-p', 'openai']).status).toBe(1);
    expect(gcm(['-p', 'nope']).stderr).toContain('Unknown provider');
  });
});

describe('--commit', () => {
  test('enter stages everything and commits', () => {
    gcm(['--simple', '-c'], { input: '\n' });
    expect(commits()).toBe(2);
    expect(git('status', '--porcelain')).toBe('');
  });

  test('--staged commits only what was staged', () => {
    gcm(['--simple', '--staged', '-c'], { input: '\n' });
    expect(commits()).toBe(2);
    expect(git('show', '--name-only', '--format=', 'HEAD')).toBe('staged.txt');
    expect(git('status', '--porcelain')).toContain('new.txt');
  });

  test.each([
    ['q', 'q\n'],
    ['an unknown answer', 'x\n'],
    ['end of input', '']
  ])('%s commits and stages nothing', (name, input) => {
    const before = git('status', '--porcelain');
    const result = gcm(['--simple', '-c'], { input });
    expect(result.stderr).toContain('Nothing committed');
    expect(commits()).toBe(1);
    expect(git('status', '--porcelain')).toBe(before);
  });

  test('e commits the edited message', () => {
    const editor = path.join(root, 'editor.sh');
    fs.writeFileSync(editor, '#!/bin/sh\necho "docs: edited by hand" > "$1"\n', { mode: 0o755 });
    git('config', 'core.editor', editor);
    gcm(['--simple', '-c'], { input: 'e\n\n' });
    expect(git('log', '-1', '--format=%s')).toBe('docs: edited by hand');
  });

  test('r asks the provider again instead of using the cache', () => {
    gcm(['-c'], { input: 'r\n\n', extra: ai });
    expect(requests()).toHaveLength(2);
    expect(git('log', '-1', '--format=%s')).toBe('feat: fake message 2');
  });
});

describe('provider requests', () => {
  test('the same diff is answered from the cache', () => {
    gcm([], { extra: ai });
    expect(gcm([], { extra: ai }).stdout).toBe('feat: fake message 1\n');
    expect(requests()).toHaveLength(1);
  });

  test('a bad key is tried once, then the simple format is used', () => {
    const result = gcm([], { extra: { ...ai, FAKE_STATUS: '401' } });
    expect(requests()).toHaveLength(1);
    expect(result.stderr).toContain('Invalid OpenAI API key');
    expect(result.stdout).toContain('on ');
  });

  test('server errors are tried three times', () => {
    gcm([], { extra: { ...ai, FAKE_STATUS: '503' } });
    expect(requests()).toHaveLength(3);
  }, 15000);

  test('an unavailable default model falls back to the next', () => {
    const result = gcm([], { extra: { ...ai, FAKE_MISSING_MODEL: 'gpt-5.6-luna' } });
    expect(requests()).toEqual(['gpt-5.6-luna', 'gpt-6.2-sol']);
    expect(result.stderr).toContain('used gpt-6.2-sol');
  });

  test('a model named with --model is never swapped', () => {
    const result = gcm(['-m', 'my-model'], { extra: { ...ai, FAKE_MISSING_MODEL: 'my-model' } });
    expect(requests()).toEqual(['my-model']);
    expect(result.stderr).toContain('No available OpenAI model');
  });
});
