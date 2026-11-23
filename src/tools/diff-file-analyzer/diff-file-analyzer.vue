<script setup lang="ts">
import type { DiffFile, DiffFileStatus, DiffSegment } from './diff-file-analyzer.service';
import hljs from 'highlight.js/lib/common';
import _ from 'lodash';
import { useStyleStore } from '@/stores/style.store';
import { getFilePath, parseDiff, toSplitRows } from './diff-file-analyzer.service';

const INPUT_DEBOUNCE_MS = 200;
const FILE_LIST_LIMIT = 10;
const STATUS_TAG_TYPES: Record<DiffFileStatus, 'success' | 'error' | 'info' | 'warning' | 'default'> = {
  added: 'success',
  deleted: 'error',
  renamed: 'info',
  binary: 'warning',
  modified: 'default',
};

const styleStore = useStyleStore();
const input = ref('');
// Debouncing keeps the parser and the re-render out of the keystroke path for large pastes.
const debouncedInput = refDebounced(input, INPUT_DEBOUNCE_MS);
const view = ref<'split' | 'unified'>('split');
const collapsed = ref(new Set<number>());
const read = ref(new Set<number>());
const isFileListExpanded = ref(false);

const files = computed(() => parseDiff(debouncedInput.value));
const totals = computed(() => ({
  additions: _.sumBy(files.value, 'additions'),
  deletions: _.sumBy(files.value, 'deletions'),
}));
const areAllCollapsed = computed(() => collapsed.value.size === files.value.length);

function getLanguage(path: string) {
  const extension = path.split('.').pop()?.toLowerCase() ?? '';
  return path.includes('.') && hljs.getLanguage(extension) ? extension : undefined;
}

// highlight.js escapes the HTML, so its output is safe for v-html. Each segment is highlighted alone, so a token
// that a word change cuts in two can lose its color.
function renderSegments(segments: DiffSegment[], language: string | undefined) {
  return segments
    .map(({ text, changed }) => {
      const html = language ? hljs.highlight(text, { language, ignoreIllegals: true }).value : _.escape(text);
      return changed ? `<span class="word-changed">${html}</span>` : html;
    })
    .join('');
}

const renderedFiles = computed(() => files.value.map((file) => {
  const language = getLanguage(getFilePath(file));
  const lines = file.hunks.flatMap(hunk => hunk.lines);

  return {
    file,
    html: new Map(lines.map(line => [line, renderSegments(line.segments, language)])),
    hunks: file.hunks.map(hunk => ({ ...hunk, rows: toSplitRows(hunk.lines) })),
  };
}));

const visibleFileList = computed(() => (isFileListExpanded.value ? renderedFiles.value : renderedFiles.value.slice(0, FILE_LIST_LIMIT)));

watch(files, () => {
  collapsed.value.clear();
  read.value.clear();
  isFileListExpanded.value = false;
});

function toggleFile(index: number) {
  if (!collapsed.value.delete(index)) {
    collapsed.value.add(index);
  }
}

function toggleAllFiles() {
  collapsed.value = areAllCollapsed.value ? new Set() : new Set(files.value.keys());
}

// As on GitHub, a file marked as read collapses, and a file unmarked expands again.
function setRead(index: number, isRead: boolean) {
  if (isRead) {
    read.value.add(index);
    collapsed.value.add(index);
  }
  else {
    read.value.delete(index);
    collapsed.value.delete(index);
  }
}

function scrollToFile(index: number) {
  collapsed.value.delete(index);
  document.getElementById(`diff-file-${index}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function getTitle(file: DiffFile) {
  return file.status === 'renamed' ? `${file.oldPath} → ${file.newPath}` : getFilePath(file) || 'Untitled';
}

async function onFileUpload(file: File) {
  input.value = await file.text();
}
</script>

<template>
  <div class="diff-file-analyzer" :class="{ 'is-dark': styleStore.isDarkTheme }" flex flex-col gap-4>
    <c-file-upload title="Drag and drop a .diff or .patch file here, or click to select a file" accept=".diff,.patch,text/x-diff,text/x-patch" @file-upload="onFileUpload" />

    <c-input-text
      v-model:value="input"
      label="Or paste the output of git diff, diff -u or git format-patch"
      placeholder="Paste a unified diff here..."
      multiline raw-text monospace
      rows="10"
      test-id="input"
    />

    <c-alert v-if="debouncedInput.trim() && !files.length">
      No diff found in the input.
    </c-alert>

    <template v-if="files.length">
      <c-card>
        <div mb-3 flex flex-wrap items-center justify-between gap-2>
          <div data-test-id="summary">
            <span font-bold>{{ files.length }} {{ files.length === 1 ? 'file' : 'files' }}</span>
            <span ml-2 class="additions">+{{ totals.additions }}</span>
            <span ml-2 class="deletions">−{{ totals.deletions }}</span>
            <span ml-3 op-70 data-test-id="read-count">{{ read.size }} / {{ files.length }} read</span>
          </div>
          <div flex flex-wrap items-center gap-2>
            <c-button size="small" data-test-id="toggle-all" @click="toggleAllFiles">
              {{ areAllCollapsed ? 'Expand all' : 'Collapse all' }}
            </c-button>
            <c-buttons-select v-model:value="view" :options="[{ label: 'Split', value: 'split' }, { label: 'Unified', value: 'unified' }]" size="small" data-test-id="view" />
          </div>
        </div>

        <ul class="file-list" data-test-id="file-list">
          <li v-for="({ file }, index) in visibleFileList" :key="index" :class="{ 'is-read': read.has(index) }">
            <button type="button" class="file-link" @click="scrollToFile(index)">
              <n-tag size="small" :type="STATUS_TAG_TYPES[file.status]" :bordered="false">
                {{ file.status }}
              </n-tag>
              <span min-w-0 flex-1 break-all text-left font-mono>{{ getTitle(file) }}</span>
              <icon-mdi-check v-if="read.has(index)" aria-label="Read" />
              <span class="additions">+{{ file.additions }}</span>
              <span class="deletions">−{{ file.deletions }}</span>
            </button>
          </li>
        </ul>

        <c-button v-if="files.length > FILE_LIST_LIMIT" variant="text" size="small" mt-2 data-test-id="toggle-file-list" @click="isFileListExpanded = !isFileListExpanded">
          {{ isFileListExpanded ? 'See less' : `See more (${files.length - FILE_LIST_LIMIT})` }}
        </c-button>
      </c-card>

      <c-card v-for="({ file, html, hunks }, index) in renderedFiles" :id="`diff-file-${index}`" :key="index" class="diff-file" data-test-id="diff-file">
        <div flex items-center gap-3>
          <button type="button" class="file-header" :aria-expanded="!collapsed.has(index)" @click="toggleFile(index)">
            <icon-mdi-triangle-down :class="{ 'transform-rotate--90': collapsed.has(index) }" op-50 transition />
            <span min-w-0 flex-1 break-all text-left font-bold font-mono>{{ getTitle(file) }}</span>
            <span class="additions">+{{ file.additions }}</span>
            <span class="deletions">−{{ file.deletions }}</span>
          </button>
          <n-checkbox :checked="read.has(index)" data-test-id="read" @update:checked="(isRead: boolean) => setRead(index, isRead)">
            Read
          </n-checkbox>
        </div>

        <div v-show="!collapsed.has(index)" mt-3>
          <div v-if="file.status === 'binary'" op-70>
            Binary file. The diff has no content to show.
          </div>
          <div v-else-if="!hunks.length" op-70>
            No content changes.
          </div>

          <div v-else class="diff-table-wrapper">
            <table class="diff-table" :class="view">
              <colgroup v-if="view === 'unified'">
                <col class="number-column">
                <col class="number-column">
                <col class="marker-column">
                <col>
              </colgroup>
              <colgroup v-else>
                <col class="number-column">
                <col>
                <col class="number-column">
                <col>
              </colgroup>
              <tbody v-for="(hunk, hunkIndex) in hunks" :key="hunkIndex">
                <tr class="hunk-header">
                  <td :colspan="4">
                    {{ hunk.header }}
                  </td>
                </tr>

                <template v-if="view === 'unified'">
                  <tr v-for="(line, lineIndex) in hunk.lines" :key="lineIndex" :class="line.type">
                    <td class="line-number">
                      {{ line.oldNumber ?? '' }}
                    </td>
                    <td class="line-number">
                      {{ line.newNumber ?? '' }}
                    </td>
                    <td class="marker">
                      {{ line.type === 'add' ? '+' : line.type === 'delete' ? '-' : ' ' }}
                    </td>
                    <td class="code" v-html="html.get(line)" />
                  </tr>
                </template>

                <template v-else>
                  <tr v-for="({ left, right }, rowIndex) in hunk.rows" :key="rowIndex">
                    <td class="line-number" :class="left ? left.type : 'empty'">
                      {{ left?.oldNumber ?? '' }}
                    </td>
                    <td class="code" :class="left ? left.type : 'empty'" v-html="left ? html.get(left) : ''" />
                    <td class="line-number" :class="right ? right.type : 'empty'">
                      {{ right?.newNumber ?? '' }}
                    </td>
                    <td class="code" :class="right ? right.type : 'empty'" v-html="right ? html.get(right) : ''" />
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
        </div>
      </c-card>
    </template>
  </div>
</template>

<style lang="less" scoped>
.diff-file-analyzer {
  flex: 1 1 100% !important;
  min-width: 0;
}

.additions {
  color: #1a7f37;
}

.deletions {
  color: #cf222e;
}

.file-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.file-link,
.file-header {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  border: none;
  background: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.file-header {
  flex: 1;
  min-width: 0;
}

.file-link:hover span.font-mono {
  text-decoration: underline;
}

.file-list .is-read {
  opacity: 0.5;
}

.diff-file {
  scroll-margin-top: 16px;
}

.diff-table-wrapper {
  overflow-x: auto;
}

.diff-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-family: monospace;
  font-size: 12px;
  line-height: 20px;

  .number-column {
    width: 50px;
  }

  .marker-column {
    width: 20px;
  }

  td {
    padding: 0 8px;
    vertical-align: top;
  }

  .line-number {
    text-align: right;
    opacity: 0.5;
    user-select: none;
  }

  .marker {
    padding: 0;
    text-align: center;
    user-select: none;
  }

  .code {
    white-space: pre-wrap;
    word-break: break-all;
  }

  .add {
    background-color: rgba(46, 160, 67, 0.15);
  }

  .delete {
    background-color: rgba(248, 81, 73, 0.15);
  }

  .empty {
    background-color: rgba(128, 128, 128, 0.06);
  }

  .hunk-header td {
    padding: 4px 8px;
    background-color: rgba(84, 174, 255, 0.12);
    opacity: 0.8;
  }

  :deep(.add .word-changed) {
    background-color: rgba(46, 160, 67, 0.4);
    border-radius: 2px;
  }

  :deep(.delete .word-changed) {
    background-color: rgba(248, 81, 73, 0.4);
    border-radius: 2px;
  }

  // The highlight.js token colors of the GitHub themes, light and dark.
  :deep(.hljs-keyword),
  :deep(.hljs-doctag),
  :deep(.hljs-meta .hljs-keyword),
  :deep(.hljs-template-tag),
  :deep(.hljs-type) {
    color: #cf222e;
  }

  :deep(.hljs-title),
  :deep(.hljs-title.function_) {
    color: #8250df;
  }

  :deep(.hljs-attr),
  :deep(.hljs-attribute),
  :deep(.hljs-literal),
  :deep(.hljs-meta),
  :deep(.hljs-number),
  :deep(.hljs-operator),
  :deep(.hljs-variable),
  :deep(.hljs-selector-attr),
  :deep(.hljs-selector-class),
  :deep(.hljs-selector-id) {
    color: #0550ae;
  }

  :deep(.hljs-string),
  :deep(.hljs-regexp),
  :deep(.hljs-meta .hljs-string) {
    color: #0a3069;
  }

  :deep(.hljs-built_in),
  :deep(.hljs-symbol) {
    color: #953800;
  }

  :deep(.hljs-comment),
  :deep(.hljs-code),
  :deep(.hljs-formula) {
    color: #6e7781;
  }

  :deep(.hljs-name),
  :deep(.hljs-quote),
  :deep(.hljs-selector-tag),
  :deep(.hljs-selector-pseudo) {
    color: #116329;
  }
}

.is-dark .additions {
  color: #3fb950;
}

.is-dark .deletions {
  color: #f85149;
}

.is-dark .diff-table {
  :deep(.hljs-keyword),
  :deep(.hljs-doctag),
  :deep(.hljs-meta .hljs-keyword),
  :deep(.hljs-template-tag),
  :deep(.hljs-type) {
    color: #ff7b72;
  }

  :deep(.hljs-title),
  :deep(.hljs-title.function_) {
    color: #d2a8ff;
  }

  :deep(.hljs-attr),
  :deep(.hljs-attribute),
  :deep(.hljs-literal),
  :deep(.hljs-meta),
  :deep(.hljs-number),
  :deep(.hljs-operator),
  :deep(.hljs-variable),
  :deep(.hljs-selector-attr),
  :deep(.hljs-selector-class),
  :deep(.hljs-selector-id) {
    color: #79c0ff;
  }

  :deep(.hljs-string),
  :deep(.hljs-regexp),
  :deep(.hljs-meta .hljs-string) {
    color: #a5d6ff;
  }

  :deep(.hljs-built_in),
  :deep(.hljs-symbol) {
    color: #ffa657;
  }

  :deep(.hljs-comment),
  :deep(.hljs-code),
  :deep(.hljs-formula) {
    color: #8b949e;
  }

  :deep(.hljs-name),
  :deep(.hljs-quote),
  :deep(.hljs-selector-tag),
  :deep(.hljs-selector-pseudo) {
    color: #7ee787;
  }
}
</style>
