import { MailOpened } from '@vicons/tabler';
import { defineTool } from '../tool';

export const tool = defineTool({
  name: 'EML header parser',
  path: '/eml-header-parser',
  description: 'Parse the headers of an EML file in the browser: list all headers, read the SPF, DKIM and DMARC results, and follow the relay hops.',
  keywords: ['eml', 'email', 'mail', 'header', 'parser', 'spf', 'dkim', 'dmarc', 'arc', 'received', 'relay', 'authentication'],
  component: () => import('./eml-header-parser.vue'),
  icon: MailOpened,
  createdAt: new Date('2026-11-20'),
  wideLayout: true,
});
