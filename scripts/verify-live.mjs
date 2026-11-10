import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const baseURL = process.env.LIVE_URL ?? 'https://transit.omfreight.vip';
const output = new URL('../artifacts/live-verification/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
const errors = [];
const pages = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});
page.on('response', (response) => {
  if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
});

try {
  const health = await page.request.get(`${baseURL}/health/ready`);
  expect(health.ok()).toBe(true);
  expect(await health.json()).toMatchObject({ status: 'ok', source: 'postgres' });
  const meta = await (await page.request.get(`${baseURL}/api/v1/meta`)).json();
  expect(meta.source).toBe('postgres');
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: '三个视角，看清全程时效' })).toBeVisible();
  await expect(page.locator('.overview-card')).toHaveCount(3);
  await expect(page.getByRole('textbox', { name: '开船月份' })).toHaveValue(
    `${meta.defaultMonth.slice(0, 4)} 年 ${meta.defaultMonth.slice(5)} 月`,
  );
  await expect(page.getByText('已发布数据', { exact: true })).toBeVisible();
  await page.screenshot({ path: new URL('overview-desktop.png', output).pathname, fullPage: true });
  pages.push('overview');

  for (const [entry, heading, picker] of [
    ['查看柜子时效详情', '柜子时效对比', '添加柜子对比'],
    ['查看航线时效详情', '航线时效对比', '添加航线对比'],
    ['查看亚马逊仓库详情', '亚马逊仓库时效对比', '添加仓库对比'],
  ]) {
    await page.getByRole('button', { name: entry, exact: true }).click();
    await expect(page.getByRole('heading', { name: new RegExp(heading) })).toBeVisible();
    await page.getByRole('button', { name: new RegExp(picker) }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('dialog').getByRole('textbox', { name: '搜索对比对象' }).fill('NO-MATCH');
    await expect(page.getByRole('dialog').locator('.picker-item')).toHaveCount(0);
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /取\s*消/ })
      .click();
    pages.push(heading);
    await page.getByRole('button', { name: /返回时效总览/ }).click();
  }
  await page.getByRole('button', { name: /重置/ }).click();
  await page.getByRole('button', { name: /数据说明/ }).click();
  await expect(page.getByRole('heading', { name: '月份与样本' })).toBeVisible();
  await page.locator('.ant-drawer-close').click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '打开导航' }).click();
  await page
    .locator('.mobile-nav')
    .getByRole('button', { name: /亚马逊仓库/ })
    .click();
  await expect(page.locator('.mobile-nav')).not.toBeVisible();
  await expect(page.getByRole('heading', { name: /亚马逊仓库时效对比/ })).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: new URL('warehouses-mobile.png', output).pathname,
    fullPage: true,
  });
  expect(errors).toEqual([]);
  const result = {
    checkedAt: new Date().toISOString(),
    baseURL,
    source: meta.source,
    defaultMonth: meta.defaultMonth,
    pages,
    errors,
  };
  await writeFile(new URL('result.json', output), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
