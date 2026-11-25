const Logger = require('../dist/lib/logger').default || require('../dist/lib/logger');

describe('Logger', () => {
  let consoleErrorSpy;
  let consoleLogSpy;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  test('logs error messages', () => {
    const logger = new Logger('ERROR');
    logger.error('Test error');
    expect(consoleErrorSpy).toHaveBeenCalledWith('ERROR:', 'Test error');
  });

  test('logs warn messages', () => {
    const logger = new Logger('WARN');
    logger.warn('Test warning');
    expect(consoleErrorSpy).toHaveBeenCalledWith('WARN:', 'Test warning');
  });

  test('logs info messages', () => {
    const logger = new Logger('INFO');
    logger.info('Test info');
    expect(consoleErrorSpy).toHaveBeenCalledWith('Test info');
  });

  test('logs debug messages in verbose mode', () => {
    const logger = new Logger('INFO', true);
    logger.debug('Test debug');
    expect(consoleErrorSpy).toHaveBeenCalledWith('DEBUG:', 'Test debug');
  });

  test('ERROR level logs errors only', () => {
    const logger = new Logger('ERROR');
    logger.warn('w');
    logger.info('i');
    logger.debug('d');
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    logger.error('e');
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
  });

  test('an unknown level behaves like INFO', () => {
    const logger = new Logger('nonsense');
    logger.debug('d');
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    logger.info('i');
    expect(consoleErrorSpy).toHaveBeenCalledWith('i');
  });
});
