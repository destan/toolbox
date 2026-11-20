<script setup lang="ts">
import { useCopy } from '@/composable/copy';
import {
  extractHeaderBlock,
  formatDuration,
  formatHeadersAsJson,
  formatHeadersAsText,
  getAuthHeaders,
  getAuthVerdicts,
  getRelayHops,
  parseHeaders,
} from './eml-header-parser.service';

const SLOW_HOP_SECONDS = 60;
const VERY_SLOW_HOP_SECONDS = 300;

const input = ref('');
const filter = ref('');

const headers = computed(() => parseHeaders(input.value));
// c-table needs rows with an index signature, which the service interfaces do not have, so the rows are copied.
const filteredHeaders = computed(() => {
  const query = filter.value.trim().toLowerCase();
  return headers.value
    .filter(({ name, value }) => name.toLowerCase().includes(query) || value.toLowerCase().includes(query))
    .map(header => ({ ...header }));
});
const authHeaders = computed(() => getAuthHeaders(headers.value).map(header => ({ ...header })));
const authVerdicts = computed(() => getAuthVerdicts(headers.value).map(verdict => ({ ...verdict })));
const relayHops = computed(() => getRelayHops(headers.value));
const relayTotal = computed(() => {
  const dates = relayHops.value.flatMap(({ date }) => (date ? [date.getTime()] : []));
  return dates.length > 1 ? formatDuration((dates.at(-1)! - dates[0]) / 1000) : '';
});

function formatDate(date: Date | null) {
  return date ? `${date.toISOString().slice(0, 19).replace('T', ' ')} UTC` : 'No date';
}

function getDelayType(seconds: number) {
  if (seconds < 0 || seconds >= VERY_SLOW_HOP_SECONDS) {
    return 'error';
  }
  return seconds >= SLOW_HOP_SECONDS ? 'warning' : 'default';
}

const { copy } = useCopy({ createToast: true });

// Only the headers are kept, so a large attachment never reaches the text area.
async function onFileUpload(file: File) {
  input.value = extractHeaderBlock(await file.text());
}
</script>

<template>
  <div style="flex: 0 0 100%" flex flex-col gap-4>
    <c-file-upload title="Drag and drop an EML file here, or click to select a file" accept=".eml,message/rfc822" @file-upload="onFileUpload" />

    <c-input-text
      v-model:value="input"
      label="Or paste the EML or its headers"
      placeholder="Paste the EML content or only its headers here..."
      multiline raw-text monospace
      rows="10"
      test-id="input"
    />

    <c-card v-if="headers.length">
      <n-tabs type="line" animated default-value="headers">
        <n-tab-pane name="headers" :tab="`Headers (${headers.length})`">
          <div mb-4 flex flex-wrap items-center gap-2>
            <c-input-text v-model:value="filter" placeholder="Filter by name or value..." raw-text clearable flex-1 test-id="filter" />
            <c-button data-test-id="copy-text" @click="copy(formatHeadersAsText(headers))">
              Copy as text
            </c-button>
            <c-button data-test-id="copy-json" @click="copy(formatHeadersAsJson(headers))">
              Copy as JSON
            </c-button>
          </div>

          <c-table :data="filteredHeaders" :headers="{ name: 'Name', value: 'Value' }" description="Headers" data-test-id="headers-table">
            <template #name="{ value }">
              <span whitespace-nowrap font-bold>{{ value }}</span>
            </template>
            <template #value="{ value }">
              <span break-all font-mono>{{ value }}</span>
            </template>
          </c-table>
        </n-tab-pane>

        <n-tab-pane name="auth" :tab="`SPF, DKIM and DMARC (${authHeaders.length})`">
          <div v-if="!authHeaders.length" op-70>
            No SPF, DKIM or DMARC headers found.
          </div>
          <template v-else>
            <c-table v-if="authVerdicts.length" :data="authVerdicts" :headers="{ method: 'Method', result: 'Result', details: 'Details', source: 'Header', trusted: 'Added by' }" description="Authentication results">
              <template #method="{ value }">
                <span font-bold uppercase>{{ value }}</span>
              </template>
              <template #result="{ value }">
                <n-tag size="small" :type="value === 'pass' ? 'success' : value === 'fail' ? 'error' : 'warning'">
                  {{ value }}
                </n-tag>
              </template>
              <template #details="{ value }">
                <span break-all font-mono>{{ value }}</span>
              </template>
              <template #source="{ value }">
                <span whitespace-nowrap>{{ value }}</span>
              </template>
              <template #trusted="{ value, row }">
                <c-tooltip
                  :tooltip="value
                    ? 'The top header of this type. Your receiving server added it, so you can trust it.'
                    : row.source.toLowerCase() === 'arc-authentication-results'
                      ? 'A forwarding server added it to the ARC chain. Trust it only if you trust that server.'
                      : 'An earlier server added it. The sender can forge it, so do not trust it.'"
                >
                  <n-tag size="small" :type="value ? 'success' : 'default'" whitespace-nowrap>
                    {{ value ? 'Your server' : 'Earlier server' }}
                  </n-tag>
                </c-tooltip>
              </template>
            </c-table>

            <div my-4 text-sm op-70>
              Your receiving server adds its Authentication-Results on top. Only that one is reliable.
            </div>

            <c-table :data="authHeaders" :headers="{ name: 'Name', value: 'Value' }" description="Authentication headers">
              <template #name="{ value }">
                <span whitespace-nowrap font-bold>{{ value }}</span>
              </template>
              <template #value="{ value }">
                <span break-all font-mono>{{ value }}</span>
              </template>
            </c-table>
          </template>
        </n-tab-pane>

        <n-tab-pane name="relay" :tab="`Relay hops (${relayHops.length})`">
          <div v-if="!relayHops.length" op-70>
            No Received headers found.
          </div>
          <template v-else>
            <div v-if="relayTotal" mb-4 text-sm op-70>
              {{ relayHops.length }} hops in {{ relayTotal }}, oldest first.
            </div>

            <ol class="relay" aria-label="Relay hops" data-test-id="relay-hops">
              <li v-for="(hop, index) in relayHops" :key="index">
                <div v-if="hop.delaySeconds !== null && index > 0" class="relay-delay">
                  <n-tag size="small" round :type="getDelayType(hop.delaySeconds)" :bordered="false">
                    {{ hop.delaySeconds < 0 ? `${formatDuration(hop.delaySeconds)} (clock skew)` : `+${formatDuration(hop.delaySeconds)}` }}
                  </n-tag>
                </div>

                <div class="relay-hop">
                  <div class="relay-dot" bg-primary text-white>
                    {{ index + 1 }}
                  </div>
                  <div min-w-0 flex-1>
                    <div break-all font-bold font-mono>
                      {{ hop.by || 'Unknown server' }}
                    </div>
                    <div v-if="hop.from" break-all text-sm>
                      <span op-70>from</span> <span font-mono>{{ hop.from }}</span>
                    </div>
                    <div text-sm op-70>
                      {{ formatDate(hop.date) }}<template v-if="hop.with">
                        · {{ hop.with }}
                      </template>
                    </div>
                  </div>
                </div>
              </li>
            </ol>
          </template>
        </n-tab-pane>
      </n-tabs>
    </c-card>

    <c-alert v-else-if="input.trim()">
      No headers found in the input.
    </c-alert>
  </div>
</template>

<style lang="less" scoped>
.relay {
  list-style: none;
  margin: 0;
  padding: 0;
}

// The line that joins the dots runs down from each dot and through the delay below it.
.relay-hop {
  position: relative;
  min-height: 28px;
  padding: 2px 0 16px 40px;
}

.relay li:not(:last-child) .relay-hop::before {
  content: '';
  position: absolute;
  top: 28px;
  bottom: 0;
  left: 13px;
  border-left: 2px solid rgba(128, 128, 128, 0.3);
}

.relay-delay {
  margin-left: 13px;
  padding: 0 0 12px 25px;
  border-left: 2px solid rgba(128, 128, 128, 0.3);
}

.relay-dot {
  position: absolute;
  top: 0;
  left: 0;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: bold;
}
</style>
