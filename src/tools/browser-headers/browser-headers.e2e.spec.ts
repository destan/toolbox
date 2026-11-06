import { expect, test } from '@playwright/test';
import { ECHO_URL } from './browser-headers.service';

const corsHeaders = { 'access-control-allow-origin': '*' };
const echoBody = { ip: '203.0.113.7', headers: { 'Accept': '*/*', 'User-Agent': 'test-agent' } };

test.describe('Tool - Browser headers', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/browser-headers');
  });

  test('Has correct title', async ({ page }) => {
    await expect(page).toHaveTitle('Browser headers - Toolbox');
  });

  test('Sends nothing until the user clicks the button', async ({ page }) => {
    let requestCount = 0;
    await page.route(ECHO_URL, async (route) => {
      requestCount += 1;
      await route.fulfill({ headers: corsHeaders, json: echoBody });
    });

    await page.reload();
    await expect(page.getByRole('button', { name: 'Show my headers' })).toBeVisible();
    expect(requestCount).toBe(0);

    await page.getByRole('button', { name: 'Show my headers' }).click();
    await expect(page.getByTestId('public-ip')).toContainText('203.0.113.7');
    expect(requestCount).toBe(1);
  });

  test('Shows the echoed headers and the public IP address', async ({ page }) => {
    await page.route(ECHO_URL, route => route.fulfill({ headers: corsHeaders, json: echoBody }));

    await page.getByRole('button', { name: 'Show my headers' }).click();

    await expect(page.getByTestId('public-ip')).toContainText('203.0.113.7');
    await expect(page.getByRole('row', { name: 'User-Agent test-agent' })).toBeVisible();
  });

  test('Shows the warnings of the echo service', async ({ page }) => {
    await page.route(ECHO_URL, route => route.fulfill({ headers: corsHeaders, json: { ...echoBody, warnings: ['Duplicate headers found: x-dup'] } }));

    await page.getByRole('button', { name: 'Show my headers' }).click();

    await expect(page.getByText('Duplicate headers found: x-dup')).toBeVisible();
  });

  test('Copies the headers', async ({ page }) => {
    await page.route(ECHO_URL, route => route.fulfill({ headers: corsHeaders, json: echoBody }));

    await page.getByRole('button', { name: 'Show my headers' }).click();
    await page.getByRole('button', { name: 'Copy headers' }).click();

    await expect(page.getByText('Headers copied to the clipboard')).toBeVisible();
  });

  test('Renders echoed values as text', async ({ page }) => {
    const markup = '<img src=x onerror="window.injected = true">';
    await page.route(ECHO_URL, route => route.fulfill({ headers: corsHeaders, json: { ip: '203.0.113.7', headers: { 'X-Test': markup } } }));

    await page.getByRole('button', { name: 'Show my headers' }).click();

    await expect(page.getByRole('cell', { name: markup })).toBeVisible();
    expect(await page.evaluate(() => 'injected' in window)).toBe(false);
  });

  test('Shows progress while the request runs', async ({ page }) => {
    let releaseResponse = () => {};
    const responseReleased = new Promise<void>((resolve) => {
      releaseResponse = resolve;
    });
    await page.route(ECHO_URL, async (route) => {
      await responseReleased;
      await route.fulfill({ headers: corsHeaders, json: echoBody });
    });

    await page.getByRole('button', { name: 'Show my headers' }).click();
    await expect(page.getByRole('button', { name: 'Reading headers...' })).toHaveClass(/disabled/);
    await expect(page.getByRole('button', { name: 'Reading headers...' })).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByTestId('status')).toHaveText('Reading headers');

    releaseResponse();
    await expect(page.getByRole('button', { name: 'Show my headers' })).not.toHaveClass(/disabled/);
    await expect(page.getByTestId('status')).toHaveText('The headers are ready');
  });

  test('Clears the error when a retry succeeds', async ({ page }) => {
    await page.route(ECHO_URL, route => route.fulfill({ status: 429, headers: corsHeaders, body: 'Too many requests' }));
    await page.getByRole('button', { name: 'Show my headers' }).click();
    await expect(page.getByText('Beeceptor responded with HTTP status 429.')).toBeVisible();
    await expect(page.getByTestId('status')).toHaveText('The tool could not read the headers');

    await page.unroute(ECHO_URL);
    await page.route(ECHO_URL, route => route.fulfill({ headers: corsHeaders, json: echoBody }));
    await page.getByRole('button', { name: 'Show my headers' }).click();

    await expect(page.getByTestId('public-ip')).toContainText('203.0.113.7');
    await expect(page.getByText('Beeceptor responded with HTTP status 429.')).toBeHidden();
  });

  test('Keeps the previous result when a retry fails', async ({ page }) => {
    await page.route(ECHO_URL, route => route.fulfill({ headers: corsHeaders, json: echoBody }));
    await page.getByRole('button', { name: 'Show my headers' }).click();
    await expect(page.getByTestId('public-ip')).toContainText('203.0.113.7');

    await page.unroute(ECHO_URL);
    await page.route(ECHO_URL, route => route.fulfill({ status: 503, headers: corsHeaders, body: 'Unavailable' }));
    await page.getByRole('button', { name: 'Show my headers' }).click();

    await expect(page.getByText('Beeceptor responded with HTTP status 503.')).toBeVisible();
    await expect(page.getByText('The result below comes from the previous request.')).toBeVisible();
    await expect(page.getByTestId('public-ip')).toContainText('203.0.113.7');
  });
});
