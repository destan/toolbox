export type DiffLineType = 'context' | 'add' | 'delete';
export type DiffFileStatus = 'added' | 'deleted' | 'renamed' | 'modified' | 'binary';

export interface DiffSegment {
  text: string
  changed: boolean
}

export interface DiffLine {
  type: DiffLineType
  oldNumber: number | null
  newNumber: number | null
  segments: DiffSegment[]
}

export interface DiffHunk {
  header: string
  lines: DiffLine[]
}

export interface DiffFile {
  oldPath: string
  newPath: string
  status: DiffFileStatus
  additions: number
  deletions: number
  hunks: DiffHunk[]
}

export interface SplitRow {
  left: DiffLine | null
  right: DiffLine | null
}

// Longer lines skip the word-level diff, because its cost grows with the product of the token counts.
const MAX_WORD_DIFF_TOKENS = 400;
const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@ ?(.*)$/;
const NORMAL_COMMAND = /^(\d+)(?:,(\d+))?([acd])(\d+)(?:,(\d+))?$/;
const NULL_PATH = '/dev/null';

function cleanPath(path: string): string {
  // `diff -u` puts a tab and a timestamp after the path.
  const withoutTimestamp = path.split('\t')[0].trim();
  return withoutTimestamp === NULL_PATH ? NULL_PATH : withoutTimestamp.replace(/^[ab]\//, '');
}

function createFile(oldPath = '', newPath = ''): DiffFile {
  return { oldPath, newPath, status: 'modified', additions: 0, deletions: 0, hunks: [] };
}

// Text outside a file or a hunk is skipped, such as the mail headers and the message of a `git format-patch` file.
export function parseDiff(text: string): DiffFile[] {
  const files: DiffFile[] = [];
  let file: DiffFile | undefined;
  let hunk: DiffHunk | undefined;
  let oldLeft = 0;
  let newLeft = 0;
  let oldNumber = 0;
  let newNumber = 0;
  let normalFile: DiffFile | undefined;
  let isNormalHunk = false;

  for (const line of text.split(/\r?\n/)) {
    if (hunk && (oldLeft > 0 || newLeft > 0)) {
      // A normal diff marks the lines with `<` and `>`, and puts a `---` line between the old and the new lines.
      if (isNormalHunk && line === '---') {
        continue;
      }
      const marker = isNormalHunk ? (line[0] === '<' ? '-' : line[0] === '>' ? '+' : undefined) : line[0] ?? ' ';
      const content = line.slice(isNormalHunk ? 2 : 1);

      if (marker === '\\') {
        continue;
      }
      if (marker === '+') {
        hunk.lines.push({ type: 'add', oldNumber: null, newNumber: newNumber++, segments: [{ text: content, changed: false }] });
        newLeft--;
        continue;
      }
      if (marker === '-') {
        hunk.lines.push({ type: 'delete', oldNumber: oldNumber++, newNumber: null, segments: [{ text: content, changed: false }] });
        oldLeft--;
        continue;
      }
      if (marker === ' ') {
        hunk.lines.push({ type: 'context', oldNumber: oldNumber++, newNumber: newNumber++, segments: [{ text: content, changed: false }] });
        oldLeft--;
        newLeft--;
        continue;
      }
    }
    hunk = undefined;

    const gitHeader = line.match(/^diff --git a\/(.*) b\/(.*)$/);
    if (gitHeader) {
      file = createFile(gitHeader[1], gitHeader[2]);
      files.push(file);
      continue;
    }

    if (line.startsWith('--- ')) {
      // Without `diff --git` lines, as in `diff -u` output, each `---` line starts a new file.
      if (!file || file.hunks.length > 0) {
        file = createFile();
        files.push(file);
      }
      file.oldPath = cleanPath(line.slice(4));
      continue;
    }

    // A normal diff, the output of `diff` without `-u`, has no file names. Its commands are not mixed with unified files.
    const normalCommand = line.match(NORMAL_COMMAND);
    if (normalCommand && (!file || file === normalFile)) {
      if (!file) {
        file = normalFile = createFile();
        files.push(file);
      }
      const [, oldStart, oldEnd = oldStart, action, newStart, newEnd = newStart] = normalCommand;
      oldNumber = Number(oldStart);
      newNumber = Number(newStart);
      oldLeft = action === 'a' ? 0 : Number(oldEnd) - oldNumber + 1;
      newLeft = action === 'd' ? 0 : Number(newEnd) - newNumber + 1;
      hunk = { header: line, lines: [] };
      file.hunks.push(hunk);
      isNormalHunk = true;
      continue;
    }

    if (!file) {
      continue;
    }

    const hunkHeader = line.match(HUNK_HEADER);
    if (hunkHeader) {
      isNormalHunk = false;
      oldNumber = Number(hunkHeader[1]);
      newNumber = Number(hunkHeader[3]);
      oldLeft = hunkHeader[2] === undefined ? 1 : Number(hunkHeader[2]);
      newLeft = hunkHeader[4] === undefined ? 1 : Number(hunkHeader[4]);
      hunk = { header: line, lines: [] };
      file.hunks.push(hunk);
    }
    else if (line.startsWith('+++ ')) {
      file.newPath = cleanPath(line.slice(4));
    }
    else if (line.startsWith('rename from ')) {
      file.oldPath = line.slice('rename from '.length);
    }
    else if (line.startsWith('rename to ')) {
      file.newPath = line.slice('rename to '.length);
    }
    else if (line.startsWith('new file mode')) {
      file.oldPath = NULL_PATH;
    }
    else if (line.startsWith('deleted file mode')) {
      file.newPath = NULL_PATH;
    }
    else if (line.startsWith('Binary files ') || line === 'GIT binary patch') {
      file.status = 'binary';
    }
  }

  return files.map(finalizeFile);
}

function finalizeFile(file: DiffFile): DiffFile {
  const lines = file.hunks.flatMap(({ lines }) => lines);
  const status = file.status === 'binary'
    ? 'binary'
    : file.oldPath === NULL_PATH
      ? 'added'
      : file.newPath === NULL_PATH
        ? 'deleted'
        : file.oldPath !== file.newPath ? 'renamed' : 'modified';

  file.hunks.forEach(({ lines }) => markChangedWords(lines));

  return {
    ...file,
    status,
    additions: lines.filter(({ type }) => type === 'add').length,
    deletions: lines.filter(({ type }) => type === 'delete').length,
  };
}

export function getFilePath(file: DiffFile): string {
  return file.newPath === NULL_PATH ? file.oldPath : file.newPath;
}

// A run of deleted lines and the run of added lines after it form a change block.
function getChangeBlocks(lines: DiffLine[]): { deleted: DiffLine[]; added: DiffLine[] }[] {
  const blocks: { deleted: DiffLine[]; added: DiffLine[] }[] = [];
  let index = 0;

  while (index < lines.length) {
    if (lines[index].type === 'context') {
      index++;
      continue;
    }

    const block = { deleted: [] as DiffLine[], added: [] as DiffLine[] };
    while (lines[index]?.type === 'delete') {
      block.deleted.push(lines[index++]);
    }
    while (lines[index]?.type === 'add') {
      block.added.push(lines[index++]);
    }
    blocks.push(block);
  }

  return blocks;
}

// The n-th deleted line of a block pairs with its n-th added line.
function markChangedWords(lines: DiffLine[]) {
  for (const { deleted, added } of getChangeBlocks(lines)) {
    for (let i = 0; i < Math.min(deleted.length, added.length); i++) {
      const words = diffWords(deleted[i].segments[0].text, added[i].segments[0].text);
      deleted[i].segments = words.old;
      added[i].segments = words.new;
    }
  }
}

export function toSplitRows(lines: DiffLine[]): SplitRow[] {
  const rows: SplitRow[] = [];
  let index = 0;

  while (index < lines.length) {
    if (lines[index].type === 'context') {
      rows.push({ left: lines[index], right: lines[index] });
      index++;
      continue;
    }

    const deleted: DiffLine[] = [];
    const added: DiffLine[] = [];
    while (lines[index]?.type === 'delete') {
      deleted.push(lines[index++]);
    }
    while (lines[index]?.type === 'add') {
      added.push(lines[index++]);
    }
    for (let i = 0; i < Math.max(deleted.length, added.length); i++) {
      rows.push({ left: deleted[i] ?? null, right: added[i] ?? null });
    }
  }

  return rows;
}

function tokenize(text: string): string[] {
  return text.match(/\w+|\s+|[^\w\s]/g) ?? [];
}

function toSegments(tokens: string[], changed: boolean[]): DiffSegment[] {
  const segments: DiffSegment[] = [];

  tokens.forEach((token, index) => {
    const last = segments.at(-1);
    if (last && last.changed === changed[index]) {
      last.text += token;
    }
    else {
      segments.push({ text: token, changed: changed[index] });
    }
  });

  return segments;
}

// A longest common subsequence of the tokens. The tokens out of it are the changed words.
export function diffWords(oldText: string, newText: string): { old: DiffSegment[]; new: DiffSegment[] } {
  const oldTokens = tokenize(oldText);
  const newTokens = tokenize(newText);

  if (oldTokens.length * newTokens.length > MAX_WORD_DIFF_TOKENS ** 2) {
    return { old: [{ text: oldText, changed: false }], new: [{ text: newText, changed: false }] };
  }

  const lengths = Array.from({ length: oldTokens.length + 1 }, () => Array.from<number>({ length: newTokens.length + 1 }).fill(0));
  for (let i = oldTokens.length - 1; i >= 0; i--) {
    for (let j = newTokens.length - 1; j >= 0; j--) {
      lengths[i][j] = oldTokens[i] === newTokens[j] ? lengths[i + 1][j + 1] + 1 : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
    }
  }

  const oldChanged = Array.from<boolean>({ length: oldTokens.length }).fill(true);
  const newChanged = Array.from<boolean>({ length: newTokens.length }).fill(true);
  let i = 0;
  let j = 0;
  while (i < oldTokens.length && j < newTokens.length) {
    if (oldTokens[i] === newTokens[j]) {
      oldChanged[i++] = false;
      newChanged[j++] = false;
    }
    else if (lengths[i + 1][j] >= lengths[i][j + 1]) {
      i++;
    }
    else {
      j++;
    }
  }

  // With nothing but whitespace in common, the line color tells enough, and marking every word only adds noise.
  if (!oldTokens.some((token, index) => !oldChanged[index] && token.trim() !== '')) {
    return { old: [{ text: oldText, changed: false }], new: [{ text: newText, changed: false }] };
  }

  return { old: toSegments(oldTokens, oldChanged), new: toSegments(newTokens, newChanged) };
}
