// Cache commit messages based on diff content

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import CONSTANTS from './constants';

interface CacheData {
  message: string;
  timestamp: number;
  diffHash: string;
}

const CACHE_DIR = path.join(os.homedir(), CONSTANTS.CONFIG_DIR_NAME, 'cache');
const CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

// Hash diff content to create cache key
function generateCacheKey(diff: string): string {
  return crypto.createHash('sha256').update(diff).digest('hex');
}

// Get path for cache file
function getCachePath(key: string): string {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true, mode: 0o700 });
  }
  return path.join(CACHE_DIR, `${key}.json`);
}

// Get cached message if it exists and isn't expired
export function getCachedMessage(diff: string): string | null {
  try {
    const key = generateCacheKey(diff);
    const cachePath = getCachePath(key);

    if (!fs.existsSync(cachePath)) {
      return null;
    }

    const cacheData = JSON.parse(fs.readFileSync(cachePath, 'utf8')) as CacheData;
    const age = Date.now() - cacheData.timestamp;

    // Expired? Delete it
    if (age > CACHE_MAX_AGE) {
      fs.unlinkSync(cachePath);
      return null;
    }

    return cacheData.message;
  } catch (error) {
    // Cache read failed, just return null
    return null;
  }
}

// Save message to cache
export function cacheMessage(diff: string, message: string): void {
  try {
    const key = generateCacheKey(diff);
    const cachePath = getCachePath(key);

    const cacheData: CacheData = {
      message: message,
      timestamp: Date.now(),
      diffHash: key
    };

    fs.writeFileSync(cachePath, JSON.stringify(cacheData, null, 2), { mode: 0o600 });
  } catch (error) {
    // Cache write failed - not critical, just continue
  }
}

// Remove expired cache files
export function clearOldCache(): void {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      return;
    }

    const files = fs.readdirSync(CACHE_DIR);
    const now = Date.now();

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const filePath = path.join(CACHE_DIR, file);
      try {
        const cacheData = JSON.parse(fs.readFileSync(filePath, 'utf8')) as CacheData;
        const age = now - cacheData.timestamp;

        if (age > CACHE_MAX_AGE) {
          fs.unlinkSync(filePath);
        }
      } catch (error) {
        // Corrupted file? Delete it
        fs.unlinkSync(filePath);
      }
    }
  } catch (error) {
    // Cleanup failed, not a big deal
  }
}

// Delete all cache files
export function clearAllCache(): void {
  try {
    if (fs.existsSync(CACHE_DIR)) {
      const files = fs.readdirSync(CACHE_DIR);
      for (const file of files) {
        fs.unlinkSync(path.join(CACHE_DIR, file));
      }
    }
  } catch (error) {
    // Ignore errors
  }
}

// Clean up old entries when module loads
clearOldCache();
