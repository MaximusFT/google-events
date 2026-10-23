import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // The real export runs locally; external analytics, comments and links are never contacted.
  await page.route('**/*', (route) => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
});
const ready = async (page, path = '/') => {
  await page.goto(`${path}?track-debug=1`);
  await page.waitForFunction(() => window.siteTracker);
};
const events = (page) => page.evaluate(() => window.dataLayer ?? []);

test('keyboard activation sends exactly one header event with inherited placement', async ({ page }) => {
  await ready(page);
  const skills = page.getByRole('button', { name: 'Skills', exact: true });
  await skills.focus();
  await skills.press('Enter');
  expect(await events(page)).toEqual([{ event: 'navigation_selected', trigger: 'click', section: 'navigation', placement: 'desktop', destination: 'skills', page_path: '/' }]);
  await skills.press('Space');
  expect(await events(page)).toHaveLength(2);
});

test('dynamic dropdown links survive React removing their source during client navigation', async ({ page }) => {
  await ready(page);
  await page.getByRole('button', { name: 'Playbooks', exact: true }).click();
  await page.getByRole('link', { name: /The React Playbook/ }).click();
  await expect(page).toHaveURL(/\/playbook/);
  const sent = await events(page);
  expect(sent.filter((event) => event.event === 'navigation_selected')).toEqual([
    expect.objectContaining({ destination: '/playbook', section: 'navigation', placement: 'desktop', page_path: '/' }),
  ]);
  await page.getByRole('button', { name: 'Skills', exact: true }).click();
  await expect(page).toHaveURL(/\/#skills/);
  expect((await events(page)).filter((event) => event.destination === 'skills')).toHaveLength(1);
});

test('article title inherits identity; new page navigation updates the path', async ({ page }) => {
  await ready(page, '/blog');
  const card = page.locator('article[data-track-root]').first();
  const id = await card.getAttribute('data-track-post-id');
  const title = await card.getAttribute('data-track-post-title');
  await card.locator('[data-track-placement="title"]').click();
  await expect(page).toHaveURL(new RegExp(`/blog/${id}`));
  expect(await events(page)).toEqual([expect.objectContaining({ event: 'article_selected', post_id: id, post_title: title, placement: 'title', section: 'blog', page_path: '/blog' })]);
  await page.getByRole('button', { name: 'Skills', exact: true }).click();
  expect((await events(page)).at(-1).page_path).toBe(`/blog/${id}`);
});

test('contact context is inspectable and migrated links have one analytics source', async ({ page }) => {
  await ready(page, '/contact');
  const link = page.locator('[data-track-method="Telegram"]');
  await expect(link).not.toHaveAttribute('data-umami-event');
  const preview = await link.evaluate((element) => {
    const result = window.siteTracker.inspect(element);
    return { event: result.event, root: result.boundary.id, sources: Object.keys(result.fields) };
  });
  expect(preview.event.properties).toEqual({ method: 'Telegram', placement: 'primary', section: 'contact' });
  expect(preview.root).toBe('contact');
  expect(await events(page)).toEqual([]);
  // Prevent navigation while still exercising the delegated browser click.
  await link.evaluate((element) => element.addEventListener('click', (event) => event.preventDefault()));
  await link.click();
  expect(await events(page)).toEqual([expect.objectContaining({ event: 'contact_selected', method: 'Telegram', placement: 'primary', section: 'contact', page_path: '/contact' })]);
});

const mockUmami = (page, reject = false) => page.addInitScript(({ reject }) => {
  window.umamiCalls = [];
  window.umami = { track(name, data) {
    window.umamiCalls.push({ name, data });
    return reject ? Promise.reject(new Error('Mock SDK failure')) : Promise.resolve();
  } };
}, { reject });
const enableLocalMock = (page) => page.locator('#site-umami').evaluate((script) => { script.dataset.domains = location.hostname; });
const flush = (page) => page.evaluate(() => window.siteTracker.flush());
const sdkCalls = (page) => page.evaluate(() => window.umamiCalls);

test('local preview excludes SDK delivery even if the SDK is available', async ({ page }) => {
  await mockUmami(page);
  await ready(page);
  await page.getByRole('button', { name: 'Skills', exact: true }).click();
  await flush(page);
  expect(await sdkCalls(page)).toEqual([]);
  expect(await events(page)).toHaveLength(1);
});

test('one keyboard action sends inherited context to both dataLayer and Umami', async ({ page }) => {
  await mockUmami(page);
  await ready(page);
  await enableLocalMock(page);
  await page.getByRole('button', { name: 'Skills', exact: true }).press('Enter');
  await flush(page);
  expect(await sdkCalls(page)).toEqual([{ name: 'navigation_selected', data: { section: 'navigation', placement: 'desktop', destination: 'skills', trigger: 'click', page_path: '/' } }]);
  expect(await events(page)).toHaveLength(1);
});

test('late SDK readiness retains the original page context across navigation', async ({ page }) => {
  await ready(page);
  await enableLocalMock(page);
  await page.getByRole('link', { name: 'Blog', exact: true }).first().click();
  await expect(page).toHaveURL(/\/blog/);
  expect(await events(page)).toHaveLength(1);
  await page.evaluate(() => {
    window.umamiCalls = [];
    window.umami = { track(name, data) { window.umamiCalls.push({ name, data }); return Promise.resolve(); } };
    document.querySelector('#site-umami').dispatchEvent(new Event('load'));
  });
  await flush(page);
  expect(await sdkCalls(page)).toEqual([expect.objectContaining({ name: 'navigation_selected', data: expect.objectContaining({ destination: 'blog', page_path: '/' }) })]);
});

test('SDK rejection cannot cancel the UI action or dataLayer delivery', async ({ page }) => {
  const warnings = [];
  page.on('console', (message) => { if (message.type() === 'warning') warnings.push(message.text()); });
  await mockUmami(page, true);
  await ready(page);
  await enableLocalMock(page);
  await page.getByRole('button', { name: 'Playbooks', exact: true }).click();
  await flush(page);
  await expect(page.getByRole('link', { name: /The React Playbook/ })).toBeVisible();
  expect(await events(page)).toHaveLength(1);
  expect(await sdkCalls(page)).toHaveLength(1);
  expect(warnings.some((text) => text.includes('Analytics receiver umami failed'))).toBe(true);
});

test('migrated contacts retain the Umami dashboard event name without a duplicate native tag', async ({ page }) => {
  await mockUmami(page);
  await ready(page, '/contact');
  await enableLocalMock(page);
  const link = page.locator('[data-track-method="Telegram"]');
  await link.evaluate((element) => element.addEventListener('click', (event) => event.preventDefault()));
  await link.click();
  await flush(page);
  expect(await sdkCalls(page)).toEqual([{ name: 'contact-click', data: { method: 'Telegram', placement: 'primary', section: 'contact', trigger: 'click', page_path: '/contact' } }]);
  expect((await events(page))[0].event).toBe('contact_selected');
  await expect(page.locator('#contact [data-umami-event]')).toHaveCount(0);
  await expect(page.locator('footer [data-umami-event]').first()).toBeAttached();
});

test('a script load error settles pending sends and preserves the independent receiver', async ({ page }) => {
  await ready(page);
  await enableLocalMock(page);
  await page.getByRole('button', { name: 'Skills', exact: true }).click();
  await page.locator('#site-umami').evaluate((script) => script.dispatchEvent(new Event('error')));
  await flush(page);
  expect(await events(page)).toHaveLength(1);
  const receivers = await page.getByRole('button', { name: 'Skills', exact: true }).evaluate((element) => window.siteTracker.inspect(element).receivers);
  expect(receivers.map((receiver) => receiver.name)).toEqual(['dataLayer', 'umami']);
});

test('mobile menu dynamically inherits mobile placement without desktop leakage', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await page.getByRole('button', { name: 'Skills', exact: true }).click();
  expect((await events(page)).filter((event) => event.destination === 'skills')).toEqual([
    expect.objectContaining({ event: 'navigation_selected', section: 'navigation', placement: 'mobile' }),
  ]);
});
