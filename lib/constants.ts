// App-wide constants and config
export const CONSTANTS = {
  // Git operations
  MAX_DIFF_SIZE: 50000, // ~50KB of diff content
  MAX_FILES_FOR_DIFF: 20,
  MAX_FILE_SAMPLES: 10,
  MAX_FILE_LIST_DISPLAY: 30,
  
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

} as const;

export default CONSTANTS;
