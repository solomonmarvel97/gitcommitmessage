const fs = require('fs');
const path = require('path');

const config = require('../dist/lib/config');

const KEY_A = 'a'.repeat(30);
const KEY_B = 'b'.repeat(30);
const ENV = ['GCM_PROVIDER', 'GCM_MODEL', 'ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL', 'OPENAI_API_KEY',
  'GEMINI_API_KEY', 'GROQ_API_KEY', 'GROQ_MODEL', 'OPENROUTER_API_KEY', 'XAI_API_KEY'];

describe('config', () => {
  const saved = {};

  beforeAll(() => ENV.forEach((name) => { saved[name] = process.env[name]; }));
  beforeEach(() => {
    ENV.forEach((name) => delete process.env[name]);
    config.clearConfig();
  });
  afterAll(() => {
    ENV.forEach((name) => { if (saved[name] !== undefined) process.env[name] = saved[name]; });
  });

  test('uses a temporary home, not the real one', () => {
    expect(config.CONFIG_DIR.startsWith(require('os').tmpdir())).toBe(true);
  });

  test('keeps one key per provider', () => {
    config.saveConfig({ provider: 'anthropic', apiKey: KEY_A, model: 'claude-haiku-5-5' });
    config.saveConfig({ provider: 'openai', apiKey: KEY_B });

    expect(config.getProvider()).toBe('openai');
    expect(config.getApiKey('anthropic')).toBe(KEY_A);
    expect(config.getApiKey('openai')).toBe(KEY_B);
    expect(config.getModel('fallback', 'anthropic')).toBe('claude-haiku-5-5');
    expect(config.getModel('fallback', 'openai')).toBe('fallback');
  });

  test('reads and upgrades the old single-key file', () => {
    fs.mkdirSync(config.CONFIG_DIR, { recursive: true });
    fs.writeFileSync(config.CONFIG_FILE, JSON.stringify({ provider: 'groq', apiKey: KEY_A, model: 'm1' }));

    expect(config.getProvider()).toBe('groq');
    expect(config.getApiKey()).toBe(KEY_A);

    config.saveConfig({ provider: 'xai', apiKey: KEY_B });
    const stored = JSON.parse(fs.readFileSync(config.CONFIG_FILE, 'utf8'));
    expect(stored.providers.groq).toEqual({ apiKey: KEY_A, model: 'm1' });
    expect(stored.providers.xai.apiKey).toBe(KEY_B);
    expect(stored.apiKey).toBeUndefined();
  });

  test('writes the file readable only by the owner', () => {
    config.saveConfig({ provider: 'gemini', apiKey: KEY_A });
    expect(fs.statSync(config.CONFIG_FILE).mode & 0o777).toBe(0o600);
  });

  test('picks a provider from environment keys when there is no file', () => {
    process.env.ANTHROPIC_API_KEY = KEY_A;
    expect(config.getProvider()).toBe('anthropic');
    expect(config.hasApiKey()).toBe(true);
  });

  test('masks keys for display and marks the active provider', () => {
    config.saveConfig({ provider: 'openai', apiKey: KEY_A });
    const { entries } = config.displayConfig();
    expect(entries).toHaveLength(1);
    expect(entries[0].active).toBe(true);
    expect(entries[0].apiKey).not.toContain(KEY_A);
  });
});
