<script setup lang="ts">
import { useMessage } from 'naive-ui';
import {
  type OutputFormat,
  blobToDataUrl,
  convertImage,
  getDefaultFileName,
  getExtensionFromMimeType,
  getImageFromDataTransfer,
  getSizeDelta,
  outputFormats,
  readImageFromClipboard,
  writeImageToClipboard,
} from './paste-image.service';
import { useCopy } from '@/composable/copy';
import { formatBytes } from '@/utils/convert';

interface PastedImage {
  id: number
  source: Blob
  bitmap: ImageBitmap
  createdAt: Date
  fileName: string
  output?: Blob
  outputFormat?: OutputFormat
  outputUrl?: string
  conversionId: number
}

const message = useMessage();
const { copy } = useCopy({ text: 'Base64 data URL copied to the clipboard' });

const format = useStorage<OutputFormat>('paste-image:format', 'png');
const quality = useStorage('paste-image:quality', 90);
const images = ref<PastedImage[]>([]);
let nextImageId = 0;

const formatOptions = Object.entries(outputFormats).map(([value, { label }]) => ({ value: value as OutputFormat, label }));
const isLossyFormat = computed(() => outputFormats[format.value]?.isLossy ?? false);
const pasteShortcut = /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘ + V' : 'Ctrl + V';

function isEditableTarget(target: EventTarget | null) {
  return target instanceof HTMLElement
    && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}

function revokeOutputUrl(image: PastedImage) {
  if (image.outputUrl) {
    URL.revokeObjectURL(image.outputUrl);
  }
}

async function updateOutput(image: PastedImage) {
  const conversionId = ++image.conversionId;
  const outputFormat = format.value;

  try {
    const output = await convertImage({ source: image.source, image: image.bitmap, format: outputFormat, quality: quality.value });

    // A newer conversion started while this one ran, so this result is stale.
    if (conversionId !== image.conversionId) {
      return;
    }

    revokeOutputUrl(image);
    image.output = markRaw(output);
    image.outputFormat = outputFormat;
    image.outputUrl = URL.createObjectURL(output);
  }
  catch (error) {
    message.error(error instanceof Error ? error.message : 'The image could not be converted.');
  }
}

async function addImage(source: Blob) {
  let bitmap: ImageBitmap;

  try {
    bitmap = await createImageBitmap(source);
  }
  catch {
    message.error('The browser could not read the pasted image.');
    return;
  }

  const createdAt = new Date();

  images.value.unshift({
    id: nextImageId++,
    source: markRaw(source),
    bitmap: markRaw(bitmap),
    createdAt,
    fileName: getDefaultFileName({ date: createdAt }),
    conversionId: 0,
  });

  await updateOutput(images.value[0]);
}

function removeImage(image: PastedImage) {
  revokeOutputUrl(image);
  image.bitmap.close();
  images.value = images.value.filter(({ id }) => id !== image.id);
}

function clearImages() {
  images.value.forEach((image) => {
    revokeOutputUrl(image);
    image.bitmap.close();
  });
  images.value = [];
}

useEventListener(document, 'paste', (event: ClipboardEvent) => {
  const image = getImageFromDataTransfer(event.clipboardData);

  if (image) {
    event.preventDefault();
    addImage(image);
    return;
  }

  // Text pasted into a field, such as the file name, is not meant for this tool.
  if (!isEditableTarget(event.target)) {
    message.warning('The clipboard has no image. Copy an image, then paste it here.');
  }
});

async function pasteFromClipboard() {
  if (!navigator.clipboard?.read) {
    message.error(`Your browser cannot read images from the clipboard with a button. Press ${pasteShortcut} instead.`);
    return;
  }

  try {
    const image = await readImageFromClipboard();

    if (!image) {
      message.warning('The clipboard has no image. Copy an image, then try again.');
      return;
    }

    await addImage(image);
  }
  catch (error) {
    if (error instanceof DOMException && error.name === 'NotAllowedError') {
      message.error(`The browser blocked clipboard access. Allow it in the site settings, or press ${pasteShortcut}.`);
      return;
    }

    message.error('The browser could not read the clipboard.');
  }
}

watch(format, () => images.value.forEach(updateOutput));
watchDebounced(quality, () => images.value.forEach(updateOutput), { debounce: 200 });

onBeforeUnmount(clearImages);

function getOutputFileName(image: PastedImage) {
  const fileName = image.fileName.trim() || getDefaultFileName({ date: image.createdAt });
  const extension = getExtensionFromMimeType(image.output?.type ?? outputFormats[format.value].mimeType);

  return `${fileName}.${extension}`;
}

function downloadImage(image: PastedImage) {
  if (!image.outputUrl) {
    return;
  }

  const link = document.createElement('a');
  link.href = image.outputUrl;
  link.download = getOutputFileName(image);
  link.click();
}

async function copyImage(image: PastedImage) {
  try {
    await writeImageToClipboard({ source: image.source, image: image.bitmap });
    message.success('Image copied to the clipboard');
  }
  catch {
    message.error('The browser could not copy the image to the clipboard.');
  }
}

async function copyDataUrl(image: PastedImage) {
  if (!image.output) {
    return;
  }

  await copy(await blobToDataUrl(image.output));
}

function isOutputFormatUnsupported(image: PastedImage) {
  return image.output !== undefined && image.outputFormat !== undefined && image.output.type !== outputFormats[image.outputFormat].mimeType;
}

function getTypeLabel(blob: Blob) {
  const outputFormat = Object.values(outputFormats).find(({ mimeType }) => mimeType === blob.type);

  return outputFormat?.label ?? getExtensionFromMimeType(blob.type).toUpperCase();
}
</script>

<template>
  <div>
    <c-card>
      <div flex flex-wrap items-center justify-between gap-3>
        <div>
          Press <n-text code>
            {{ pasteShortcut }}
          </n-text> anywhere on this page to paste an image.
          <div op-60>
            The image stays in your browser. Nothing is uploaded.
          </div>
        </div>

        <c-button type="primary" data-test-id="paste-from-clipboard" @click="pasteFromClipboard">
          <span mr-2><icon-mdi-content-paste /></span>
          Paste from clipboard
        </c-button>
      </div>

      <n-divider />

      <c-buttons-select v-model:value="format" :options="formatOptions" label="Format:" label-width="70px" />

      <n-form-item v-if="isLossyFormat" label="Quality:" :show-feedback="false" label-width="70px" label-placement="left" mt-3>
        <n-slider v-model:value="quality" :step="1" :min="1" :max="100" :format-tooltip="(value: number) => `${value}%`" />
        <div ml-3 w-12 text-right>
          {{ quality }}%
        </div>
      </n-form-item>
    </c-card>

    <div v-if="images.length > 0" mt-5 flex items-center justify-between>
      <div op-60>
        {{ images.length }} {{ images.length === 1 ? 'image' : 'images' }} pasted in this session
      </div>
      <c-button variant="text" @click="clearImages">
        <span mr-2><icon-mdi-delete-sweep-outline /></span>
        Clear all
      </c-button>
    </div>

    <c-card v-for="image in images" :key="image.id" mt-3 data-test-id="pasted-image">
      <div class="preview" flex justify-center>
        <img v-if="image.outputUrl" :src="image.outputUrl" :alt="image.fileName" max-h-400px max-w-full>
      </div>

      <div mt-3 flex flex-wrap gap-x-4 gap-y-1 op-80>
        <span>{{ image.bitmap.width }} × {{ image.bitmap.height }} px</span>
        <span>Original: {{ getTypeLabel(image.source) }}, {{ formatBytes(image.source.size) }}</span>
        <span v-if="image.output" data-test-id="output-info">
          Output: {{ getTypeLabel(image.output) }}, {{ formatBytes(image.output.size) }}
          <template v-if="image.output !== image.source">
            ({{ getSizeDelta({ originalSize: image.source.size, outputSize: image.output.size }) > 0 ? '+' : '' }}{{ getSizeDelta({ originalSize: image.source.size, outputSize: image.output.size }) }}%)
          </template>
        </span>
      </div>

      <c-alert v-if="isOutputFormatUnsupported(image)" type="warning" mt-3>
        Your browser cannot encode {{ outputFormats[image.outputFormat!].label }}. The image downloads as {{ getTypeLabel(image.output!) }}.
      </c-alert>

      <div mt-3 flex flex-wrap items-center gap-2>
        <c-input-text
          v-model:value="image.fileName"
          :placeholder="getDefaultFileName({ date: image.createdAt })"
          test-id="file-name"
          min-w-200px flex-1
        />
        <div op-60>
          .{{ getExtensionFromMimeType(image.output?.type ?? outputFormats[format].mimeType) }}
        </div>
      </div>

      <div mt-3 flex flex-wrap justify-end gap-2>
        <c-button :disabled="!image.output" @click="copyDataUrl(image)">
          Copy as base64
        </c-button>
        <c-button @click="copyImage(image)">
          <span mr-2><icon-mdi-content-copy /></span>
          Copy image
        </c-button>
        <c-button type="primary" :disabled="!image.outputUrl" data-test-id="download" @click="downloadImage(image)">
          <span mr-2><icon-mdi-download /></span>
          Download
        </c-button>
        <c-tooltip tooltip="Remove from the list">
          <c-button circle variant="text" aria-label="Remove" @click="removeImage(image)">
            <icon-mdi-delete-outline />
          </c-button>
        </c-tooltip>
      </div>
    </c-card>
  </div>
</template>

<style lang="less" scoped>
// A checkerboard behind the preview makes transparent areas visible.
.preview img {
  background-image: conic-gradient(rgba(128, 128, 128, 0.2) 25%, transparent 0 50%, rgba(128, 128, 128, 0.2) 0 75%, transparent 0);
  background-size: 16px 16px;
}
</style>
