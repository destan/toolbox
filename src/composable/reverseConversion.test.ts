import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { ref } from 'vue';
import { useReverseConversionStore } from './reverseConversion';

describe('reverseConversion', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('carries the output to the reverse tool and keeps the input for the original tool', () => {
    const store = useReverseConversionStore();
    store.register({ input: ref('# Title'), output: ref('<h1>Title</h1>') });

    store.swap({ fromPath: '/markdown-to-html', toPath: '/html-to-markdown' });

    expect(store.takePendingInput('/html-to-markdown')).toBe('<h1>Title</h1>');
    expect(store.takePendingInput('/markdown-to-html')).toBe('# Title');
  });

  it('hands each pending input over only once', () => {
    const store = useReverseConversionStore();
    store.register({ input: ref('a'), output: ref('b') });

    store.swap({ fromPath: '/from', toPath: '/to' });

    expect(store.takePendingInput('/to')).toBe('b');
    expect(store.takePendingInput('/to')).toBeUndefined();
  });

  it('carries nothing to the reverse tool when the output is empty', () => {
    const store = useReverseConversionStore();
    store.register({ input: ref('invalid'), output: ref('') });

    store.swap({ fromPath: '/from', toPath: '/to' });

    expect(store.takePendingInput('/to')).toBeUndefined();
    expect(store.takePendingInput('/from')).toBe('invalid');
  });

  it('keeps the newer registration when the previous tool unmounts after the next tool mounts', () => {
    const store = useReverseConversionStore();
    const previous = { input: ref('previous input'), output: ref('previous output') };
    const next = { input: ref('next input'), output: ref('next output') };

    store.register(previous);
    store.register(next);
    store.unregister(previous);
    store.swap({ fromPath: '/from', toPath: '/to' });

    expect(store.takePendingInput('/to')).toBe('next output');
  });

  it('does nothing when no tool is registered', () => {
    const store = useReverseConversionStore();

    store.swap({ fromPath: '/from', toPath: '/to' });

    expect(store.takePendingInput('/from')).toBeUndefined();
    expect(store.takePendingInput('/to')).toBeUndefined();
  });
});
