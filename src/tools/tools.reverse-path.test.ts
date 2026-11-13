import { describe, expect, it } from 'vitest';
import { tools } from './index';

describe('tool reversePath', () => {
  const toolsByPath = new Map(tools.map(tool => [tool.path, tool]));
  const toolsWithReversePath = tools.filter(tool => tool.reversePath !== undefined);

  it('is set on the converter pairs', () => {
    expect(toolsWithReversePath.map(({ path }) => path).sort()).toEqual([
      '/html-to-markdown',
      '/json-to-toml',
      '/json-to-xml',
      '/json-to-yaml-converter',
      '/markdown-to-html',
      '/toml-to-json',
      '/toml-to-yaml',
      '/xml-to-json',
      '/yaml-to-json-converter',
      '/yaml-to-toml',
    ]);
  });

  it.each(toolsWithReversePath.map(tool => [tool.path, tool.reversePath]))('%s points to a tool that points back', (path, reversePath) => {
    expect(toolsByPath.get(reversePath!)?.reversePath).toBe(path);
  });
});
