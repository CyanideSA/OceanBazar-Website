import { test, expect } from '@playwright/test';
import { adminLogin } from '../helpers/auth';

const ADMIN_BASE = process.env.PLAYWRIGHT_ADMIN_URL || 'http://127.0.0.1:5173';

const MODULES = [
  'Dashboard',
  'Analytics',
  'Products',
  'Explorer',
  'Inventory',
  'Orders',
  'Delivery',
  'Returns',
  'Payments',
  'Coupons',
  'Customers',
  'Reviews',
  'Disputes',
  'Live Chat',
  'Tickets',
  'Alerts',
  'Engagement',
  'Applications',
  'Team',
  'Audit Logs',
  'Settings',
];

test.describe('Deterministic Admin Modules + Actions', () => {
  test('module navigation and common actions', async ({ page }) => {
    test.setTimeout(120_000);
    await adminLogin(page);
    await page.goto(ADMIN_BASE, { waitUntil: 'domcontentloaded' });
    let visited = 0;

    for (const moduleName of MODULES) {
      const navBtn = page.getByRole('button', { name: new RegExp(`^${moduleName}$`, 'i') }).first();
      if (!(await navBtn.isVisible({ timeout: 1500 }).catch(() => false))) continue;
      await page.keyboard.press('Escape').catch(() => {});
      const modalClose = page.getByRole('button', { name: /close|cancel|dismiss/i }).first();
      if (await modalClose.isVisible({ timeout: 400 }).catch(() => false)) {
        await modalClose.click().catch(() => {});
      }
      const clicked = await navBtn.click({ timeout: 5000 }).then(() => true).catch(() => false);
      if (!clicked) continue;
      visited += 1;
      await page.waitForTimeout(500);
      await expect(page.locator('body')).toContainText(/oceanbazar|crm|dashboard|products|orders/i);

      const searchBox = page.locator('input[placeholder*="search" i], input[type="search"]').first();
      if (await searchBox.isVisible({ timeout: 700 }).catch(() => false)) {
        await searchBox.fill('test');
        await page.waitForTimeout(300);
        await searchBox.clear();
      }

      const paginationNext = page.getByRole('button', { name: /next/i }).first();
      if (await paginationNext.isVisible({ timeout: 700 }).catch(() => false)) {
        await paginationNext.click().catch(() => {});
      }

      const exportBtn = page.getByRole('button', { name: /export|csv/i }).first();
      if (await exportBtn.isVisible({ timeout: 700 }).catch(() => false)) {
        await exportBtn.click().catch(() => {});
      }
    }

    expect(visited).toBeGreaterThanOrEqual(8);
  });
});
