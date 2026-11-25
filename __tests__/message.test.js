const { parseStatus, buildSimpleMessage, getChangedFiles } = require('../dist/lib/message');

describe('message', () => {
  describe('parseStatus', () => {
    test('parses branch information', () => {
      const output = '# branch.head main\n';
      const result = parseStatus(output);
      expect(result.branch).toBe('main');
    });

    test('parses ahead/behind status', () => {
      const output = '# branch.ab +2 -1\n';
      const result = parseStatus(output);
      expect(result.ahead).toBe(2);
      expect(result.behind).toBe(1);
    });

    test('parses file changes', () => {
      const output = '1 A. N... 100644 100644 100644 0000000000000000000000000000000000000000 abc123 file.txt\n';
      const result = parseStatus(output);
      expect(result.staged.added).toBe(1);
      expect(result.samples.added).toContain('file.txt');
    });

    test('parses renames as old -> new, including paths with spaces', () => {
      const output = '2 R. N... 100644 100644 100644 abc123 abc123 R100 new name.txt\told name.txt\n';
      const result = parseStatus(output);
      expect(result.staged.renamed).toBe(1);
      expect(result.samples.renamed).toEqual(['old name.txt -> new name.txt']);
    });

    test('lists only staged files when stagedOnly is set', () => {
      const output = [
        '1 M. N... 100644 100644 100644 abc123 def456 staged.txt',
        '1 .M N... 100644 100644 100644 abc123 abc123 unstaged.txt',
        '1 .D N... 100644 100644 000000 abc123 abc123 removed.txt'
      ].join('\n');
      const result = parseStatus(output, true);
      expect(result.samples.modified).toEqual(['staged.txt']);
      expect(result.samples.deleted).toEqual([]);
    });

    test('parses untracked files', () => {
      const output = '? untracked.txt\n';
      const result = parseStatus(output);
      expect(result.untracked).toBe(1);
      expect(result.samples.untracked).toContain('untracked.txt');
    });
  });

  describe('buildSimpleMessage', () => {
    test('builds message for staged changes', () => {
      const summary = {
        branch: 'main',
        ahead: 0,
        behind: 0,
        staged: { added: 2, modified: 1, deleted: 0, renamed: 0, copied: 0 },
        unstaged: { modified: 0, deleted: 0 },
        untracked: 0,
        conflicts: 0,
        samples: {
          added: ['file1.js', 'file2.js'],
          modified: ['file3.js'],
          deleted: [],
          renamed: [],
          untracked: []
        }
      };
      const message = buildSimpleMessage(summary, { stagedOnly: true });
      expect(message).toContain('2 added');
      expect(message).toContain('1 modified');
      expect(message).toContain('on main');
    });

    test('handles no changes', () => {
      const summary = {
        branch: 'main',
        ahead: 0,
        behind: 0,
        staged: { added: 0, modified: 0, deleted: 0, renamed: 0, copied: 0 },
        unstaged: { modified: 0, deleted: 0 },
        untracked: 0,
        conflicts: 0,
        samples: { added: [], modified: [], deleted: [], renamed: [], untracked: [] }
      };
      const message = buildSimpleMessage(summary, {});
      expect(message).toContain('no changes');
    });
  });

  describe('getChangedFiles', () => {
    test('returns list of changed files', () => {
      const summary = {
        samples: {
          added: ['file1.js'],
          modified: ['file2.js'],
          deleted: ['file3.js'],
          renamed: ['old.js -> new.js'],
          untracked: ['file4.js']
        }
      };
      const files = getChangedFiles(summary, false);
      expect(files).toContain('file1.js');
      expect(files).toContain('file2.js');
      expect(files).toContain('file3.js');
      expect(files).toContain('file4.js');
      expect(files).toContain('old.js');
      expect(files).toContain('new.js');
    });
  });
});
