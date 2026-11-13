<script setup lang="ts">
import { Copy } from '@vicons/tabler';
import hljs from 'highlight.js/lib/common';
import hljsStyle from 'highlight.js/styles/github.min.css?inline';
import markdownit from 'markdown-it';
import TextareaCopyable from '@/components/TextareaCopyable.vue';
import { useCopy } from '@/composable/copy';
import { useDownloadFileFromBase64 } from '@/composable/downloadBase64';
import { useReverseConversion } from '@/composable/reverseConversion';
import { textToBase64 } from '@/utils/base64';
import basicStyle from './preview-basic.css?inline';

const inputMarkdown = ref('');
const outputHtml = computed(() => {
  const md = markdownit();
  return md.render(inputMarkdown.value);
});
useReverseConversion({ input: inputMarkdown, output: outputHtml });

const previewMd = markdownit({
  highlight: (code, language) => {
    if (!language || !hljs.getLanguage(language)) {
      return '';
    }
    const highlighted = hljs.highlight(code, { language, ignoreIllegals: true }).value;
    return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`;
  },
});
const previewHtml = computed(() => previewMd.render(inputMarkdown.value));

const softWrapEnabled = ref(true);
const basicStyleEnabled = ref(true);
const previewFrame = ref<HTMLIFrameElement | null>(null);
const previewDocument = computed(() => `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${basicStyleEnabled.value ? `<style>${hljsStyle}\n${basicStyle}</style>` : ''}
</head>
<body>${basicStyleEnabled.value ? previewHtml.value : outputHtml.value}</body>
</html>`);

const { copy, isJustCopied } = useCopy({ createToast: false });
const copyTooltipText = computed(() => isJustCopied.value ? 'Copied!' : 'Copy to clipboard');

function copyPreviewText() {
  const text = previewFrame.value?.contentDocument?.body.innerText ?? '';
  copy(text.trim());
}

function openPreviewInNewTab() {
  const url = URL.createObjectURL(new Blob([previewDocument.value], { type: 'text/html' }));
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

const htmlBase64 = computed(() => `data:text/html;base64,${textToBase64(previewDocument.value)}`);
const markdownBase64 = computed(() => `data:text/markdown;base64,${textToBase64(inputMarkdown.value)}`);
const { download: downloadHtml } = useDownloadFileFromBase64({ source: htmlBase64, filename: 'document.html' });
const { download: downloadMarkdown } = useDownloadFileFromBase64({ source: markdownBase64, filename: 'document.md' });

function printHtml() {
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0;visibility:hidden';
  frame.setAttribute('sandbox', 'allow-same-origin allow-modals');
  frame.srcdoc = previewDocument.value;
  frame.onload = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 60_000);
  };
  document.body.appendChild(frame);
}
</script>

<template>
  <div>
    <c-input-text
      v-model:value="inputMarkdown"
      multiline raw-text
      placeholder="Your Markdown content..."
      rows="8"
      autofocus
      label="Your Markdown to convert:"
    />

    <n-divider />

    <n-form-item label="Output HTML:">
      <n-tabs type="line" animated default-value="code" w-full>
        <n-tab-pane name="code" tab="HTML code">
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
          <TextareaCopyable :value="outputHtml" :word-wrap="softWrapEnabled" language="html" />
        </n-tab-pane>
        <n-tab-pane name="preview" tab="HTML preview">
          <div mb-2 flex flex-wrap items-center justify-between gap-2>
            <n-switch v-model:value="basicStyleEnabled" data-test-id="basic-style-toggle">
              <template #checked>
                Basic style
              </template>
              <template #unchecked>
                No style
              </template>
            </n-switch>
            <c-button data-test-id="open-preview" @click="openPreviewInNewTab()">
              Open in new tab
            </c-button>
          </div>
          <c-card relative>
            <iframe
              ref="previewFrame"
              title="HTML preview"
              sandbox="allow-same-origin"
              :srcdoc="previewDocument"
              data-test-id="html-preview"
              class="preview-frame"
            />
            <div absolute right-10px top-10px>
              <c-tooltip :tooltip="copyTooltipText" position="left">
                <c-button circle important:h-10 important:w-10 data-test-id="copy-preview" @click="copyPreviewText()">
                  <n-icon size="22" :component="Copy" />
                </c-button>
              </c-tooltip>
            </div>
          </c-card>
        </n-tab-pane>
      </n-tabs>
    </n-form-item>

    <div flex flex-wrap justify-center gap-2>
      <n-button data-test-id="print-pdf" :disabled="inputMarkdown === ''" @click="printHtml">
        Print as PDF
      </n-button>
      <n-button data-test-id="download-html" :disabled="inputMarkdown === ''" @click="downloadHtml()">
        Download as HTML
      </n-button>
      <n-button data-test-id="download-markdown" :disabled="inputMarkdown === ''" @click="downloadMarkdown()">
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
}
</style>
