const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

// CI stays offline and never sends visits to production analytics.
test.beforeEach(async ({ context }) => {
  await context.route('**/*', (route) => {
    return new URL(route.request().url()).hostname === '127.0.0.1'
      ? route.continue() : route.abort();
  });
});

const intros = {
  zh: '台灣人 🇹🇼。平常在寫 Apache Airflow，也維護 commitizen-tools。其他時間在旅行、看動畫、讀書，然後把不想忘記的事寫下來。',
  en: "Taiwanese 🇹🇼. I work on Apache Airflow and maintain commitizen-tools. The rest of the time I travel, watch anime, and read, then write down what I don't want to forget.",
  ja: '台湾人 🇹🇼。普段は Apache Airflow の開発に関わり、commitizen-tools をメンテナンスしています。それ以外の時間は旅行、アニメ、読書、そして忘れたくないことを書き留めています。',
};

const languages = [
  { path: '/zh-tw/', lang: 'zh-Hant', code: 'zh', blogPath: '' },
  { path: '/en/', lang: 'en', code: 'en', blogPath: '/en' },
  { path: '/ja/', lang: 'ja', code: 'ja', blogPath: '/en' },
];

for (const language of languages) {
  test(`${language.code}: readable layout and keyboard navigation`, async ({ page }, testInfo) => {
    await page.goto(language.path);
    await expect(page.locator('html')).toHaveAttribute('lang', language.lang);
    await expect(page.locator('.lang-option[aria-current="page"]')).toHaveAttribute('href', language.path);
    await expect(page.locator('.path')).toHaveCount(2);
    await expect(page.locator('.blog-sub')).toHaveCount(2);
    await expect(page.locator('.roles li')).toHaveCount(10);
    await expect(page.locator('.bio')).toHaveText(intros[language.code]);
    await expect(page.locator('#aboutLink')).toHaveAttribute('href', `https://blog.wei-lee.me${language.blogPath}/pages/about-me`);
    await expect(page.locator('#nowLink')).toHaveAttribute('href', `https://blog.wei-lee.me${language.blogPath}/pages/now`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.locator('.posts time').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(12);
    expect(await page.locator('.path-subtitle').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(12);

    // Verify actual Tab traversal moves through the same sections as the screen.
    const groups = ['.lang-switcher', '.paths', '.blogs', '.roles', '.social'];
    const boxes = await Promise.all(groups.map((selector) => page.locator(selector).boundingBox()));
    expect(boxes.map((box) => box.y)).toEqual(boxes.map((box) => box.y).sort((a, b) => a - b));
    for (const selector of groups) {
      const links = page.locator(`${selector} a`);
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

const redirects = [
  { name: 'zh-TW', languages: ['zh-TW'], to: '/zh-tw/' },
  { name: 'zh-CN', languages: ['zh-CN'], to: '/zh-tw/' },
  { name: 'ja-JP', languages: ['ja-JP'], to: '/ja/' },
  { name: 'en-US', languages: ['en-US'], to: '/en/' },
  { name: 'fr-FR', languages: ['fr-FR'], to: '/en/' },
  { name: 'fr then ja', languages: ['fr-FR', 'ja-JP'], to: '/ja/' },
];

for (const item of redirects) {
  test(`root redirects ${item.name} to ${item.to} and keeps query and hash`, async ({ browser }) => {
    const context = await browser.newContext({ locale: item.languages[0] });
    await context.addInitScript((languages) => {
      Object.defineProperty(navigator, 'languages', { get: () => languages });
    }, item.languages);
    await context.route('**/*', (route) => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    const page = await context.newPage();
    await page.goto('/?x=1#y');
    await expect(page).toHaveURL(new RegExp(`${item.to}\\?x=1#y$`));
    await context.close();
  });
}

test('saved language wins over the browser language, and language pages never redirect', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'zh-TW' });
  await context.route('**/*', (route) => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  const page = await context.newPage();
  await page.goto('/en/');
  await page.locator('.lang-option[data-value="ja"]').click();
  await expect(page).toHaveURL(/\/ja\/$/);
  await page.goto('/');
  await expect(page).toHaveURL(/\/ja\/$/);
  await page.goto('/en/');
  await expect(page).toHaveURL(/\/en\/$/);
  await page.locator('.lang-option[data-value="zh"]').click();
  await expect(page).toHaveURL(/\/zh-tw\/$/);
  await context.close();
});

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
