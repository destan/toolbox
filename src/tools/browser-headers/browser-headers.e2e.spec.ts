import { expect, test } from '@playwright/test';

const echoUrl = 'https://echo.free.beeceptor.com/';
const corsHeaders = { 'access-control-allow-origin': '*' };

test.describe('Tool - Browser headers', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/browser-headers');
  });

  test('Has correct title', async ({ page }) => {
    await expect(page).toHaveTitle('Browser headers - Toolbox');
  });

  test('Sends nothing until the user clicks the button', async ({ page }) => {
    let requestCount = 0;
    await page.route(echoUrl, async (route) => {
      requestCount += 1;
      await route.fulfill({ headers: corsHeaders, json: { ip: '203.0.113.7', headers: { Accept: '*/*' } } });
    });

    await page.reload();
    await expect(page.getByRole('button', { name: 'Show my headers' })).toBeVisible();
    expect(requestCount).toBe(0);

    await page.getByRole('button', { name: 'Show my headers' }).click();
    await expect(page.getByTestId('public-ip')).toContainText('203.0.113.7');
    expect(requestCount).toBe(1);
  });

  test('Shows the echoed headers and the public IP address', async ({ page }) => {
    await page.route(echoUrl, route => route.fulfill({
      headers: corsHeaders,
      json: { ip: '203.0.113.7', headers: { 'Accept': '*/*', 'User-Agent': 'test-agent' } },
    }));

    await page.getByRole('button', { name: 'Show my headers' }).click();

    await expect(page.getByTestId('public-ip')).toContainText('203.0.113.7');
    await expect(page.getByRole('row', { name: 'User-Agent test-agent' })).toBeVisible();
  });

  test('Renders echoed values as text', async ({ page }) => {
    const markup = '<img src=x onerror="window.injected = true">';
    await page.route(echoUrl, route => route.fulfill({ headers: corsHeaders, json: { ip: '203.0.113.7', headers: { 'X-Test': markup } } }));

    await page.getByRole('button', { name: 'Show my headers' }).click();

    await expect(page.getByRole('cell', { name: markup })).toBeVisible();
    expect(await page.evaluate(() => 'injected' in window)).toBe(false);
  });

  test('Shows an error and allows a retry when the request fails', async ({ page }) => {
    await page.route(echoUrl, route => route.fulfill({ status: 429, headers: corsHeaders, body: 'Too many requests' }));

    await page.getByRole('button', { name: 'Show my headers' }).click();

    await expect(page.getByText('Beeceptor responded with HTTP status 429.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Show my headers' })).toBeEnabled();
  });
});
