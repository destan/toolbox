<script setup lang="ts">
import { useCopy } from '@/composable/copy';
import { getErrorMessage } from '@/utils/error';
import { fetchEchoedRequest, formatHeaders } from './browser-headers.service';

const { state: echoedRequest, isLoading, error, execute: showHeaders } = useAsyncState(fetchEchoedRequest, undefined, {
  immediate: false,
  resetOnExecute: false,
  onError: requestError => console.error(requestError),
});

const headersText = computed(() => formatHeaders(echoedRequest.value?.headers ?? []));
const { copy } = useCopy({ source: headersText, text: 'Headers copied to the clipboard' });

const status = computed(() => {
  if (isLoading.value) {
    return 'Reading headers';
  }
  if (error.value) {
    return 'The tool could not read the headers';
  }
  return echoedRequest.value ? 'The headers are ready' : '';
});
</script>

<template>
  <div>
    <c-card mb-5>
      <p mt-0>
        This tool sends one request to the
        <c-link href="https://beeceptor.com/resources/http-echo/" target="_blank" rel="noopener noreferrer">
          Beeceptor HTTP echo service
        </c-link>
        and shows what the service received. Beeceptor receives your IP address and the request headers. The tool sends nothing until you click the button.
      </p>
      <p>
        The result shows the headers of a cross-origin fetch request, not of a page load. A page load sends different values for some headers, such as Accept. This request also leaves out cookies and the Referer header.
      </p>
      <p>
        Beeceptor capitalizes the header names and keeps one value of a repeated header, so the result can differ from what the browser sent.
      </p>

      <div flex justify-center>
        <c-button :disabled="isLoading" :aria-disabled="isLoading" @click="showHeaders()">
          {{ isLoading ? 'Reading headers...' : 'Show my headers' }}
        </c-button>
      </div>
    </c-card>

    <c-alert v-if="error" type="error" title="The tool could not read the headers" mb-5>
      {{ getErrorMessage(error) }}
      <div v-if="echoedRequest" mt-2>
        The result below comes from the previous request.
      </div>
    </c-alert>

    <template v-if="echoedRequest">
      <c-alert v-if="echoedRequest.warnings.length > 0" title="Beeceptor reported a problem with this request" mb-5>
        <div v-for="(warning, index) in echoedRequest.warnings" :key="index">
          {{ warning }}
        </div>
      </c-alert>

      <c-card title="Public IP address" mb-5>
        <c-text-copyable :value="echoedRequest.ip" data-test-id="public-ip" />
      </c-card>

      <c-card title="Request headers">
        <c-table :data="echoedRequest.headers" :headers="{ name: 'Name', value: 'Value' }" description="Request headers">
          <template #value="{ value }">
            <span class="header-value">{{ value }}</span>
          </template>
        </c-table>

        <div mt-5 flex justify-center>
          <c-button @click="copy()">
            Copy headers
          </c-button>
        </div>
      </c-card>
    </template>

    <div class="sr-only" role="status" aria-live="polite" data-test-id="status">
      {{ status }}
    </div>
  </div>
</template>

<style lang="less" scoped>
.header-value {
  overflow-wrap: anywhere;
}
</style>
