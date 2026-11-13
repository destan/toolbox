<script setup lang="ts">
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import TextareaCopyable from '@/components/TextareaCopyable.vue';
import { useDownloadFileFromBase64 } from '@/composable/downloadBase64';
import { useReverseConversion } from '@/composable/reverseConversion';
import { textToBase64 } from '@/utils/base64';

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
});
turndown.use(gfm);
turndown.addRule('strikethrough', {
  filter: node => ['DEL', 'S', 'STRIKE'].includes(node.nodeName),
  replacement: content => `~~${content}~~`,
});
turndown.remove(['script', 'style']);

const inputHtml = ref('');
const outputMarkdown = computed(() => turndown.turndown(inputHtml.value));
useReverseConversion({ input: inputHtml, output: outputMarkdown });

const softWrapEnabled = ref(true);

// The preview blocks every remote request, so pasted HTML cannot load images or styles (privacy).
const previewDocument = computed(() => `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">
<meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>${inputHtml.value}</body>
</html>`);

function looksLikeHtml(text: string) {
  return text.trimStart().startsWith('<');
}

// A browser copy puts the rich text in `text/html`. HTML source copied from an editor starts with
// `<` in `text/plain`, so the handler keeps that text as is.
function onPaste(event: ClipboardEvent) {
  const clipboard = event.clipboardData;
  const html = clipboard?.getData('text/html');
  if (!html || looksLikeHtml(clipboard?.getData('text/plain') ?? '')) {
    return;
  }
  event.preventDefault();
  inputHtml.value = html;
}

const markdownBase64 = computed(() => `data:text/markdown;base64,${textToBase64(outputMarkdown.value)}`);
const { download: downloadMarkdown } = useDownloadFileFromBase64({ source: markdownBase64, filename: 'document.md' });
</script>

<template>
  <div>
    <div @paste.capture="onPaste">
      <c-input-text
        v-model:value="inputHtml"
        multiline raw-text
        placeholder="Your HTML content, or paste rich text from a web page..."
        rows="8"
        autofocus
        label="Your HTML to convert:"
        test-id="input"
      />
    </div>

    <n-tabs type="line" animated default-value="markdown" mt-4 w-full>
      <n-tab-pane name="markdown" tab="Markdown output">
        <div mb-2>
          <n-switch v-model:value="softWrapEnabled" data-test-id="soft-wrap-toggle">
            <template #checked>
              Soft wrap
            </template>
            <template #unchecked>
              No wrap
            </template>
          </n-switch>
        </div>
        <TextareaCopyable :value="outputMarkdown" :word-wrap="softWrapEnabled" language="markdown" />
      </n-tab-pane>
      <n-tab-pane name="preview" tab="HTML input preview">
        <c-card>
          <iframe
            title="HTML input preview"
            sandbox=""
            :srcdoc="previewDocument"
            data-test-id="html-preview"
            class="preview-frame"
          />
        </c-card>
      </n-tab-pane>
    </n-tabs>

    <div mt-4 flex flex-wrap justify-center gap-2>
      <n-button data-test-id="download-markdown" :disabled="inputHtml === ''" @click="downloadMarkdown()">
        Download as Markdown
      </n-button>
    </div>
  </div>
</template>

<style lang="less" scoped>
.preview-frame {
  display: block;
  width: 100%;
  height: 400px;
  border: 0;
  background: white;
}
</style>
