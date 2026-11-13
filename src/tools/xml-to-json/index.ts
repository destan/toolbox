import { Braces } from '@vicons/tabler';
import { defineTool } from '../tool';

export const tool = defineTool({
  name: 'XML to JSON',
  path: '/xml-to-json',
  reversePath: '/json-to-xml',
  description: 'Convert XML to JSON',
  keywords: ['xml', 'json'],
  component: () => import('./xml-to-json.vue'),
  icon: Braces,
  createdAt: new Date('2024-08-09'),
});
