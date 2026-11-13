import { expect, test } from '@playwright/test';

test.describe('Tool - HTML to Markdown', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/html-to-markdown');
  });

  test('Has correct title', async ({ page }) => {
    await expect(page).toHaveTitle('HTML to Markdown - Toolbox');
  });

  test('Converts HTML to Markdown', async ({ page }) => {
    await page.getByTestId('input').fill('<h1>Title</h1><p>Some <strong>bold</strong> and <a href="https://example.com">link</a>.</p><ul><li>one</li><li>two</li></ul>');

    const markdown = await page.getByTestId('area-content').innerText();

    expect(markdown.trim()).toEqual(
      `
# Title

Some **bold** and [link](https://example.com).

-   one
-   two
      `.trim(),
    );
  });

  test('Converts GFM tables and strikethrough', async ({ page }) => {
    await page.getByTestId('input').fill('<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table><p><del>gone</del></p>');

    const markdown = await page.getByTestId('area-content').innerText();

    expect(markdown).toContain('| A | B |');
    expect(markdown).toContain('| 1 | 2 |');
    expect(markdown).toContain('~~gone~~');
  });

  test('Drops script and style content', async ({ page }) => {
    await page.getByTestId('input').fill('<style>p { color: red }</style><script>alert(1)</script><p>kept</p>');

    const markdown = await page.getByTestId('area-content').innerText();

    expect(markdown.trim()).toEqual('kept');
  });

  test('Converts rich text pasted from the clipboard', async ({ page, browserName }) => {
    test.skip(browserName === 'firefox', 'Firefox drops text/html from a synthetic ClipboardEvent');
    const input = page.getByTestId('input');
    await input.focus();
    await input.evaluate((element) => {
      const data = new DataTransfer();
      data.setData('text/html', '<p>Pasted <em>rich</em> text</p>');
      data.setData('text/plain', 'Pasted rich text');
      element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
    });

    await expect(input).toHaveValue('<p>Pasted <em>rich</em> text</p>');
    const markdown = await page.getByTestId('area-content').innerText();
    expect(markdown.trim()).toEqual('Pasted _rich_ text');
  });

  test('Keeps pasted HTML source as is', async ({ page, browserName }) => {
    test.skip(browserName === 'firefox', 'Firefox drops text/html from a synthetic ClipboardEvent');
    const input = page.getByTestId('input');
    await input.focus();
    const defaultPrevented = await input.evaluate((element) => {
      const data = new DataTransfer();
      data.setData('text/html', '<span style="color:red">&lt;b&gt;bold&lt;/b&gt;</span>');
      data.setData('text/plain', '<b>bold</b>');
      const event = new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true });
      element.dispatchEvent(event);
      return event.defaultPrevented;
    });

    expect(defaultPrevented).toBe(false);
  });

  test('Preview renders the HTML input in a sandboxed frame', async ({ page }) => {
    await page.getByTestId('input').fill('<h2>Preview heading</h2>');
    await page.getByText('HTML input preview', { exact: true }).click();

    const frame = page.getByTestId('html-preview');
    await expect(frame).toHaveAttribute('sandbox', '');
    await expect(page.frameLocator('[data-test-id="html-preview"]').getByRole('heading', { name: 'Preview heading' })).toBeVisible();
  });

  test('Downloads the Markdown', async ({ page }) => {
    await page.getByTestId('input').fill('<h1>Title</h1>');

    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('download-markdown').click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe('document.md');
  });

  test('Swaps to Markdown to HTML with the Markdown output as input, and keeps the HTML input for Back', async ({ page }) => {
    await page.getByTestId('input').fill('<h1>Title</h1>');

    await page.getByTestId('reverse-conversion').click();

    await expect(page).toHaveURL(/\/markdown-to-html$/);
    await expect(page.getByPlaceholder('Your Markdown content...')).toHaveValue('# Title');

    await page.goBack();

    await expect(page).toHaveURL(/\/html-to-markdown$/);
    await expect(page.getByTestId('input')).toHaveValue('<h1>Title</h1>');
  });

  test('Opens Markdown to HTML without content on a modified click', async ({ page, context }) => {
    await page.getByTestId('input').fill('<h1>Title</h1>');

    const newPagePromise = context.waitForEvent('page');
    await page.getByTestId('reverse-conversion').click({ modifiers: ['ControlOrMeta'] });
    const newPage = await newPagePromise;

    await expect(newPage).toHaveURL(/\/markdown-to-html$/);
    await expect(newPage.getByPlaceholder('Your Markdown content...')).toHaveValue('');
    await expect(page).toHaveURL(/\/html-to-markdown$/);
  });
});
