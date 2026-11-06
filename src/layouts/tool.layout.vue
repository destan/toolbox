<script lang="ts" setup>
import type { Tool } from '@/tools/tools.types';
import { useHead } from '@unhead/vue';

import { useRoute } from 'vue-router';
import FavoriteButton from '@/components/FavoriteButton.vue';
import BaseLayout from './base.layout.vue';

const route = useRoute();

const head = computed(() => ({
  title: `${route.meta.name} - Toolbox`,
  meta: [
    {
      name: 'description',
      content: route.meta?.description as string,
    },
    {
      name: 'keywords',
      content: ((route.meta.keywords ?? []) as string[]).join(','),
    },
  ],
}));
useHead(head);
const { t } = useI18n();

const i18nKey = computed<string>(() => route.path.trim().replace('/', ''));
const toolTitle = computed<string>(() => t(`tools.${i18nKey.value}.title`, String(route.meta.name)));
const toolDescription = computed<string>(() => t(`tools.${i18nKey.value}.description`, String(route.meta.description)));
</script>

<template>
  <BaseLayout>
    <div class="tool-layout" :class="{ 'tool-layout-wide': route.meta.wideLayout }">
      <div class="tool-header">
        <div flex flex-nowrap items-center justify-between>
          <n-h1>
            {{ toolTitle }}
          </n-h1>

          <div>
            <FavoriteButton :tool="{ name: route.meta.name, path: route.path } as Tool" />
          </div>
        </div>

        <div class="separator" />

        <div class="description">
          {{ toolDescription }}
        </div>
      </div>
    </div>

    <div class="tool-content" :class="{ 'tool-content-wide': route.meta.wideLayout }">
      <slot />
    </div>
  </BaseLayout>
</template>

<style lang="less" scoped>
.tool-content {
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 16px;

  ::v-deep(& > *) {
    flex: 0 1 600px;
  }
}

.tool-layout {
  max-width: 600px;
  margin: 0 auto;
  box-sizing: border-box;

  .tool-header {
    padding: 40px 0;
    width: 100%;

    .n-h1 {
      opacity: 0.9;
      font-size: 40px;
      font-weight: 400;
      margin: 0;
      line-height: 1;
    }

    .separator {
      width: 200px;
      height: 2px;
      background: rgb(161, 161, 161);
      opacity: 0.2;

      margin: 10px 0;
    }

    .description {
      margin: 0;

      opacity: 0.7;
    }
  }
}

.tool-layout-wide,
.tool-content-wide {
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
}

.tool-layout-wide .tool-header {
  padding: 32px 0 24px;

  .n-h1 {
    font-size: 32px;
    font-weight: 600;
    line-height: 1.25;
    letter-spacing: -0.8px;
  }

  .separator {
    display: none;
  }

  .description {
    margin-top: 10px;
    max-width: 640px;
  }
}

.tool-content-wide {
  display: block;
}
</style>
