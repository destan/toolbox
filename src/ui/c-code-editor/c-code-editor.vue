<script setup lang="ts">
import * as monaco from 'monaco-editor';
import EditorWorker from 'monaco-editor/editor/editor.worker?worker';
import CssWorker from 'monaco-editor/language/css/css.worker?worker';
import HtmlWorker from 'monaco-editor/language/html/html.worker?worker';
import JsonWorker from 'monaco-editor/language/json/json.worker?worker';
import TypeScriptWorker from 'monaco-editor/language/typescript/ts.worker?worker';
import { useStyleStore } from '@/stores/style.store';

const props = withDefaults(defineProps<{
  value: string
  language?: string
  label: string
}>(), { language: 'plaintext' });

const emit = defineEmits<{
  'update:value': [value: string]
}>();

globalThis.MonacoEnvironment = {
  getWorker(_moduleId, label) {
    switch (label) {
      case 'json': return new JsonWorker();
      case 'css':
      case 'scss':
      case 'less': return new CssWorker();
      case 'html':
      case 'handlebars':
      case 'razor': return new HtmlWorker();
      case 'typescript':
      case 'javascript': return new TypeScriptWorker();
      default: return new EditorWorker();
    }
  },
};

const editorContainer = ref<HTMLElement>();
const styleStore = useStyleStore();
let editor: monaco.editor.IStandaloneCodeEditor | undefined;
let model: monaco.editor.ITextModel | undefined;
let changeListener: monaco.IDisposable | undefined;

onMounted(() => {
  if (!editorContainer.value) {
    return;
  }

  model = monaco.editor.createModel(props.value, props.language);
  editor = monaco.editor.create(editorContainer.value, {
    model,
    ariaLabel: props.label,
    theme: styleStore.isDarkTheme ? 'vs-dark' : 'vs',
    automaticLayout: true,
    minimap: { enabled: false },
    lineNumbers: 'off',
    glyphMargin: false,
    folding: false,
    lineDecorationsWidth: 0,
    lineNumbersMinChars: 0,
    overviewRulerLanes: 0,
    hideCursorInOverviewRuler: true,
    scrollBeyondLastLine: false,
    wordWrap: 'on',
    autoIndent: 'none',
    fontSize: 13,
    lineHeight: 22,
    padding: { top: 16, bottom: 16 },
    tabSize: 2,
    renderLineHighlight: 'none',
  });

  changeListener = model.onDidChangeContent(() => {
    emit('update:value', model!.getValue());
  });
});

watch(() => props.value, (value) => {
  if (model && value !== model.getValue()) {
    model.setValue(value);
  }
});

watch(() => props.language, (language) => {
  if (model) {
    monaco.editor.setModelLanguage(model, language);
  }
});

watch(() => props.label, ariaLabel => editor?.updateOptions({ ariaLabel }));
watch(() => styleStore.isDarkTheme, isDark => monaco.editor.setTheme(isDark ? 'vs-dark' : 'vs'));

onBeforeUnmount(() => {
  changeListener?.dispose();
  editor?.dispose();
  model?.dispose();
});
</script>

<template>
  <div ref="editorContainer" class="code-editor" />
</template>

<style scoped>
.code-editor {
  min-width: 0;
  height: 440px;
}
</style>
