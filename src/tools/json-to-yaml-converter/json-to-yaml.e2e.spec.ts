import { expect, test } from '@playwright/test';

test.describe('Tool - json to yaml', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/json-to-yaml-converter');
  });

  test('Has correct title', async ({ page }) => {
    await expect(page).toHaveTitle('JSON to YAML converter - Toolbox');
  });

  test('json is parsed and output clean yaml', async ({ page }) => {
    await page.getByTestId('input').fill('{"foo":"bar","list":["item",{"key":"value"}]}');

    const generatedJson = await page.getByTestId('area-content').innerText();

    expect(generatedJson.trim()).toEqual('foo: bar\nlist:\n  - item\n  - key: value'.trim());
  });

  test('Swaps to YAML to JSON with the YAML output as input, and keeps the JSON input for Back', async ({ page }) => {
    await page.getByTestId('input').fill('{"foo":"bar"}');

    await page.getByTestId('reverse-conversion').click();

    await expect(page).toHaveURL(/\/yaml-to-json-converter$/);
    await expect(page.getByTestId('input')).toHaveValue('foo: bar\n');

    await page.goBack();

    await expect(page).toHaveURL(/\/json-to-yaml-converter$/);
    await expect(page.getByTestId('input')).toHaveValue('{"foo":"bar"}');
  });
});
