// OpenAI, xAI, Groq and OpenRouter all speak Chat Completions

import { getProviderDefinition } from './index';
import { postJson, ProviderError } from './http';
import { GenerateRequest, MAX_OUTPUT_TOKENS } from './generate';

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
    text?: string;
  }>;
}

function extractText(response: ChatCompletionResponse): string {
  const choice = response.choices?.[0];
  const content = choice?.message?.content;

  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) return content.map((part) => part.text || '').join('').trim();
  return typeof choice?.text === 'string' ? choice.text.trim() : '';
}

export async function generateWithOpenAICompatible(request: GenerateRequest): Promise<string> {
  const { provider, model, apiKey, prompt } = request;
  const definition = getProviderDefinition(provider);
  if (!definition.baseUrl) {
    throw new ProviderError(`${definition.name} has no chat completions endpoint.`);
  }

  const headers: Record<string, string> = { Authorization: `Bearer ${apiKey}` };
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://github.com/solomonmarvel97/gitcommitmessage';
    headers['X-Title'] = 'gitcommitmessage';
  }

  // No temperature: several reasoning models reject it.
  // OpenAI replaced max_tokens with max_completion_tokens.
  const tokenLimit = provider === 'openai'
    ? { max_completion_tokens: MAX_OUTPUT_TOKENS }
    : { max_tokens: MAX_OUTPUT_TOKENS };

  const response = await postJson<ChatCompletionResponse>(
    `${definition.baseUrl}/chat/completions`,
    { model, messages: [{ role: 'user', content: prompt }], ...tokenLimit },
    headers
  );

  return extractText(response);
}
