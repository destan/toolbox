<script setup lang="ts">
import type { EchoedRequest } from './browser-headers.service';
import { useCopy } from '@/composable/copy';
import { fetchEchoedRequest, formatHeaders } from './browser-headers.service';

const echoedRequest = ref<EchoedRequest>();
const errorMessage = ref<string>();
const isLoading = ref(false);

const headersText = computed(() => formatHeaders(echoedRequest.value?.headers ?? []));
const { copy } = useCopy({ source: headersText, text: 'Headers copied to the clipboard' });

async function showHeaders() {
  isLoading.value = true;
  echoedRequest.value = undefined;
  errorMessage.value = undefined;

  try {
    echoedRequest.value = await fetchEchoedRequest();
  }
  catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error);
  }
  finally {
    isLoading.value = false;
  }
}
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
        The result shows the headers of a cross-origin fetch request. A page load sends different values for some headers, such as Accept.
      </p>

      <div flex justify-center>
        <c-button :disabled="isLoading" @click="showHeaders">
          Show my headers
        </c-button>
      </div>
    </c-card>

    <c-alert v-if="errorMessage" type="error" title="The tool could not read the headers" mb-5>
      {{ errorMessage }}
    </c-alert>

    <template v-if="echoedRequest">
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
  </div>
</template>

<style lang="less" scoped>
.header-value {
  overflow-wrap: anywhere;
}
</style>
