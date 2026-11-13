import { Braces } from '@vicons/tabler';
import { defineTool } from '../tool';

export const tool = defineTool({
  name: 'JSON to XML',
  path: '/json-to-xml',
  reversePath: '/xml-to-json',
  description: 'Convert JSON to XML',
  keywords: ['json', 'xml'],
  component: () => import('./json-to-xml.vue'),
  icon: Braces,
  createdAt: new Date('2024-08-09'),
});
