<script setup lang="ts">
import type { CodeLanguage } from './code-formatter.service';
import type { UseValidationRule } from '@/composable/validation';
import { Check, Copy } from '@vicons/tabler';
import { useCopy } from '@/composable/copy';
import CCodeEditor from '@/ui/c-code-editor/c-code-editor.vue';
import CInputText from '@/ui/c-input-text/c-input-text.vue';
import { useAppTheme } from '@/ui/theme/themes';
import { withDefaultOnError } from '@/utils/defaults';
import { detectLanguage, formatCode, isValidJson } from './code-formatter.service';

const languageLabels: Record<CodeLanguage, string> = {
  html: 'HTML',
  css: 'CSS',
  javascript: 'JavaScript',
  json: 'JSON',
};

const languageOptions = [
  { label: 'Auto-detect', value: 'auto' },
  ...Object.entries(languageLabels).map(([value, label]) => ({ label, value })),
];

const theme = useAppTheme();

const code = ref('<div><style>a{color:red}</style><p>Hello world</p></div>');
const selectedLanguage = useStorage<CodeLanguage | 'auto'>('code-formatter:language', 'auto');
const indentSize = useStorage('code-formatter:indent-size', 2);
const wrapLength = useStorage('code-formatter:wrap-length', 0);

const language = computed(() => selectedLanguage.value === 'auto' ? detectLanguage(code.value) : selectedLanguage.value);

const formattedCode = ref('');
const { copy, isJustCopied } = useCopy({ source: formattedCode, createToast: false });

watch([code, selectedLanguage, indentSize, wrapLength], () => {
  formattedCode.value = getFormattedCode();
}, { immediate: true });

function getFormattedCode() {
  const currentLanguage = language.value;

  if (!currentLanguage || code.value.trim() === '') {
    return '';
  }

  return withDefaultOnError(
    () => formatCode(code.value, {
      language: currentLanguage,
      indentSize: indentSize.value ?? 0,
      wrapLength: wrapLength.value ?? 0,
    }),
    '',
  );
}

const validationWatch = [language];

const rules: UseValidationRule<string>[] = [
  {
    validator: value => language.value !== 'json' || value.trim() === '' || isValidJson(value),
    message: 'Provided JSON is not valid.',
  },
];
</script>

<template>
  <div class="code-formatter">
    <div class="formatter-toolbar">
      <c-select
        v-model:value="selectedLanguage"
        class="language-select"
        label="Language"
        label-position="left"
        :options="languageOptions"
      />
      <n-form-item label="Indent size" label-placement="left" :show-feedback="false">
        <n-input-number
          v-model:value="indentSize"
          :min="1"
          :max="10"
          :input-props="{ 'aria-label': 'Indent size' }"
          class="number-input"
        />
      </n-form-item>
      <n-form-item label="Wrap length" label-placement="left" :show-feedback="false">
        <n-input-number
          v-model:value="wrapLength"
          :min="0"
          :max="300"
          :input-props="{ 'aria-label': 'Wrap length', 'aria-describedby': 'wrap-hint' }"
          class="number-input"
        />
        <span id="wrap-hint" class="wrap-hint">0 = off</span>
      </n-form-item>
      <span
        v-if="selectedLanguage === 'auto' && language"
        class="detected-language"
        data-test-id="detected-language"
        role="status"
      >
        Detected language: {{ languageLabels[language] }}
      </span>
    </div>

    <div class="formatter-panels">
      <CInputText
        v-model:value="code"
        class="code-input"
        label="Your code"
        placeholder="Paste your HTML, CSS, JavaScript, or JSON here..."
        rows="12"
        autosize
        raw-text
        multiline
        test-id="input"
        :validation-rules="rules"
        :validation-watch="validationWatch"
        monospace
      />

      <div class="code-output">
        <div class="panel-header">
          <span>Formatted code</span>
          <n-button
            size="small"
            secondary
            type="primary"
            :disabled="!formattedCode"
            aria-label="Copy formatted code"
            @click="copy()"
          >
            <template #icon>
              <n-icon :component="isJustCopied ? Check : Copy" />
            </template>
            <span aria-live="polite">{{ isJustCopied ? 'Copied!' : 'Copy' }}</span>
          </n-button>
        </div>
        <CCodeEditor
          v-model:value="formattedCode"
          :language="language ?? 'plaintext'"
          label="Formatted code"
          data-test-id="area-content"
        />
      </div>
    </div>
  </div>
</template>

<style lang="less" scoped>
.code-formatter {
  --formatter-border: v-bind('theme.default.colorHover');

  container-type: inline-size;
  background: v-bind('theme.background');
  border: 1px solid var(--formatter-border);
  border-radius: 12px;
  box-shadow: 0 4px 24px rgb(0 0 0 / 3%);
}

.formatter-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px 24px;
  padding: 18px 20px;
  border-bottom: 1px solid var(--formatter-border);
  font-size: 13px;

  :deep(.n-form-item-label) {
    font-size: 13px;
  }

  :deep(.c-select-input) {
    border-color: var(--formatter-border);
    border-radius: 6px;
  }
}

.language-select {
  width: 228px;
}

.number-input {
  width: 96px;
}

.wrap-hint {
  margin-left: 8px;
  color: v-bind('theme.text.mutedColor');
  font-size: 12px;
  white-space: nowrap;
}

.detected-language {
  margin-left: auto;
  padding: 4px 10px;
  border-radius: 6px;
  background: v-bind('theme.default.color');
  color: v-bind('theme.text.baseColor');
  font-size: 12px;
  white-space: nowrap;
}

.formatter-panels {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
}

.code-input {
  min-width: 0;
  border-right: 1px solid var(--formatter-border);

  :deep(.label) {
    display: flex;
    align-items: center;
    box-sizing: border-box;
    min-height: 58px;
    margin: 0;
    padding: 12px 20px;
    border-bottom: 1px solid var(--formatter-border);
    font-weight: 500;
  }

  :deep(.input-wrapper) {
    min-height: 440px;
    margin: 8px;
    padding: 0 12px;
    border-radius: 6px;
    background: transparent;
  }

  :deep(textarea.input) {
    font-size: 13px;
    line-height: 22px;
  }

  :deep(.feedback) {
    display: block;
    padding: 0 20px 16px;
  }
}

.code-output {
  display: flex;
  min-width: 0;
  flex-direction: column;

  .code-editor {
    flex: 1;
    min-height: 440px;
    margin: 0 12px 8px;
    border-radius: 6px;
    overflow: hidden;
  }
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-sizing: border-box;
  min-height: 58px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--formatter-border);
  font-weight: 500;

  :deep(.n-button) {
    border-radius: 6px;
  }
}

@container (max-width: 720px) {
  .formatter-toolbar {
    gap: 12px 20px;
    padding: 16px;
  }

  .detected-language {
    margin-left: 0;
  }

  .formatter-panels {
    grid-template-columns: minmax(0, 1fr);
  }

  .code-input {
    border-right: 0;
    border-bottom: 1px solid var(--formatter-border);

    :deep(.input-wrapper) {
      min-height: 280px;
    }
  }

  .code-output .code-editor {
    height: 280px;
    min-height: 280px;
  }
}
</style>
