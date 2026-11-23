import type { MarkdownIt, MarkdownItOptions } from 'markdown-it';
import hljs from 'highlight.js/lib/common';
import markdownit from 'markdown-it';

export { markdownToHtml, markdownToPreviewHtml };

const FILE_LINK_RE = /^file:/i;

const htmlRenderer = createMarkdownRenderer();
const previewRenderer = createMarkdownRenderer({ highlight: highlightCode });

function markdownToHtml(markdown: string): string {
  return htmlRenderer.render(markdown);
}

function markdownToPreviewHtml(markdown: string): string {
  return previewRenderer.render(markdown);
}

// markdown-it rejects file: links by default and renders them as literal text.
// This tool converts the user's own Markdown, so local file links are kept.
// The default check still rejects javascript:, vbscript: and non-image data: links.
function createMarkdownRenderer(options: MarkdownItOptions = {}): MarkdownIt {
  const md = markdownit(options);
  const defaultValidateLink = md.validateLink.bind(md);
  md.validateLink = url => FILE_LINK_RE.test(url.trim()) || defaultValidateLink(url);
  return md;
}

function highlightCode(code: string, language: string): string {
  if (!language || !hljs.getLanguage(language)) {
    return '';
  }
  const highlighted = hljs.highlight(code, { language, ignoreIllegals: true }).value;
  return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`;
}
