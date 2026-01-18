const { validateApiKey, maskString, plural, truncate } = require('../lib/utils');

describe('utils', () => {
  describe('validateApiKey', () => {
    test('validates correct API key format', () => {
      expect(validateApiKey('AIzaSyDummyKey12345678901234567890')).toBe(true);
      expect(validateApiKey('a'.repeat(30))).toBe(true);
    });

    test('rejects invalid API keys', () => {
      expect(validateApiKey('')).toBe(false);
      expect(validateApiKey(null)).toBe(false);
      expect(validateApiKey(undefined)).toBe(false);
      expect(validateApiKey('short')).toBe(false);
      expect(validateApiKey('a'.repeat(300))).toBe(false);
    });
  });

  describe('maskString', () => {
    test('masks strings correctly', () => {
      expect(maskString('AIzaSyDummyKey12345678901234567890')).toBe('AIzaSyDu...7890');
      expect(maskString('short')).toBe('***');
    });

    test('handles edge cases', () => {
      expect(maskString('')).toBe('***');
      expect(maskString(null)).toBe('***');
    });
  });

  describe('plural', () => {
    test('handles singular', () => {
      expect(plural(1, 'file')).toBe('1 file');
    });

    test('handles plural', () => {
      expect(plural(2, 'file')).toBe('2 files');
      expect(plural(0, 'file')).toBe('0 files');
    });
  });

  describe('truncate', () => {
    test('truncates long strings', () => {
      expect(truncate('a'.repeat(100), 50)).toBe('a'.repeat(47) + '...');
    });

    test('does not truncate short strings', () => {
      expect(truncate('short', 50)).toBe('short');
    });
  });
});
