import { test, expect } from '@playwright/test';
import dayjs from 'dayjs';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '三个视角，看清全程时效' })).toBeVisible();
});

test('overview uses the previous month and all three detail entrances work', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await expect(page.getByRole('textbox', { name: '开船月份' })).toHaveValue(
    dayjs().subtract(1, 'month').format('YYYY 年 MM 月'),
  );
  await expect(page.locator('.overview-card')).toHaveCount(3);
  for (const [name, heading] of [
    ['查看柜子时效详情', '柜子时效对比'],
    ['查看航线时效详情', '航线时效对比'],
    ['查看亚马逊仓库详情', '亚马逊仓库时效对比'],
  ]) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.getByRole('heading', { name: new RegExp(heading) })).toBeVisible();
    await expect(page.locator('.comparison-card')).toHaveCount(3);
    await page.getByRole('button', { name: /返回时效总览/ }).click();
  }
  expect(errors).toEqual([]);
});

test('port filtering changes chart samples and incompatible filters show an honest empty state', async ({
  page,
}) => {
  const before = await page.locator('.overview-containers .metric-support strong').textContent();
  await page
    .locator('.ant-select')
    .filter({ has: page.getByRole('combobox', { name: '起运港', exact: true }) })
    .click();
  await page.getByTitle('盐田', { exact: true }).click();
  await expect(page.locator('.overview-containers .metric-support strong')).not.toHaveText(before!);
  await expect(page.locator('.overview-routes .metric-support strong')).toHaveText('3');
  await page
    .locator('.ant-select')
    .filter({ has: page.getByRole('combobox', { name: '目的港', exact: true }) })
    .click();
  await page.getByTitle('长滩', { exact: true }).click();
  await expect(page.locator('.overview-containers .metric-number')).toContainText('—');
  await expect(page.locator('.overview-containers .metric-support strong')).toHaveText('0');
  await expect(page.getByText('当前筛选暂无有效样本').first()).toBeVisible();
  await page.getByRole('button', { name: /重置/ }).click();
  await expect(page.locator('.overview-containers .metric-support strong')).toHaveText(before!);
});

test('route comparison supports add, limit, remove and cancel without applying', async ({
  page,
}) => {
  await page.goto('/#routes');
  await page.getByRole('button', { name: /添加航线对比/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('.picker-item').filter({ hasText: '东方海外 SEA' }).click();
  await expect(
    dialog.locator('.picker-item').filter({ hasText: '现代商船 EC2' }).getByRole('checkbox'),
  ).toBeDisabled();
  await dialog.getByRole('button', { name: /应用对比/ }).click();
  await expect(page.locator('.comparison-card')).toHaveCount(4);
  await expect(page.locator('.comparison-card').filter({ hasText: '东方海外 SEA' })).toBeVisible();
  await page.getByRole('button', { name: '移除美森 CLX', exact: true }).click();
  await expect(page.locator('.comparison-card')).toHaveCount(3);
  await page.getByRole('button', { name: /添加航线对比/ }).click();
  await dialog.locator('.picker-item').filter({ hasText: '现代商船 EC2' }).click();
  await dialog.getByRole('button', { name: /取\s*消/ }).click();
  await expect(page.locator('.comparison-card')).toHaveCount(3);
  await expect(page.locator('.comparison-card').filter({ hasText: '现代商船 EC2' })).toHaveCount(0);
  await page
    .locator('.comparison-toolbar .ant-segmented-item')
    .filter({ hasText: '海上运输' })
    .click();
  await expect(page.locator('.comparison-card .metric-label').first()).toContainText('开船 → 到港');
});

test('warehouse comparison searches and persists selection when a selected warehouse has no samples', async ({
  page,
}) => {
  await page.goto('/#warehouses');
  await page.getByRole('button', { name: /添加仓库对比/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: '搜索对比对象' }).fill('ABE8');
  await expect(dialog.locator('.picker-item')).toHaveCount(1);
  await dialog.locator('.picker-item').click();
  await dialog.getByRole('button', { name: /应用对比/ }).click();
  await expect(page.locator('.comparison-card')).toHaveCount(4);
  await page
    .locator('.ant-select')
    .filter({ has: page.getByRole('combobox', { name: '目的港', exact: true }) })
    .click();
  await page.getByTitle('长滩', { exact: true }).click();
  await expect(page.locator('.comparison-card').filter({ hasText: 'ABE8' })).toContainText(
    '暂无数据',
  );
  await expect(page.locator('.comparison-card').filter({ hasText: 'ABE8' })).toContainText('—');
  await page
    .locator('.comparison-toolbar .ant-segmented-item')
    .filter({ hasText: '拆柜 → 送仓' })
    .click();
  await expect(page.locator('.comparison-card .metric-label').first()).toContainText('拆柜 → 送仓');
});

test('month changes affect charts, unavailable months remain empty, reset restores previous month', async ({
  page,
}) => {
  const input = page.getByRole('textbox', { name: '开船月份' });
  await input.click();
  await input.fill('2020 年 01 月');
  await input.press('Enter');
  await page.getByRole('heading', { name: '三个视角，看清全程时效' }).click();
  await expect(input).toHaveValue('2020 年 01 月');
  await expect(page.locator('.overview-containers .metric-support strong')).toHaveText('0');
  await page.getByRole('button', { name: /重置/ }).click();
  await expect(input).toHaveValue(dayjs().subtract(1, 'month').format('YYYY 年 MM 月'));
  await expect(page.locator('.overview-containers .metric-support strong')).not.toHaveText('0');
});

test('container query narrows individual transports and empty query can recover', async ({
  page,
}) => {
  await page.goto('/#containers');
  const name = (await page.locator('.comparison-name').first().innerText()).trim();
  await page.getByRole('textbox', { name: '柜号搜索' }).fill(name);
  await expect(page.locator('.comparison-card')).toHaveCount(1);
  await page.getByRole('textbox', { name: '柜号搜索' }).fill('NOT-A-CONTAINER');
  await expect(page.locator('.comparison-card')).toHaveCount(0);
  await page.getByRole('textbox', { name: '柜号搜索' }).fill('');
  await expect(page.locator('.comparison-card')).toHaveCount(3);
});

test('mobile navigation, comparison dialog and layout remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: '打开导航' })).toBeVisible();
  const checkOverflow = async () =>
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  await checkOverflow();
  await page.getByRole('button', { name: '打开导航' }).click();
  await page
    .locator('.mobile-nav')
    .getByRole('button', { name: /亚马逊仓库/ })
    .click();
  await expect(page.getByRole('heading', { name: /亚马逊仓库时效对比/ })).toBeVisible();
  await checkOverflow();
  await page.getByRole('button', { name: /添加仓库对比/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /取\s*消/ })
    .click();
  await page.setViewportSize({ width: 320, height: 740 });
  await checkOverflow();
});

test('methodology opens and browser back navigation restores the overview', async ({ page }) => {
  await page.getByRole('button', { name: /数据说明/ }).click();
  await expect(page.getByRole('heading', { name: '月份与样本' })).toBeVisible();
  await expect(page.getByText(/尚未连接业务数据库/)).toBeVisible();
  await page.locator('.ant-drawer-close').click();
  await page.locator('.desktop-nav').getByRole('button', { name: '航线时效', exact: true }).click();
  await page.goBack();
  await expect(page.getByRole('heading', { name: '三个视角，看清全程时效' })).toBeVisible();
});

test('API failures show a retry state without silently replacing data with local fixtures', async ({
  page,
}) => {
  let unavailable = true;
  await page.route('**/api/v1/overview?**', async (route) => {
    if (unavailable)
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'DATA_UNAVAILABLE',
            message: '测试：数据服务暂时不可用',
            requestId: 'test',
          },
        }),
      });
    else await route.continue();
  });
  await page.reload();
  await expect(page.getByText('暂时无法获取时效数据')).toBeVisible();
  await expect(page.locator('.overview-card')).toHaveCount(0);
  unavailable = false;
  await page.getByRole('button', { name: /重\s*试/ }).click();
  await expect(page.locator('.overview-card')).toHaveCount(3);
});
