// Config management - handles API keys and settings

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ConfigError, ValidationError } from './errors';
import { validateApiKey, maskString } from './utils';
import CONSTANTS from './constants';

export interface Config {
  apiKey: string;
  model?: string;
}

export interface DisplayConfig {
  hasConfig: boolean;
  apiKey?: string;
  model?: string;
}

const CONFIG_DIR = path.join(os.homedir(), CONSTANTS.CONFIG_DIR_NAME);
const CONFIG_FILE = path.join(CONFIG_DIR, CONSTANTS.CONFIG_FILE_NAME);

// Load config from file
export function getConfig(): Config | null {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const content = fs.readFileSync(CONFIG_FILE, 'utf8');
      const config = JSON.parse(content) as Config;
      
      if (config && typeof config === 'object') {
        return config;
      }
    }
  } catch (error) {
    // Corrupted file - return null so user can reconfigure
    if (error instanceof SyntaxError) {
      return null;
    }
  }
  return null;
}

// Save config to file with secure permissions
export function saveConfig(config: Config): boolean {
  try {
    if (!config || typeof config !== 'object') {
      throw new ValidationError('Invalid configuration object');
    }
    
    if (config.apiKey && !validateApiKey(config.apiKey)) {
      throw new ValidationError('Invalid API key format', 'apiKey');
    }
    
    // Create config dir if needed
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, {
        recursive: true,
        mode: CONSTANTS.CONFIG_DIR_PERMISSIONS
      });
    }
    
    // Write with restricted permissions
    fs.writeFileSync(
      CONFIG_FILE,
      JSON.stringify(config, null, 2),
      { mode: CONSTANTS.CONFIG_FILE_PERMISSIONS }
    );
    
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
  const config = getConfig();
  return config !== null && config.apiKey !== undefined && validateApiKey(config.apiKey);
}

// Get API key from config or env var
export function getApiKey(): string | null {
  const config = getConfig();
  return config?.apiKey || process.env.GEMINI_API_KEY || null;
}

// Get model from config, env, or use default
export function getModel(defaultModel: string): string {
  const config = getConfig();
  return config?.model || process.env.GEMINI_MODEL || defaultModel;
}

// Get config for display (with masked API key)
export function displayConfig(): DisplayConfig {
  const config = getConfig();
  if (hasConfig() && config) {
    const maskedKey = maskString(config.apiKey);
    return {
      hasConfig: true,
      apiKey: maskedKey,
      model: config.model || 'default',
    };
  }
  return { hasConfig: false };
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
