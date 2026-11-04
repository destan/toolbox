import { format as formatDate } from 'date-fns';

export {
  outputFormats,
  getDefaultFileName,
  getExtensionFromMimeType,
  getImageFromDataTransfer,
  readImageFromClipboard,
  convertImage,
  blobToDataUrl,
  writeImageToClipboard,
  getSizeDelta,
};

export type OutputFormat = 'png' | 'jpeg' | 'webp';

const outputFormats: Record<OutputFormat, { label: string; mimeType: string; isLossy: boolean }> = {
  png: { label: 'PNG', mimeType: 'image/png', isLossy: false },
  jpeg: { label: 'JPEG', mimeType: 'image/jpeg', isLossy: true },
  webp: { label: 'WebP', mimeType: 'image/webp', isLossy: true },
};

const extensionsByMimeType: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
  'image/tiff': 'tiff',
};

function getDefaultFileName({ date }: { date: Date }) {
  return `pasted-image-${formatDate(date, 'yyyyMMdd-HHmmss')}`;
}

function getExtensionFromMimeType(mimeType: string) {
  return extensionsByMimeType[mimeType] ?? mimeType.replace(/^image\//, '').replace(/\+.*$/, '');
}

function getImageFromDataTransfer(dataTransfer: DataTransfer | null | undefined): File | undefined {
  if (!dataTransfer) {
    return undefined;
  }

  const imageItem = Array.from(dataTransfer.items ?? []).find(item => item.kind === 'file' && item.type.startsWith('image/'));

  return imageItem?.getAsFile() ?? undefined;
}

async function readImageFromClipboard(): Promise<Blob | undefined> {
  const clipboardItems = await navigator.clipboard.read();

  for (const clipboardItem of clipboardItems) {
    const imageType = clipboardItem.types.find(type => type.startsWith('image/'));

    if (imageType) {
      return clipboardItem.getType(imageType);
    }
  }

  return undefined;
}

function canvasToBlob({ canvas, mimeType, quality }: { canvas: HTMLCanvasElement; mimeType: string; quality?: number }) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error('The browser could not encode the image.'))),
      mimeType,
      quality,
    );
  });
}

async function convertImage({ source, image, format, quality }: {
  source: Blob
  image: CanvasImageSource & { width: number; height: number }
  format: OutputFormat
  quality: number
}): Promise<Blob> {
  const { mimeType, isLossy } = outputFormats[format];

  // Re-encoding a lossless image into the same lossless format gains nothing, so the original bytes are kept.
  if (!isLossy && source.type === mimeType) {
    return source;
  }

  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;

  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('The browser could not create a canvas to convert the image.');
  }

  // JPEG has no alpha channel, so transparent pixels would turn black without a white background.
  if (format === 'jpeg') {
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  context.drawImage(image, 0, 0);

  return canvasToBlob({ canvas, mimeType, quality: isLossy ? quality / 100 : undefined });
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function writeImageToClipboard({ source, image }: { source: Blob; image: CanvasImageSource & { width: number; height: number } }) {
  // Browsers only guarantee clipboard support for PNG images.
  // The promise goes into the ClipboardItem unresolved, because Safari rejects the write once the user gesture is lost to an await.
  const pngBlob = convertImage({ source, image, format: 'png', quality: 100 });

  await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
}

function getSizeDelta({ originalSize, outputSize }: { originalSize: number; outputSize: number }) {
  if (originalSize === 0) {
    return 0;
  }

  return Math.round(((outputSize - originalSize) / originalSize) * 100);
}
