const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

test.beforeEach(async ({ context }) => {
  await context.route('**/*', (route) => new URL(route.request().url()).hostname === '127.0.0.1'
    ? route.continue() : route.abort());
});

for (const path of ['/card/', '/card/life/']) {
  test(`${path} keeps keyboard focus inside the QR dialog`, async ({ page }) => {
    await page.goto(path);
    await page.locator('#showQr').click();
    await expect(page.locator('#closeQr')).toBeFocused();
    await expect(page.locator('main')).toHaveAttribute('inert', '');
    for (const key of ['Tab', 'Shift+Tab']) {
      await page.keyboard.press(key);
      await expect(page.locator('#closeQr')).toBeFocused();
    }
    await page.keyboard.press('Escape');
    await expect(page.locator('#qrOverlay')).toBeHidden();
    await expect(page.locator('#showQr')).toBeFocused();
    await expect(page.locator('main')).not.toHaveAttribute('inert', '');

    await page.goto(path + '#qr');
    await expect(page.locator('#qrCampaignInput')).toBeFocused();
    await page.locator('#closeQr').focus();
    await page.keyboard.press('Shift+Tab');
    await expect(page.locator('[data-format="png"]')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('#closeQr')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(new RegExp(path + '$'));
    await expect(page.locator('#showQr')).toBeFocused();
  });

  test(`${path} text and dialog meet automated accessibility checks`, async ({ page }, testInfo) => {
    await page.goto(path);
    for (const lang of ['zh', 'en', 'ja']) {
      await page.locator(`.lang-option[data-value="${lang}"]`).click();
      const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(result.violations).toEqual([]);
    }
    await page.screenshot({ path: testInfo.outputPath('card.png'), fullPage: true });
    await page.locator('#showQr').click();
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(result.violations).toEqual([]);
  });

  test(`${path} shows a localized load error and retries the requested campaign`, async ({ page }, testInfo) => {
    await page.route('**/js/vendor/qrcode.mjs*', (route) => route.abort());
    await page.goto(path);
    await page.locator('.lang-option[data-value="en"]').click();
    await page.goto(path + '#qr=conference');
    await expect(page.locator('#qrStatus')).toContainText('Could not load');
    await expect(page.locator('#qrStatus')).toContainText('default card QR');
    await expect(page.locator('#qrOverlayPlate svg')).toHaveAttribute('aria-label', /utm_campaign=card&/);
    await expect(page.locator('#retryQr')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('qr-error.png'), fullPage: true });
    await page.unroute('**/js/vendor/qrcode.mjs*');
    await page.locator('#retryQr').click();
    await expect(page.locator('#qrOverlayPlate svg')).toHaveAttribute('aria-label', /utm_campaign=conference&/);
    await expect(page.locator('#qrStatus')).toBeEmpty();
    await expect(page.locator('#retryQr')).toBeHidden();
    await expect(page.locator('#qrCampaignInput')).toBeFocused();
  });

  test(`${path} reports overlong campaigns and recovers after editing`, async ({ page }) => {
    await page.goto(path + '#qr');
    await page.locator('#qrCampaignInput').fill('x'.repeat(4000));
    await expect(page.locator('#qrStatus')).toContainText('請縮短活動名稱');
    await expect(page.locator('#qrOverlayPlate svg')).toHaveAttribute('aria-label', /utm_campaign=card&/);
    await page.locator('#qrCampaignInput').fill('short');
    await expect(page.locator('#qrOverlayPlate svg')).toHaveAttribute('aria-label', /utm_campaign=short&/);
    await expect(page.locator('#qrStatus')).toBeEmpty();
  });

  test(`${path} reports PNG failures and retries without downloading an empty file`, async ({ page }) => {
    await page.addInitScript(() => {
      const toBlob = HTMLCanvasElement.prototype.toBlob;
      HTMLCanvasElement.prototype.toBlob = function (callback, ...args) {
        HTMLCanvasElement.prototype.toBlob = toBlob;
        callback(null);
      };
      Object.defineProperty(navigator, 'canShare', { value: () => false, configurable: true });
    });
    await page.goto(path + '#qr=download');
    await expect(page.locator('#qrOverlayUrl')).toHaveText('campaign: download');
    const downloads = [];
    page.on('download', (download) => downloads.push(download));
    await page.locator('[data-format="png"]').click();
    await expect(page.locator('#qrStatus')).toContainText('無法準備 QR 檔案');
    await expect(page.locator('[data-format="png"]')).toBeEnabled();
    expect(downloads).toHaveLength(0);
    const downloaded = page.waitForEvent('download');
    await page.locator('#retryQr').click();
    expect((await downloaded).suggestedFilename()).toBe('wei-lee-card-download.png');
    await expect(page.locator('#qrStatus')).toBeEmpty();
  });

  test(`${path} late generation cannot overwrite the default QR or reopen a closed dialog`, async ({ page }) => {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    await page.route('**/js/vendor/qrcode.mjs*', async (route) => {
      await gate;
      await route.continue();
    });
    const requested = page.waitForRequest('**/js/vendor/qrcode.mjs');
    await page.goto(path + '#qr=pending');
    await requested;
    await page.locator('#qrCampaignInput').fill('');
    await expect(page.locator('#qrOverlayPlate svg')).toHaveAttribute('aria-label', /utm_campaign=card&/);
    const response = page.waitForResponse('**/js/vendor/qrcode.mjs');
    release();
    await response;
    // Wait for module evaluation and the earlier render continuation to settle.
    await page.evaluate(() => import('/js/vendor/qrcode.mjs'));
    await expect(page.locator('#qrOverlayPlate svg')).toHaveAttribute('aria-label', /utm_campaign=card&/);
    await expect(page.locator('#qrStatus')).toBeEmpty();
    await page.clock.install();
    await page.locator('#qrCampaignInput').fill('not-saved');
    await page.keyboard.press('Escape');
    await page.clock.fastForward(250);
    await expect(page.locator('#qrOverlay')).toBeHidden();
    await expect(page).toHaveURL(new RegExp(path + '$'));
  });
}
