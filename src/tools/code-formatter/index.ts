import { Code } from '@vicons/tabler';
import { translate } from '@/plugins/i18n.plugin';
import { defineTool } from '../tool';

export const tool = defineTool({
  name: translate('tools.code-formatter.title'),
  path: '/code-formatter',
  description: translate('tools.code-formatter.description'),
  keywords: ['code', 'format', 'formatter', 'beautify', 'prettify', 'html', 'css', 'javascript', 'js', 'json'],
  component: () => import('./code-formatter.vue'),
  icon: Code,
  createdAt: new Date('2026-11-06'),
});
