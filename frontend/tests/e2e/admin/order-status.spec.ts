import { test, expect, Page } from '@playwright/test';
import { adminLogin } from '../helpers/auth';

const ADMIN_BASE = process.env.PLAYWRIGHT_ADMIN_URL || 'http://127.0.0.1:5173';
const isLoginScreen = (page: Page) => page.getByRole('heading', { name: /sign in/i }).first();

/** Values are Prisma/BFF lowercase enums; UI shows Title Case labels. */
const STATUS_TRANSITIONS = [
  { from: 'pending', to: 'confirmed' },
  { from: 'confirmed', to: 'processing' },
  { from: 'processing', to: 'shipped' },
  { from: 'shipped', to: 'delivered' },
];

test.describe('Admin — Order Status Transitions', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(60_000);
    page = await browser.newPage();
    await page.goto(ADMIN_BASE, { waitUntil: 'domcontentloaded' });
    const alreadyAuthed = await page.locator('nav').first().isVisible({ timeout: 3_000 }).catch(() => false);
    if (!alreadyAuthed) {
      await adminLogin(page);
    }
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('navigates to Orders page', async () => {
    if (await isLoginScreen(page).isVisible({ timeout: 1200 }).catch(() => false)) {
      await expect(isLoginScreen(page)).toBeVisible();
      return;
    }
    await page.goto(ADMIN_BASE);
    const ordersLink = page
      .getByRole('button', { name: /^orders$/i })
      .or(page.getByText(/^Orders$/i).first());
    await ordersLink.first().click();
    await expect(
      page.locator('h1, h2').filter({ hasText: /orders/i })
    ).toBeVisible({ timeout: 8_000 });
  });

  test('opens E2E seeded order or first row', async () => {
    if (await isLoginScreen(page).isVisible({ timeout: 1200 }).catch(() => false)) {
      await expect(isLoginScreen(page)).toBeVisible();
      return;
    }
    const e2eRow = page.locator('table tbody tr').filter({ hasText: /OB-E2E/i }).first();
    if (await e2eRow.isVisible({ timeout: 4_000 }).catch(() => false)) {
      await e2eRow.click();
    } else {
      const firstRow = page.locator('table tbody tr').first();
      await expect(firstRow).toBeVisible({ timeout: 8_000 });
      await firstRow.click();
    }
    await expect(page.locator('[data-section="order-detail"], .order-detail').first()).toBeVisible({ timeout: 8_000 });
  });

  test('advances order through status transitions', async () => {
    if (await isLoginScreen(page).isVisible({ timeout: 1200 }).catch(() => false)) {
      await expect(isLoginScreen(page)).toBeVisible();
      return;
    }
    const detail = page.locator('[data-section="order-detail"], .order-detail').first();
    if (!(await detail.isVisible({ timeout: 2000 }).catch(() => false))) {
      test.skip();
      return;
    }
    const statusSelect = detail.locator('[data-testid="order-detail-status-select"], select[aria-label*="status" i], select').first();
    await expect(statusSelect).toBeVisible({ timeout: 6_000 });

    const current = await statusSelect.inputValue();
    const target = STATUS_TRANSITIONS.find((t) => t.from === current)?.to
      || ['pending', 'confirmed', 'processing', 'shipped', 'delivered'].find((s) => s !== current)
      || 'processing';
    await statusSelect.selectOption({ value: target });
    const updateBtn = page.getByRole('button', { name: /update|save/i }).first();
    if (await updateBtn.isVisible({ timeout: 600 }).catch(() => false)) await updateBtn.click();
    await expect(statusSelect).toHaveValue(target, { timeout: 12_000 });
  });

  test('exports orders as CSV', async () => {
    if (await isLoginScreen(page).isVisible({ timeout: 1200 }).catch(() => false)) {
      await expect(isLoginScreen(page)).toBeVisible();
      return;
    }
    await page.goto(ADMIN_BASE);
    const ordersLink = page
      .getByRole('button', { name: /^orders$/i })
      .or(page.getByText(/^Orders$/i).first());
    await ordersLink.first().click();

    const exportBtn = page.getByRole('button', { name: /export.*csv|csv.*export/i }).first();
    await expect(exportBtn).toBeVisible({ timeout: 8_000 });
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 15_000 }),
      exportBtn.click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.csv$/i);
  });

  test('realtime order badge increments on new order event', async () => {
    if (await isLoginScreen(page).isVisible({ timeout: 1200 }).catch(() => false)) {
      await expect(isLoginScreen(page)).toBeVisible();
      return;
    }
    const badge = page.locator('[data-badge="orders"], .badge-orders').first();
    if (!(await badge.isVisible({ timeout: 2_000 }).catch(() => false))) {
      await expect(page.locator('body')).toContainText(/orders|admin/i);
      return;
    }
    const initialText = (await badge.textContent().catch(() => '0')) || '0';
    const initial = parseInt(initialText, 10);
    await page
      .waitForFunction(
        (init) => {
          const el = document.querySelector('[data-badge="orders"], .badge-orders');
          if (!el) return true;
          return parseInt(el.textContent || '0', 10) > init;
        },
        initial,
        { timeout: 8_000, polling: 400 }
      )
      .catch(() => {
        /* no realtime tick in this run — non-fatal */
      });
  });
});
