import { Buffer } from 'node:buffer';
import { expect, test } from '@playwright/test';

const SAMPLE_EML = [
  'Received: by mx.example.org with SMTP id abc; Tue, 2 Jan 2024 18:00:05 +0000',
  'Received: from mail.example.com (mail.example.com [192.0.2.1]) by mx.example.org with ESMTPS id xyz; Tue, 2 Jan 2024 18:00:00 +0000',
  'Authentication-Results: mx.example.org; spf=pass smtp.mailfrom=alice@example.com; dkim=pass header.d=example.com; dmarc=fail header.from=example.com',
  'Subject: =?UTF-8?Q?Caf=C3=A9?=',
  '',
  'Body: not a header',
].join('\r\n');

test.describe('Tool - EML header parser', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/eml-header-parser');
  });

  test('Has correct title', async ({ page }) => {
    await expect(page).toHaveTitle('EML header parser - Toolbox');
  });

  test('lists the pasted headers and filters them by name or value', async ({ page }) => {
    await page.getByTestId('input').fill(SAMPLE_EML);

    const rows = page.getByTestId('headers-table').locator('tbody tr');
    await expect(rows).toHaveCount(4);
    await expect(rows.nth(3)).toContainText('Café');

    await page.getByTestId('filter').fill('subject');
    await expect(rows).toHaveCount(1);

    await page.getByTestId('filter').fill('192.0.2.1');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('Received');
  });

  test('reads only the headers of an uploaded EML file', async ({ page }) => {
    await page.locator('input[type=file]').setInputFiles({ name: 'mail.eml', mimeType: 'message/rfc822', buffer: Buffer.from(SAMPLE_EML) });

    await expect(page.getByTestId('input')).not.toHaveValue(/Body/);
    await expect(page.getByTestId('headers-table').locator('tbody tr')).toHaveCount(4);
  });

  test('shows the authentication verdicts and the relay hops in tabs', async ({ page }) => {
    await page.getByTestId('input').fill(SAMPLE_EML);
    await expect(page.getByRole('table', { name: 'Authentication results' })).toBeHidden();

    await page.getByText('SPF, DKIM and DMARC (1)', { exact: true }).click();
    const verdicts = page.getByRole('table', { name: 'Authentication results' }).locator('tbody tr');
    await expect(verdicts).toHaveCount(3);
    await expect(verdicts.nth(2)).toContainText('fail');
    await expect(verdicts.nth(2)).toContainText('Your server');

    await page.getByText('Relay hops (2)', { exact: true }).click();
    const hops = page.getByTestId('relay-hops').locator('> li');
    await expect(hops).toHaveCount(2);
    await expect(hops.first()).toContainText('mail.example.com');
    await expect(hops.nth(1)).toContainText('+5 s');
  });

  test('copies all the headers, also when a filter is active', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'Only Chromium supports granting clipboard permissions');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.getByTestId('input').fill(SAMPLE_EML);
    await page.getByTestId('filter').fill('subject');

    await page.getByTestId('copy-json').click();
    await expect.poll(async () => JSON.parse(await page.evaluate(() => navigator.clipboard.readText())).length).toBe(4);

    await page.getByTestId('copy-text').click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toMatch(/^Received: by mx\.example\.org.*\nSubject: Café$/s);
  });
});
