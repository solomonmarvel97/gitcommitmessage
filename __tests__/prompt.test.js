const { toAction } = require('../dist/lib/prompt');

// Single keys as a terminal in raw mode delivers them
describe('menu keys', () => {
  test.each([
    ['\r', 'commit'], ['e', 'edit'], ['r', 'regenerate'], ['R', 'regenerate'],
    ['q', 'quit'], ['\u0003', 'quit'], ['\u0004', 'quit'], ['\u001b', 'quit'],
    ['x', null], [' ', null]
  ])('%j means %s', (key, action) => {
    expect(toAction(key)).toBe(action);
  });
});
