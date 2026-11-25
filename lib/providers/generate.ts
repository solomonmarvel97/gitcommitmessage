// One entry point for every provider: (provider, model, key, prompt) -> text

import { ProviderId, getProviderDefinition } from './index';
import { generateWithAnthropic } from './anthropic';
import { generateWithGeminiApi } from './gemini';
import { generateWithOpenAICompatible } from './openai-compatible';

export interface GenerateRequest {
  provider: ProviderId;
  model: string;
  apiKey: string;
  prompt: string;
}

// Leaves room for reasoning models, which spend output tokens before answering
export const MAX_OUTPUT_TOKENS = 4000;

export function generate(request: GenerateRequest): Promise<string> {
  switch (getProviderDefinition(request.provider).api) {
    case 'anthropic':
      return generateWithAnthropic(request);
    case 'gemini':
      return generateWithGeminiApi(request);
    case 'openai-compatible':
      return generateWithOpenAICompatible(request);
  }
}
