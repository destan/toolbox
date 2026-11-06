import { expect, test } from '@playwright/test';

test.describe('Tool - Code formatter', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/code-formatter');
  });

  test('Has correct title', async ({ page }) => {
    await expect(page).toHaveTitle('Code formatter - Toolbox');
  });

  test('Detects and formats JavaScript', async ({ page }) => {
    await page.getByTestId('input').fill('function a(){return 1}');

    await expect(page.getByTestId('detected-language')).toHaveText('Detected language: JavaScript');

    const formattedCode = await page.getByTestId('area-content').innerText();

    expect(formattedCode.trim()).toEqual(`
function a() {
  return 1
}`.trim());
  });

  test('Detects and formats JSON', async ({ page }) => {
    await page.getByTestId('input').fill('{"a":1}');

    await expect(page.getByTestId('detected-language')).toHaveText('Detected language: JSON');

    const formattedCode = await page.getByTestId('area-content').innerText();

    expect(formattedCode.trim()).toEqual(`
{
  "a": 1
}`.trim());
  });

  test('Shows an error for invalid JSON', async ({ page }) => {
    await page.getByTestId('input').fill('{"a":1,}');

    await expect(page.getByText('Provided JSON is not valid.')).toBeVisible();
  });
});
