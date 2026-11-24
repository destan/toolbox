import type { PaletteOption } from './command-palette.types';
import { describe, expect, it } from 'vitest';
import { ref } from 'vue';
import { useFuzzySearch } from '@/composable/fuzzySearch';
import { tools } from '@/tools';
import { usePaletteSearch } from './command-palette.search';

const data: PaletteOption[] = tools.map(tool => ({ ...tool, category: 'Tools' }));
const toolNames = new Map(tools.map(tool => [tool.path, tool.name]));

function searchNames(query: string) {
  const { searchResult } = usePaletteSearch({ search: ref(query), data });
  return searchResult.value.map(({ name }) => name);
}

function fuzzySearchNames(query: string) {
  const { searchResult } = useFuzzySearch({
    search: ref(query),
    data,
    options: { keys: [{ name: 'name', weight: 2 }, 'description', 'keywords', 'category'], threshold: 0.3 },
  });
  return searchResult.value.map(({ name }) => name);
}

describe('usePaletteSearch', () => {
  it('finds the JSON formatting tools for a multi-word query', () => {
    expect(searchNames('json format').slice(0, 2)).toEqual([
      toolNames.get('/json-prettify'),
      toolNames.get('/code-formatter'),
    ]);
  });

  it('finds tools for a multi-word query with a typo', () => {
    expect(searchNames('json formater')).toContain(toolNames.get('/json-prettify'));
  });

  it.each(['json', 'qr code', 'toml to json', 'json to t', 'mac address'])('keeps the fuzzy search results and their order for %j', (query) => {
    const fuzzyResult = fuzzySearchNames(query);

    expect(fuzzyResult).not.toEqual([]);
    expect(searchNames(query).slice(0, fuzzyResult.length)).toEqual(fuzzyResult);
  });
});
