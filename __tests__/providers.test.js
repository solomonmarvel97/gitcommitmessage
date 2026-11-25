const https = require('https');
const { EventEmitter } = require('events');

const mockCreate = jest.fn();
const mockBetaCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    messages: { create: mockCreate },
    beta: { messages: { create: mockBetaCreate } }
  }))
}));

const { generate } = require('../dist/lib/providers/generate');
const { getProviderIds, getProviderDefinition } = require('../dist/lib/providers');
const { isRetryableError } = require('../dist/lib/message');

// Replace the network with one canned response and record the request
function mockHttp(status, payload) {
  const sent = {};
  jest.spyOn(https, 'request').mockImplementation((url, options, onResponse) => {
    sent.url = url;
    sent.headers = options.headers;
    const req = new EventEmitter();
    req.setTimeout = () => {};
    req.write = (body) => { sent.body = JSON.parse(body); };
    req.end = () => {
      const res = new EventEmitter();
      res.statusCode = status;
      res.setEncoding = () => {};
      onResponse(res);
      res.emit('data', JSON.stringify(payload));
      res.emit('end');
    };
    return req;
  });
  return sent;
}

const request = (provider, model = 'some-model') => ({ provider, model, apiKey: 'k'.repeat(30), prompt: 'p' });
const reply = (text) => ({ stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: '' }, { type: 'text', text }] });

describe('providers', () => {
  afterEach(() => jest.restoreAllMocks());
  beforeEach(() => { mockCreate.mockReset(); mockBetaCreate.mockReset(); });

  test('lists all six, each with a default model and key variable', () => {
    expect(getProviderIds().sort()).toEqual(['anthropic', 'gemini', 'groq', 'openai', 'openrouter', 'xai']);
    getProviderIds().forEach((id) => {
      expect(getProviderDefinition(id).defaultModels.length).toBeGreaterThan(0);
      expect(getProviderDefinition(id).apiKeyEnvVar).toMatch(/_API_KEY$/);
    });
  });

  test.each([
    ['openai', 'https://api.openai.com/v1', 'max_completion_tokens'],
    ['xai', 'https://api.x.ai/v1', 'max_tokens'],
    ['groq', 'https://api.groq.com/openai/v1', 'max_tokens'],
    ['openrouter', 'https://openrouter.ai/api/v1', 'max_tokens']
  ])('%s sends a chat completion', async (provider, baseUrl, tokenField) => {
    const sent = mockHttp(200, { choices: [{ message: { content: ' feat: x ' } }] });
    await expect(generate(request(provider))).resolves.toBe('feat: x');
    expect(sent.url).toBe(`${baseUrl}/chat/completions`);
    expect(sent.headers.Authorization).toMatch(/^Bearer /);
    expect(sent.body[tokenField]).toBeGreaterThan(0);
    expect(sent.body.temperature).toBeUndefined();
  });

  test('gemini keeps the key in a header and skips thought parts', async () => {
    const sent = mockHttp(200, { candidates: [{ content: { parts: [{ text: 'hmm', thought: true }, { text: 'fix: y' }] } }] });
    await expect(generate(request('gemini', 'gemini-x'))).resolves.toBe('fix: y');
    expect(sent.url).toContain('/models/gemini-x:generateContent');
    expect(sent.url).not.toContain('key=');
    expect(sent.headers['x-goog-api-key']).toBeDefined();
  });

  test('HTTP errors carry their status', async () => {
    mockHttp(401, { error: 'nope' });
    await expect(generate(request('openai'))).rejects.toMatchObject({ status: 401 });
  });

  test('anthropic asks for a fallback on Opus', async () => {
    mockBetaCreate.mockResolvedValue(reply('feat: z'));
    await expect(generate(request('anthropic', 'claude-opus-5-5'))).resolves.toBe('feat: z');
    expect(mockBetaCreate.mock.calls[0][0]).toMatchObject({ fallbacks: 'default', output_config: { effort: 'low' } });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test('anthropic sends no fallback on Haiku and no effort on other models', async () => {
    mockCreate.mockResolvedValue(reply('docs: a'));
    await generate(request('anthropic', 'claude-haiku-5-5'));
    await generate(request('anthropic', 'claude-haiku-4-5'));
    expect(mockCreate.mock.calls[0][0].fallbacks).toBeUndefined();
    expect(mockCreate.mock.calls[1][0].output_config).toBeUndefined();
  });

  test('anthropic refusal is an error, not an empty message', async () => {
    mockCreate.mockResolvedValue({ stop_reason: 'refusal', content: [] });
    await expect(generate(request('anthropic', 'claude-haiku-5-5'))).rejects.toThrow(/declined/);
  });

  test('retries only rate limits, server and network errors', () => {
    expect(isRetryableError({ status: 429, message: '' })).toBe(true);
    expect(isRetryableError({ status: 503, message: '' })).toBe(true);
    expect(isRetryableError({ status: 401, message: '' })).toBe(false);
    expect(isRetryableError({ status: 400, message: '' })).toBe(false);
    expect(isRetryableError({ message: 'API request timed out' })).toBe(true);
    expect(isRetryableError({ message: 'Claude declined to write a message for this diff.' })).toBe(false);
  });
});
