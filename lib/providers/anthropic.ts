// Anthropic Messages API through the official SDK

import Anthropic from '@anthropic-ai/sdk';
import { ProviderError } from './http';
import { GenerateRequest, MAX_OUTPUT_TOKENS } from './generate';

// Models that accept output_config.effort
const EFFORT_MODELS = ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'];
// Models that get a server-side fallback when a request is refused
const FALLBACK_MODELS = ['claude-opus-5-5', 'claude-sonnet-5-5'];

export async function generateWithAnthropic({ model, apiKey, prompt }: GenerateRequest): Promise<string> {
  // maxRetries 0: retries are handled by the caller for every provider
  const client = new Anthropic({ apiKey, maxRetries: 0, timeout: 60000 });

  const params = {
    model,
    max_tokens: MAX_OUTPUT_TOKENS,
    messages: [{ role: 'user' as const, content: prompt }],
    ...(EFFORT_MODELS.includes(model) ? { output_config: { effort: 'low' as const } } : {})
  };

  const response = FALLBACK_MODELS.includes(model)
    ? await client.beta.messages.create({
        ...params,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default'
      })
    : await client.messages.create(params);

  if (response.stop_reason === 'refusal') {
    throw new ProviderError('Claude declined to write a message for this diff.');
  }
  if (response.stop_reason === 'max_tokens') {
    throw new ProviderError('Claude ran out of output tokens before finishing the message.');
  }

  let text = '';
  for (const block of response.content) {
    if (block.type === 'text') text += block.text;
  }
  return text.trim();
}
