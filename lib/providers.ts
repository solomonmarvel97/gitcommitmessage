export type ProviderId = 'gemini' | 'groq' | 'openrouter';

export interface ProviderDefinition {
  id: ProviderId;
  name: string;
  apiKeyUrl: string;
  apiKeyEnvVar: string;
  modelEnvVar: string;
  defaultModels: readonly string[];
  baseUrl?: string;
}

export const DEFAULT_PROVIDER: ProviderId = 'gemini';

export const PROVIDERS: Record<ProviderId, ProviderDefinition> = {
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    apiKeyUrl: 'https://aistudio.google.com/apikey',
    apiKeyEnvVar: 'GEMINI_API_KEY',
    modelEnvVar: 'GEMINI_MODEL',
    defaultModels: [
      'gemini-3-flash-preview',
      'gemini-3-pro-preview',
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'gemini-pro'
    ]
  },
  groq: {
    id: 'groq',
    name: 'Groq',
    apiKeyUrl: 'https://console.groq.com/keys',
    apiKeyEnvVar: 'GROQ_API_KEY',
    modelEnvVar: 'GROQ_MODEL',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModels: [
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'openai/gpt-oss-120b',
      'openai/gpt-oss-20b'
    ]
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    apiKeyUrl: 'https://openrouter.ai/settings/keys',
    apiKeyEnvVar: 'OPENROUTER_API_KEY',
    modelEnvVar: 'OPENROUTER_MODEL',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModels: [
      'openai/gpt-4o-mini',
      'anthropic/claude-3.5-haiku',
      'meta-llama/llama-3.1-8b-instruct'
    ]
  }
} as const;

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
