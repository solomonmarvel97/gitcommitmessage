const { GCMError, ConfigError, GitError, APIError, ValidationError } = require('../lib/errors');

describe('errors', () => {
  describe('GCMError', () => {
    test('creates error with message and code', () => {
      const error = new GCMError('Test error', 'TEST_CODE');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('GCMError');
    });

    test('includes cause', () => {
      const cause = new Error('Original error');
      const error = new GCMError('Test error', 'TEST_CODE', cause);
      expect(error.cause).toBe(cause);
    });
  });

  describe('ConfigError', () => {
    test('creates config error', () => {
      const error = new ConfigError('Config error');
      expect(error.code).toBe('CONFIG_ERROR');
      expect(error.message).toBe('Config error');
    });
  });

  describe('GitError', () => {
    test('creates git error', () => {
      const error = new GitError('Git error');
      expect(error.code).toBe('GIT_ERROR');
      expect(error.message).toBe('Git error');
    });
  });

  describe('APIError', () => {
    test('creates API error with custom code', () => {
      const error = new APIError('API error', 'CUSTOM_CODE');
      expect(error.code).toBe('CUSTOM_CODE');
      expect(error.message).toBe('API error');
    });

    test('uses default code if not provided', () => {
      const error = new APIError('API error');
      expect(error.code).toBe('API_ERROR');
    });
  });

  describe('ValidationError', () => {
    test('creates validation error with field', () => {
      const error = new ValidationError('Invalid input', 'apiKey');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.field).toBe('apiKey');
    });
  });
});
