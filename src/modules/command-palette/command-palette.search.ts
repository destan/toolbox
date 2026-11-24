import type { IFuseOptions } from 'fuse.js';
import type { MaybeRef } from 'vue';
import type { PaletteOption } from './command-palette.types';
import { get } from '@vueuse/core';
import _ from 'lodash';
import { computed } from 'vue';
import { useFuzzySearch } from '@/composable/fuzzySearch';

export { usePaletteSearch };

const fuzzySearchOptions: IFuseOptions<PaletteOption> = {
  keys: [{ name: 'name', weight: 2 }, 'description', 'keywords', 'category'],
  threshold: 0.3,
};

// The fuzzy search matches the whole query as one pattern, so it misses multi-word queries such as "json format".
// The all-words matches come after the fuzzy results, so every result the fuzzy search finds keeps its rank.
function usePaletteSearch({ search, data }: { search: MaybeRef<string>; data: PaletteOption[] }) {
  const { searchResult: fuzzySearchResult } = useFuzzySearch({ search, data, options: fuzzySearchOptions });
  const { searchResult: allWordsSearchResult } = useFuzzySearch({
    search,
    data,
    options: { ...fuzzySearchOptions, useTokenSearch: true, tokenMatch: 'all' },
  });

  const searchResult = computed(() => {
    const isMultiWordQuery = get(search).trim().split(/\s+/).length > 1;

    return isMultiWordQuery
      ? _.uniq([...fuzzySearchResult.value, ...allWordsSearchResult.value])
      : fuzzySearchResult.value;
  });

  return { searchResult };
}
