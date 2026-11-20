import { FileDiff } from '@vicons/tabler';
import { defineTool } from '../tool';

export const tool = defineTool({
  name: 'Diff file analyzer',
  path: '/diff-file-analyzer',
  description: 'Show a .diff or .patch file, or the output of git diff, as a split or unified view with stats, word changes and syntax highlight.',
  keywords: ['diff', 'patch', 'git', 'unified', 'split', 'side by side', 'analyzer', 'viewer', 'format-patch', 'hunk'],
  component: () => import('./diff-file-analyzer.vue'),
  icon: FileDiff,
  createdAt: new Date('2026-11-20'),
  wideLayout: true,
});
