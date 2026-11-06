<script setup lang="ts">
import type { CodeLanguage } from './code-formatter.service';
import type { UseValidationRule } from '@/composable/validation';
import CInputText from '@/ui/c-input-text/c-input-text.vue';
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

const inputElement = ref<typeof CInputText>();

const code = ref('<div><style>a{color:red}</style><p>Hello world</p></div>');
const selectedLanguage = useStorage<CodeLanguage | 'auto'>('code-formatter:language', 'auto');
const indentSize = useStorage('code-formatter:indent-size', 2);
const wrapLength = useStorage('code-formatter:wrap-length', 0);

const language = computed(() => selectedLanguage.value === 'auto' ? detectLanguage(code.value) : selectedLanguage.value);

const formattedCode = computed(() => {
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
});

const validationWatch = [language];

const rules: UseValidationRule<string>[] = [
  {
    validator: value => language.value !== 'json' || value.trim() === '' || isValidJson(value),
    message: 'Provided JSON is not valid.',
  },
];
</script>

<template>
  <div important:flex-full important:flex-shrink-0 important:flex-grow-0>
    <div flex flex-wrap items-center justify-center gap-3>
      <c-select
        v-model:value="selectedLanguage"
        label="Language:"
        label-position="left"
        :options="languageOptions"
        w-240px
      />
      <n-form-item label="Indent size:" label-placement="left" :show-feedback="false">
        <n-input-number v-model:value="indentSize" :min="1" :max="10" w-100px />
      </n-form-item>
      <n-form-item label="Wrap length (0 to disable):" label-placement="left" :show-feedback="false">
        <n-input-number v-model:value="wrapLength" :min="0" :max="300" w-100px />
      </n-form-item>
    </div>
    <div v-if="selectedLanguage === 'auto' && language" mt-2 text-center op-70 data-test-id="detected-language">
      Detected language: {{ languageLabels[language] }}
    </div>
  </div>

  <CInputText
    ref="inputElement"
    v-model:value="code"
    label="Your code"
    placeholder="Paste your HTML, CSS, JavaScript, or JSON here..."
    rows="20"
    autosize
    raw-text
    multiline
    test-id="input"
    :validation-rules="rules"
    :validation-watch="validationWatch"
    monospace
  />

  <div overflow-auto>
    <div mb-5px>
      Formatted code
    </div>
    <textarea-copyable :value="formattedCode" :language="language" :follow-height-of="inputElement?.inputWrapperRef" />
  </div>
</template>
