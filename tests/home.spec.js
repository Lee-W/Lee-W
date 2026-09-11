const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

// CI stays offline and never sends visits to production analytics.
test.beforeEach(async ({ context }) => {
  await context.route('**/*', (route) => {
    return new URL(route.request().url()).hostname === '127.0.0.1'
      ? route.continue() : route.abort();
  });
});

const languages = [
  { path: '/', lang: 'zh-Hant', code: 'zh', blogPath: '' },
  { path: '/en/', lang: 'en', code: 'en', blogPath: '/en' },
  { path: '/ja/', lang: 'ja', code: 'ja', blogPath: '/en' },
];

for (const language of languages) {
  test(`${language.code}: readable layout and keyboard navigation`, async ({ page }, testInfo) => {
    await page.goto(language.path);
    await expect(page.locator('html')).toHaveAttribute('lang', language.lang);
    await expect(page.locator('.lang-option[aria-current="page"]')).toHaveAttribute('href', language.path);
    await expect(page.locator('#aboutLink')).toHaveAttribute('href', `https://blog.wei-lee.me${language.blogPath}/pages/about-me`);
    await expect(page.locator('#nowLink')).toHaveAttribute('href', `https://blog.wei-lee.me${language.blogPath}/pages/now`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.locator('.posts time').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(12);
    expect(await page.locator('.path-subtitle').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(12);

    // Verify actual Tab traversal moves through the same sections as the screen.
    const groups = ['.lang-switcher', '.paths', '.now', '.blogs', '.roles', '.social'];
    const boxes = await Promise.all(groups.map((selector) => page.locator(selector).boundingBox()));
    expect(boxes.map((box) => box.y)).toEqual(boxes.map((box) => box.y).sort((a, b) => a - b));
    for (const selector of groups) {
      const links = page.locator(selector === '.now' ? selector : `${selector} a`);
      for (let index = 0; index < await links.count(); index++) {
        await page.keyboard.press('Tab');
        await expect(links.nth(index)).toBeFocused();
      }
    }
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    await page.screenshot({ path: testInfo.outputPath('home.png'), fullPage: true });
    expect(result.violations).toEqual([]);
  });

  test(`${language.code}: localized links work without JavaScript`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    await context.route('**/*', (route) => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    const page = await context.newPage();
    await page.goto(baseURL + language.path + 'index.html');
    await expect(page.locator('html')).toHaveAttribute('lang', language.lang);
    await expect(page.locator('#aboutLink')).toHaveAttribute('href', `https://blog.wei-lee.me${language.blogPath}/pages/about-me`);
    await expect(page.locator('#nowLink')).toHaveAttribute('href', `https://blog.wei-lee.me${language.blogPath}/pages/now`);
    await page.locator('.lang-option[data-value="ja"]').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
    await context.close();
  });
}

test('language survives card navigation and blocked storage', async ({ page }) => {
  await page.goto('/en/index.html');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.locator('.social a[href^="/card/"]').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.locator('#backLink').click();
  await expect(page).toHaveURL(/\/en\/$/);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Storage blocked', 'SecurityError'); } });
  });
  await page.goto('/ja/index.html');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  await page.locator('.lang-option[data-value="en"]').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  expect(errors).toEqual([]);
});
