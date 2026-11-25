// Runs before every test file: nothing may touch the real home folder
jest.mock('os', () => {
  const actual = jest.requireActual('os');
  const fs = jest.requireActual('fs');
  const path = jest.requireActual('path');
  const home = fs.mkdtempSync(path.join(actual.tmpdir(), 'gcm-test-'));
  return { ...actual, homedir: () => home };
});

afterAll(() => {
  require('fs').rmSync(require('os').homedir(), { recursive: true, force: true });
});
