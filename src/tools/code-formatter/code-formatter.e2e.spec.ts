import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

async function expectCopiedCode(page: Page, expected: string) {
  await page.getByRole('button', { name: 'Copy formatted code' }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(expected);
  await expect(page.getByText('Copied!', { exact: true })).toBeVisible();
}

async function editFormattedCode(page: Page, value: string) {
  const editor = page.getByRole('textbox', { name: 'Formatted code', exact: true });
  await editor.focus();
  const modifier = await page.evaluate(() => navigator.userAgent.includes('Macintosh') ? 'Meta' : 'Control');
  await editor.press(`${modifier}+A`);
  // Firefox delivers insertText as an IME composition. Monaco cannot replace a composition that spans lines.
  for (const [index, line] of value.split('\n').entries()) {
    if (index > 0) {
      await page.keyboard.press('Enter');
    }
    if (line) {
      await page.keyboard.insertText(line);
    }
  }
}

test.describe('Tool - Code formatter', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      let clipboard = '';
      const queryPermission = navigator.permissions.query.bind(navigator.permissions);
      navigator.permissions.query = async (descriptor) => {
        if (['clipboard-read', 'clipboard-write'].includes(descriptor.name)) {
          return Object.assign(new EventTarget(), {
            state: 'granted' as const,
            name: descriptor.name,
            onchange: null,
          });
        }
        return queryPermission(descriptor);
      };
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (value: string) => { clipboard = value; },
          write: async (items: ClipboardItem[]) => {
            clipboard = await (await items[0].getType('text/plain')).text();
          },
          readText: async () => clipboard,
        },
      });
    });
    await page.goto('/code-formatter');
  });

  test('Has correct title', async ({ page }) => {
    await expect(page).toHaveTitle('Code formatter - Toolbox');
  });

  test('Detects and formats JavaScript', async ({ page }) => {
    await page.getByTestId('input').fill('function a(){return 1}');

    await expect(page.getByTestId('detected-language')).toHaveText('Detected language: JavaScript');
    await expectCopiedCode(page, 'function a() {\n  return 1\n}');
  });

  test('Detects and formats JSON', async ({ page }) => {
    await page.getByTestId('input').fill('{"a":1}');

    await expect(page.getByTestId('detected-language')).toHaveText('Detected language: JSON');
    await expectCopiedCode(page, '{\n  "a": 1\n}');
  });

  test('Shows an error for invalid JSON', async ({ page }) => {
    await page.getByTestId('input').fill('{"a":1,}');

    await expect(page.getByText('Provided JSON is not valid.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copy formatted code' })).toBeDisabled();
  });

  test('Copies the latest output edits without changing the source', async ({ page }) => {
    const source = '{"a":1}';
    await page.getByTestId('input').fill(source);
    await editFormattedCode(page, '  {"edited": true}\n\n');

    await expectCopiedCode(page, '  {"edited": true}\n\n');
    await expect(page.getByTestId('input')).toHaveValue(source);

    await editFormattedCode(page, 'second edit');
    await expectCopiedCode(page, 'second edit');
  });

  test('Disables Copy when the output is cleared and supports undo', async ({ page }) => {
    await page.getByTestId('input').fill('{"a":1}');
    await editFormattedCode(page, 'edited output');
    const editor = page.getByRole('textbox', { name: 'Formatted code', exact: true });
    const modifier = await page.evaluate(() => navigator.userAgent.includes('Macintosh') ? 'Meta' : 'Control');
    await editor.press(`${modifier}+A`);
    await editor.press('Backspace');

    await expect(page.getByRole('button', { name: 'Copy formatted code' })).toBeDisabled();
    await expect(page.getByTestId('input')).toHaveValue('{"a":1}');

    await editor.press(`${modifier}+Z`);
    await expectCopiedCode(page, 'edited output');
  });

  test('Regenerates output after source and settings changes', async ({ page }) => {
    await editFormattedCode(page, 'edited output');
    await page.getByTestId('input').fill('{"a":1}');
    await expectCopiedCode(page, '{\n  "a": 1\n}');

    await editFormattedCode(page, 'another edit');
    await page.getByRole('textbox', { name: 'Indent size', exact: true }).fill('4');
    await page.getByRole('textbox', { name: 'Indent size', exact: true }).press('Tab');
    await expectCopiedCode(page, '{\n    "a": 1\n}');
  });
});
