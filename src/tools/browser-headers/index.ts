import { ListDetails } from '@vicons/tabler';
import { translate } from '@/plugins/i18n.plugin';
import { defineTool } from '../tool';

export const tool = defineTool({
  name: translate('tools.browser-headers.title'),
  path: '/browser-headers',
  description: translate('tools.browser-headers.description'),
  keywords: ['browser', 'http', 'request', 'headers', 'echo', 'user', 'agent', 'accept', 'ip', 'address', 'beeceptor'],
  component: () => import('./browser-headers.vue'),
  icon: ListDetails,
  createdAt: new Date('2026-11-06'),
});
