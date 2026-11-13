import type { Ref } from 'vue';
import { defineStore } from 'pinia';
import { onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';

export { useReverseConversion, useReverseConversionStore };

interface Conversion {
  input: Ref<string>
  output: Readonly<Ref<string>>
}

// A swap carries the converter output to the reverse tool, and keeps the converter input for the Back button.
const useReverseConversionStore = defineStore('reverse-conversion', () => {
  const pendingInputs = new Map<string, string>();
  let activeConversion: Conversion | undefined;

  function register(conversion: Conversion) {
    activeConversion = conversion;
  }

  // The next route's tool can register before the previous one unmounts.
  function unregister(conversion: Conversion) {
    if (activeConversion === conversion) {
      activeConversion = undefined;
    }
  }

  function takePendingInput(path: string) {
    const input = pendingInputs.get(path);
    pendingInputs.delete(path);
    return input;
  }

  function swap({ fromPath, toPath }: { fromPath: string; toPath: string }) {
    if (!activeConversion) {
      return;
    }

    pendingInputs.set(fromPath, activeConversion.input.value);

    const output = activeConversion.output.value;
    if (output !== '') {
      pendingInputs.set(toPath, output);
    }
  }

  return { register, unregister, takePendingInput, swap };
});

function useReverseConversion(conversion: Conversion) {
  const store = useReverseConversionStore();

  const pendingInput = store.takePendingInput(useRoute().path);
  if (pendingInput !== undefined) {
    conversion.input.value = pendingInput;
  }

  store.register(conversion);
  onBeforeUnmount(() => store.unregister(conversion));
}
