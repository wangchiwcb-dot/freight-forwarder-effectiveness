import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
const baseURL = process.env.PREVIEW_URL || 'http://127.0.0.1:4173';
const output = new URL('../docs/screenshots/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1080 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (message) => {
  if (['error', 'warning'].includes(message.type()))
    errors.push(`${message.type()}: ${message.text()}`);
});
const shot = async (name, fullPage = true) =>
  page.screenshot({ path: new URL(name, output).pathname, fullPage });
const navigate = async (view) => {
  await page.goto(`${baseURL}/#${view}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
};
try {
  await navigate('overview');
  await shot('overview-desktop.png');
  await shot('overview-preview.png', false);
  for (const view of ['routes', 'warehouses', 'containers']) {
    await navigate(view);
    await shot(`${view}-desktop.png`);
  }
  await navigate('routes');
  await page.getByRole('button', { name: /添加航线对比/ }).click();
  await page.getByRole('dialog').waitFor({ state: 'visible' });
  await page.waitForTimeout(350);
  await shot('compare-picker.png', false);
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /取\s*消/ })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  for (const view of ['overview', 'routes', 'warehouses', 'containers']) {
    await navigate(view);
    await shot(`${view}-mobile.png`);
    const width = await page.evaluate(() => ({
      viewport: innerWidth,
      actual: document.documentElement.scrollWidth,
    }));
    if (width.actual > width.viewport)
      errors.push(`${view}: horizontal overflow ${width.actual} > ${width.viewport}`);
  }
  await page.setViewportSize({ width: 1024, height: 768 });
  await navigate('overview');
  await shot('overview-tablet.png');
  const width = await page.evaluate(() => ({
    viewport: innerWidth,
    actual: document.documentElement.scrollWidth,
  }));
  if (width.actual > width.viewport)
    errors.push(`tablet: horizontal overflow ${width.actual} > ${width.viewport}`);
  const result = {
    checkedAt: new Date().toISOString(),
    baseURL,
    errors,
    pages: ['overview', 'routes', 'warehouses', 'containers'],
    desktop: '1440 × 1080',
    mobile: '390 × 844',
    tablet: '1024 × 768',
    deviceScaleFactor: 1,
  };
  await writeFile(
    new URL('../browser-verification.json', output),
    JSON.stringify(result, null, 2) + '\n',
  );
  console.log(JSON.stringify(result, null, 2));
  if (errors.length) process.exitCode = 1;
} finally {
  await browser.close();
}
