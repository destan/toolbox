import { Buffer } from 'node:buffer';
import { expect, test } from '@playwright/test';

const SAMPLE_DIFF = [
  'diff --git a/src/app.ts b/src/app.ts',
  '--- a/src/app.ts',
  '+++ b/src/app.ts',
  '@@ -1,2 +1,3 @@',
  ' const a = 1;',
  '-const b = 2;',
  '+const b = 3;',
  '+const c = 4;',
  'diff --git a/new.txt b/new.txt',
  'new file mode 100644',
  '--- /dev/null',
  '+++ b/new.txt',
  '@@ -0,0 +1 @@',
  '+hello',
].join('\n');

test.describe('Tool - Diff file analyzer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/diff-file-analyzer');
  });

  test('Has correct title', async ({ page }) => {
    await expect(page).toHaveTitle('Diff file analyzer - Toolbox');
  });

  test('lists the files with their stats', async ({ page }) => {
    await page.getByTestId('input').fill(SAMPLE_DIFF);

    await expect(page.getByTestId('summary')).toHaveText(/^2 files\s*\+3\s*−1\s*0 \/ 2 read$/);
    const files = page.getByTestId('file-list').locator('li');
    await expect(files).toHaveCount(2);
    await expect(files.first()).toContainText('src/app.ts');
    await expect(files.nth(1)).toContainText('added');
  });

  test('shows the diff side by side or unified, and marks the changed words', async ({ page }) => {
    await page.getByTestId('input').fill(SAMPLE_DIFF);
    const firstFile = page.getByTestId('diff-file').first();

    await expect(firstFile.locator('tbody tr')).toHaveCount(4);
    await expect(firstFile.locator('.delete .word-changed')).toHaveText('2');
    await expect(firstFile.locator('.add .word-changed')).toHaveText('3');

    await page.getByTestId('view').getByText('Unified').click();
    await expect(firstFile.locator('tbody tr')).toHaveCount(5);
  });

  test('collapses a file section', async ({ page }) => {
    await page.getByTestId('input').fill(SAMPLE_DIFF);
    const firstFile = page.getByTestId('diff-file').first();

    await firstFile.locator('.file-header').click();
    await expect(firstFile.locator('table')).toBeHidden();
    await firstFile.locator('.file-header').click();
    await expect(firstFile.locator('table')).toBeVisible();
  });

  test('collapses and expands all the files', async ({ page }) => {
    await page.getByTestId('input').fill(SAMPLE_DIFF);
    const tables = page.getByTestId('diff-file').locator('table');

    await page.getByTestId('toggle-all').click();
    await expect(tables.first()).toBeHidden();
    await expect(tables.nth(1)).toBeHidden();
    await expect(page.getByTestId('toggle-all')).toHaveText('Expand all');

    await page.getByTestId('toggle-all').click();
    await expect(tables.first()).toBeVisible();
    await expect(tables.nth(1)).toBeVisible();
  });

  test('collapses a file marked as read and counts it', async ({ page }) => {
    await page.getByTestId('input').fill(SAMPLE_DIFF);
    const firstFile = page.getByTestId('diff-file').first();

    await firstFile.getByTestId('read').click();
    await expect(firstFile.locator('table')).toBeHidden();
    await expect(page.getByTestId('read-count')).toHaveText('1 / 2 read');
    await expect(page.getByTestId('file-list').locator('li').first()).toHaveClass(/is-read/);

    await firstFile.getByTestId('read').click();
    await expect(firstFile.locator('table')).toBeVisible();
    await expect(page.getByTestId('read-count')).toHaveText('0 / 2 read');
  });

  test('shows the first 10 files of a long file list and the others on request', async ({ page }) => {
    const longDiff = Array.from({ length: 12 }, (_, index) => [
      `diff --git a/file${index}.txt b/file${index}.txt`,
      `--- a/file${index}.txt`,
      `+++ b/file${index}.txt`,
      '@@ -1 +1 @@',
      '-old',
      '+new',
    ].join('\n')).join('\n');
    await page.getByTestId('input').fill(longDiff);
    const items = page.getByTestId('file-list').locator('li');

    await expect(items).toHaveCount(10);
    await page.getByTestId('toggle-file-list').click();
    await expect(items).toHaveCount(12);
    await expect(page.getByTestId('toggle-file-list')).toHaveText('See less');
    await page.getByTestId('toggle-file-list').click();
    await expect(items).toHaveCount(10);
  });

  test('reads an uploaded patch file', async ({ page }) => {
    await page.locator('input[type=file]').setInputFiles({ name: 'change.patch', mimeType: 'text/x-patch', buffer: Buffer.from(SAMPLE_DIFF) });

    await expect(page.getByTestId('diff-file')).toHaveCount(2);
  });

  test('tells when the input is not a diff', async ({ page }) => {
    await page.getByTestId('input').fill('hello');

    await expect(page.getByText('No diff found in the input.')).toBeVisible();
  });
});
