// Config management - one API key and model per provider

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ConfigError, ValidationError } from './errors';
import { validateApiKey, maskString } from './utils';
import CONSTANTS from './constants';
import {
  DEFAULT_PROVIDER,
  ProviderId,
  getProviderIds,
  getProviderDefinition,
  normalizeProvider
} from './providers';

export interface Config {
  provider?: ProviderId;
  apiKey: string;
  model?: string;
}

interface ProviderSettings {
  apiKey: string;
  model?: string;
}

// Shape of ~/.gcm/config.json
export interface ConfigStore {
  provider: ProviderId;
  providers: Partial<Record<ProviderId, ProviderSettings>>;
}

export interface DisplayConfig {
  hasConfig: boolean;
  entries: Array<{ id: ProviderId; name: string; apiKey: string; model: string; active: boolean }>;
}

const CONFIG_DIR = path.join(os.homedir(), CONSTANTS.CONFIG_DIR_NAME);
const CONFIG_FILE = path.join(CONFIG_DIR, CONSTANTS.CONFIG_FILE_NAME);

// Read the file, upgrading the old single-key format in memory
export function loadStore(): ConfigStore | null {
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    if (!raw || typeof raw !== 'object') return null;

    const provider = normalizeProvider(raw.provider) || DEFAULT_PROVIDER;
    if (raw.providers && typeof raw.providers === 'object') {
      return { provider, providers: raw.providers };
    }

    const providers: ConfigStore['providers'] = {};
    if (typeof raw.apiKey === 'string') {
      providers[provider] = { apiKey: raw.apiKey, model: raw.model };
    }
    return { provider, providers };
  } catch (error) {
    // Missing or corrupted file - return null so the user can reconfigure
    return null;
  }
}

// The active provider's settings
export function getConfig(): Config | null {
  const store = loadStore();
  if (!store) return null;
  const settings = store.providers[store.provider];
  return { provider: store.provider, apiKey: settings?.apiKey || '', model: settings?.model };
}

// Save one provider's settings and make it active; other providers are kept
export function saveConfig(config: Config): boolean {
  try {
    if (!config || typeof config !== 'object') {
      throw new ValidationError('Invalid configuration object');
    }
    if (!validateApiKey(config.apiKey)) {
      throw new ValidationError('Invalid API key format', 'apiKey');
    }
    const provider = config.provider ? normalizeProvider(config.provider) : DEFAULT_PROVIDER;
    if (!provider) {
      throw new ValidationError('Invalid provider', 'provider');
    }

    const store: ConfigStore = {
      provider,
      providers: {
        ...loadStore()?.providers,
        [provider]: { apiKey: config.apiKey, model: config.model }
      }
    };

    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: CONSTANTS.CONFIG_DIR_PERMISSIONS });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(store, null, 2), {
      mode: CONSTANTS.CONFIG_FILE_PERMISSIONS
    });
    // mode only applies to new files
    fs.chmodSync(CONFIG_FILE, CONSTANTS.CONFIG_FILE_PERMISSIONS);

    return true;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    const err = error as Error;
    throw new ConfigError(`Failed to save config: ${err.message}`, err);
  }
}

// Check if we have valid config
export function hasConfig(): boolean {
  return validateApiKey(getConfig()?.apiKey);
}

// Get configured provider from env or config
export function getProvider(): ProviderId {
  const envProvider = normalizeProvider(process.env.GCM_PROVIDER);
  if (envProvider) {
    return envProvider;
  }

  const store = loadStore();
  if (store) {
    return store.provider;
  }

  const providerWithEnvKey = getProviderIds().find((providerId) => {
    return Boolean(process.env[getProviderDefinition(providerId).apiKeyEnvVar]);
  });

  return providerWithEnvKey || DEFAULT_PROVIDER;
}

// Get API key from config or env var
export function getApiKey(provider: ProviderId = getProvider()): string | null {
  return loadStore()?.providers[provider]?.apiKey ||
    process.env[getProviderDefinition(provider).apiKeyEnvVar] ||
    null;
}

// Check if an API key is available from config or env
export function hasApiKey(provider: ProviderId = getProvider()): boolean {
  return validateApiKey(getApiKey(provider));
}

// Get model from env, config, or use default
export function getModel(defaultModel: string, provider: ProviderId = getProvider()): string {
  return process.env[getProviderDefinition(provider).modelEnvVar] ||
    process.env.GCM_MODEL ||
    loadStore()?.providers[provider]?.model ||
    defaultModel;
}

// Every stored provider, with masked keys
export function displayConfig(): DisplayConfig {
  const store = loadStore();
  const entries = getProviderIds()
    .filter((id) => store?.providers[id]?.apiKey)
    .map((id) => {
      const settings = store!.providers[id]!;
      return {
        id,
        name: getProviderDefinition(id).name,
        apiKey: maskString(settings.apiKey),
        model: settings.model || 'default',
        active: store!.provider === id
      };
    });
  return { hasConfig: entries.length > 0, entries };
}

// Delete config file
export function clearConfig(): boolean {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      fs.unlinkSync(CONFIG_FILE);
      return true;
    }
    return false;
  } catch (error) {
    const err = error as Error;
    throw new ConfigError(`Failed to clear config: ${err.message}`, err);
  }
}

export { CONFIG_FILE, CONFIG_DIR };
