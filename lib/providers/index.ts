export type ProviderId = 'gemini' | 'anthropic' | 'openai' | 'xai' | 'groq' | 'openrouter';

export interface ProviderDefinition {
  id: ProviderId;
  name: string;
  api: 'anthropic' | 'gemini' | 'openai-compatible';
  apiKeyUrl: string;
  apiKeyEnvVar: string;
  modelEnvVar: string;
  defaultModels: readonly string[]; // first is the default, the rest are fallbacks
  baseUrl?: string;
}

export const DEFAULT_PROVIDER: ProviderId = 'gemini';

export const PROVIDERS: Record<ProviderId, ProviderDefinition> = {
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    api: 'gemini',
    apiKeyUrl: 'https://aistudio.google.com/apikey',
    apiKeyEnvVar: 'GEMINI_API_KEY',
    modelEnvVar: 'GEMINI_MODEL',
    defaultModels: ['gemini-3.8-flash', 'gemini-3.5-flash-lite']
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    api: 'anthropic',
    apiKeyUrl: 'https://platform.claude.com/settings/keys',
    apiKeyEnvVar: 'ANTHROPIC_API_KEY',
    modelEnvVar: 'ANTHROPIC_MODEL',
    defaultModels: ['claude-opus-5-5', 'claude-haiku-5-5', 'claude-sonnet-5-5']
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    api: 'openai-compatible',
    apiKeyUrl: 'https://platform.openai.com/api-keys',
    apiKeyEnvVar: 'OPENAI_API_KEY',
    modelEnvVar: 'OPENAI_MODEL',
    baseUrl: 'https://api.openai.com/v1',
    defaultModels: ['gpt-5.6-luna', 'gpt-6.2-sol']
  },
  xai: {
    id: 'xai',
    name: 'xAI (Grok)',
    api: 'openai-compatible',
    apiKeyUrl: 'https://console.x.ai',
    apiKeyEnvVar: 'XAI_API_KEY',
    modelEnvVar: 'XAI_MODEL',
    baseUrl: 'https://api.x.ai/v1',
    defaultModels: ['grok-4.3', 'grok-4.20-0309-non-reasoning', 'grok-4.7']
  },
  groq: {
    id: 'groq',
    name: 'Groq',
    api: 'openai-compatible',
    apiKeyUrl: 'https://console.groq.com/keys',
    apiKeyEnvVar: 'GROQ_API_KEY',
    modelEnvVar: 'GROQ_MODEL',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModels: ['openai/gpt-oss-20b', 'openai/gpt-oss-120b']
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    api: 'openai-compatible',
    apiKeyUrl: 'https://openrouter.ai/settings/keys',
    apiKeyEnvVar: 'OPENROUTER_API_KEY',
    modelEnvVar: 'OPENROUTER_MODEL',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModels: ['openai/gpt-4o-mini', 'openai/gpt-oss-20b', 'anthropic/claude-haiku-5.5']
  }
};

export function getProviderIds(): ProviderId[] {
  return Object.keys(PROVIDERS) as ProviderId[];
}

export function normalizeProvider(value: unknown): ProviderId | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return getProviderIds().includes(normalized as ProviderId)
    ? normalized as ProviderId
    : null;
}

export function getProviderDefinition(provider: ProviderId): ProviderDefinition {
  return PROVIDERS[provider];
}
