import { type Page, expect, test } from '@playwright/test';

async function pasteImage(page: Page) {
  await page.evaluate(async () => {
    // A 2x1 PNG with one red and one transparent pixel.
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 1;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#ff0000';
    context.fillRect(0, 0, 1, 1);
    const png = await new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!), 'image/png'));

    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(new File([png], 'image.png', { type: 'image/png' }));
    document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dataTransfer, bubbles: true }));
  });
}

test.describe('Tool - Paste image', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/paste-image');
  });

  test('Has title', async ({ page }) => {
    await expect(page).toHaveTitle('Paste image - IT Tools');
  });

  test('A pasted image is added to the history and can be downloaded', async ({ page }) => {
    await pasteImage(page);
    await pasteImage(page);

    await expect(page.getByTestId('pasted-image')).toHaveCount(2);
    await expect(page.getByTestId('output-info').first()).toContainText('Output: PNG');

    await page.getByTestId('file-name').first().fill('my-screenshot');

    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('download').first().click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe('my-screenshot.png');
  });

  test('The selected format converts the pasted image', async ({ page }) => {
    await pasteImage(page);
    await page.getByRole('button', { name: 'JPEG' }).click();

    await expect(page.getByTestId('output-info')).toContainText('Output: JPEG');

    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('download').click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^pasted-image-\d{8}-\d{6}\.jpg$/);
  });
});
