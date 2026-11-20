import { describe, expect, it } from 'vitest';
import { diffWords, getFilePath, parseDiff, toSplitRows } from './diff-file-analyzer.service';

const GIT_DIFF = [
  'diff --git a/src/app.ts b/src/app.ts',
  'index 83db48f..bf269f4 100644',
  '--- a/src/app.ts',
  '+++ b/src/app.ts',
  '@@ -1,4 +1,5 @@ export function main() {',
  ' const a = 1;',
  '-const b = 2;',
  '+const b = 3;',
  '+const c = 4;',
  '',
  ' console.log(a);',
  '\\ No newline at end of file',
  'diff --git a/new.txt b/new.txt',
  'new file mode 100644',
  'index 0000000..e69de29',
  '--- /dev/null',
  '+++ b/new.txt',
  '@@ -0,0 +1 @@',
  '+hello',
  'diff --git a/old.txt b/old.txt',
  'deleted file mode 100644',
  '--- a/old.txt',
  '+++ /dev/null',
  '@@ -1,2 +0,0 @@',
  '--- not a header',
  '-bye',
  'diff --git a/a.md b/b.md',
  'similarity index 100%',
  'rename from a.md',
  'rename to b.md',
  'diff --git a/logo.png b/logo.png',
  'Binary files a/logo.png and b/logo.png differ',
].join('\n');

describe('diff-file-analyzer', () => {
  describe('parseDiff', () => {
    it('reads the files, their status and their stats from a git diff', () => {
      const files = parseDiff(GIT_DIFF);

      expect(files.map(({ oldPath, newPath, status, additions, deletions }) => ({ oldPath, newPath, status, additions, deletions }))).toEqual([
        { oldPath: 'src/app.ts', newPath: 'src/app.ts', status: 'modified', additions: 2, deletions: 1 },
        { oldPath: '/dev/null', newPath: 'new.txt', status: 'added', additions: 1, deletions: 0 },
        { oldPath: 'old.txt', newPath: '/dev/null', status: 'deleted', additions: 0, deletions: 2 },
        { oldPath: 'a.md', newPath: 'b.md', status: 'renamed', additions: 0, deletions: 0 },
        { oldPath: 'logo.png', newPath: 'logo.png', status: 'binary', additions: 0, deletions: 0 },
      ]);
    });

    it('numbers the lines, reads an empty line as context, and skips the no-newline marker', () => {
      const [file] = parseDiff(GIT_DIFF);

      expect(file.hunks[0].header).toBe('@@ -1,4 +1,5 @@ export function main() {');
      expect(file.hunks[0].lines.map(({ type, oldNumber, newNumber }) => [type, oldNumber, newNumber])).toEqual([
        ['context', 1, 1],
        ['delete', 2, null],
        ['add', null, 2],
        ['add', null, 3],
        ['context', 3, 4],
        ['context', 4, 5],
      ]);
    });

    it('reads a deleted line that looks like a file header as a deleted line', () => {
      expect(parseDiff(GIT_DIFF)[2].hunks[0].lines[0].segments[0].text).toBe('-- not a header');
    });

    it('reads `diff -u` output without git headers and with timestamps', () => {
      const files = parseDiff([
        '--- a.txt\t2024-01-02 10:00:00.000000000 +0100',
        '+++ b.txt\t2024-01-02 10:01:00.000000000 +0100',
        '@@ -1 +1 @@',
        '-x',
        '+y',
        '--- c.txt',
        '+++ c.txt',
        '@@ -1 +1,2 @@',
        ' z',
        '+w',
      ].join('\n'));

      expect(files.map(({ oldPath, newPath, status }) => [oldPath, newPath, status])).toEqual([
        ['a.txt', 'b.txt', 'renamed'],
        ['c.txt', 'c.txt', 'modified'],
      ]);
    });

    it('skips the mail headers and the message of a format-patch file', () => {
      const files = parseDiff([
        'From 1234 Mon Sep 17 00:00:00 2001',
        'Subject: [PATCH] Fix it',
        '',
        '---',
        ' a.txt | 2 +-',
        '',
        'diff --git a/a.txt b/a.txt',
        '--- a/a.txt',
        '+++ b/a.txt',
        '@@ -1 +1 @@',
        '-x',
        '+y',
        '-- ',
        '2.43.0',
      ].join('\n'));

      expect(files).toHaveLength(1);
      expect(files[0].hunks[0].lines).toHaveLength(2);
    });

    it('reads a normal diff, the output of diff without -u', () => {
      const [file, ...others] = parseDiff([
        '5c5',
        '< old title',
        '---',
        '> new title',
        '7,8c7,9',
        '< a',
        '<',
        '---',
        '> x',
        '> y',
        '> z',
        '10a12',
        '> added',
        '12,13d13',
        '< gone',
        '< ---',
      ].join('\n'));

      expect(others).toEqual([]);
      expect(file).toMatchObject({ oldPath: '', newPath: '', status: 'modified', additions: 5, deletions: 5 });
      expect(file.hunks.map(({ header }) => header)).toEqual(['5c5', '7,8c7,9', '10a12', '12,13d13']);
      expect(file.hunks[1].lines.map(({ type, oldNumber, newNumber, segments }) => [type, oldNumber, newNumber, segments.map(({ text }) => text).join('')])).toEqual([
        ['delete', 7, null, 'a'],
        ['delete', 8, null, ''],
        ['add', null, 7, 'x'],
        ['add', null, 8, 'y'],
        ['add', null, 9, 'z'],
      ]);
      expect(file.hunks[3].lines.map(({ segments }) => segments[0].text)).toEqual(['gone', '---']);
    });

    it('returns no files for a text that is not a diff', () => {
      expect(parseDiff('hello\nworld')).toEqual([]);
    });
  });

  describe('word-level changes', () => {
    it('marks the changed words of a paired line', () => {
      const [file] = parseDiff(GIT_DIFF);
      const [, deleted, added] = file.hunks[0].lines;

      expect(deleted.segments).toEqual([{ text: 'const b = ', changed: false }, { text: '2', changed: true }, { text: ';', changed: false }]);
      expect(added.segments).toEqual([{ text: 'const b = ', changed: false }, { text: '3', changed: true }, { text: ';', changed: false }]);
    });

    it('marks nothing when the lines have nothing in common', () => {
      expect(diffWords('abc', 'xyz')).toEqual({ old: [{ text: 'abc', changed: false }], new: [{ text: 'xyz', changed: false }] });
      expect(diffWords('self host it', 'build and run')).toEqual({ old: [{ text: 'self host it', changed: false }], new: [{ text: 'build and run', changed: false }] });
    });
  });

  describe('toSplitRows', () => {
    it('pairs the deleted and added lines and keeps the context on both sides', () => {
      const [file] = parseDiff(GIT_DIFF);
      const rows = toSplitRows(file.hunks[0].lines);

      expect(rows.map(({ left, right }) => [left?.oldNumber ?? null, right?.newNumber ?? null])).toEqual([
        [1, 1],
        [2, 2],
        [null, 3],
        [3, 4],
        [4, 5],
      ]);
    });
  });

  describe('getFilePath', () => {
    it('returns the old path of a deleted file and the new path of the others', () => {
      const files = parseDiff(GIT_DIFF);
      expect(files.map(getFilePath)).toEqual(['src/app.ts', 'new.txt', 'old.txt', 'b.md', 'logo.png']);
    });
  });
});
