// App-wide constants and config
export const CONSTANTS = {
  // Git operations
  MAX_DIFF_SIZE: 50000, // ~50KB of diff content
  MAX_FILES_FOR_DIFF: 20,
  MAX_FILE_SAMPLES: 10,
  MAX_FILE_LIST_DISPLAY: 30,
  
  // API configuration
  DEFAULT_MODELS: [
    'gemini-3-flash-preview',
    'gemini-3-pro-preview',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-pro'
  ] as const,
  
  // Retry configuration
  API_RETRY_ATTEMPTS: 3,
  API_RETRY_DELAY: 1000, // ms
  API_RETRY_BACKOFF: 2,
  
  // Git buffer
  GIT_BUFFER_SIZE: 10 * 1024 * 1024, // 10MB
  
  // Message formatting
  MAX_SUBJECT_LENGTH: 72,
  MAX_BODY_LINE_LENGTH: 72,
  
  // Config
  CONFIG_DIR_NAME: '.gcm',
  CONFIG_FILE_NAME: 'config.json',
  CONFIG_DIR_PERMISSIONS: 0o700,
  CONFIG_FILE_PERMISSIONS: 0o600,
  
  // URLs
  GEMINI_API_KEY_URL: 'https://aistudio.google.com/apikey',
} as const;

export default CONSTANTS;
