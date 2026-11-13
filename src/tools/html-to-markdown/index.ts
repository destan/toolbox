import { Markdown } from '@vicons/tabler';
import { defineTool } from '../tool';

export const tool = defineTool({
  name: 'HTML to Markdown',
  path: '/html-to-markdown',
  reversePath: '/markdown-to-html',
  description: 'Convert HTML or rich text pasted from a web page to Markdown',
  keywords: ['html', 'markdown', 'converter', 'turndown', 'paste', 'rich text'],
  component: () => import('./html-to-markdown.vue'),
  icon: Markdown,
  createdAt: new Date('2026-11-13'),
  wideLayout: true,
});
