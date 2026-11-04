import { describe, expect, it } from 'vitest';
import { convertImage, getDefaultFileName, getExtensionFromMimeType, getImageFromDataTransfer, getSizeDelta } from './paste-image.service';

function createDataTransfer(items: { kind: string; type: string; file?: File }[]) {
  return {
    items: items.map(({ kind, type, file }) => ({ kind, type, getAsFile: () => file ?? null })),
  } as unknown as DataTransfer;
}

describe('paste-image', () => {
  describe('getDefaultFileName', () => {
    it('builds a sortable file name from the date', () => {
      expect(getDefaultFileName({ date: new Date(2026, 10, 4, 9, 5, 7) })).toBe('pasted-image-20261104-090507');
    });
  });

  describe('getExtensionFromMimeType', () => {
    it('maps common image mime types to their usual extension', () => {
      expect(getExtensionFromMimeType('image/png')).toBe('png');
      expect(getExtensionFromMimeType('image/jpeg')).toBe('jpg');
      expect(getExtensionFromMimeType('image/webp')).toBe('webp');
      expect(getExtensionFromMimeType('image/svg+xml')).toBe('svg');
    });

    it('falls back to the mime subtype for unknown image types', () => {
      expect(getExtensionFromMimeType('image/x-icon')).toBe('x-icon');
    });
  });

  describe('getImageFromDataTransfer', () => {
    it('returns the first image file of the clipboard data', () => {
      const image = new File(['image'], 'image.png', { type: 'image/png' });
      const dataTransfer = createDataTransfer([
        { kind: 'string', type: 'text/plain' },
        { kind: 'file', type: 'image/png', file: image },
      ]);

      expect(getImageFromDataTransfer(dataTransfer)).toBe(image);
    });

    it('returns undefined when the clipboard data has no image', () => {
      const dataTransfer = createDataTransfer([
        { kind: 'string', type: 'text/plain' },
        { kind: 'file', type: 'application/pdf', file: new File(['pdf'], 'doc.pdf', { type: 'application/pdf' }) },
      ]);

      expect(getImageFromDataTransfer(dataTransfer)).toBeUndefined();
      expect(getImageFromDataTransfer(null)).toBeUndefined();
    });
  });

  describe('convertImage', () => {
    it('keeps the original bytes when a PNG image is converted to PNG', async () => {
      const source = new Blob(['png'], { type: 'image/png' });
      const image = { width: 1, height: 1 } as HTMLImageElement;

      expect(await convertImage({ source, image, format: 'png', quality: 90 })).toBe(source);
    });
  });

  describe('getSizeDelta', () => {
    it('returns the size change in percent', () => {
      expect(getSizeDelta({ originalSize: 1000, outputSize: 250 })).toBe(-75);
      expect(getSizeDelta({ originalSize: 1000, outputSize: 1500 })).toBe(50);
      expect(getSizeDelta({ originalSize: 0, outputSize: 1500 })).toBe(0);
    });
  });
});
