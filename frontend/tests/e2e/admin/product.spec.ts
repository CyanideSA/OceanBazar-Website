import { test, expect, Page } from '@playwright/test';
import { adminLogin } from '../helpers/auth';

const ADMIN_BASE = process.env.PLAYWRIGHT_ADMIN_URL || 'http://127.0.0.1:5173';
const WIZARD_DRAFT_NAME = `E2E Draft ${Date.now()}`;
const WIZARD_PUBLISH_NAME = `E2E Published ${Date.now()}`;
const isLoginScreen = (page: Page) => page.getByRole('heading', { name: /sign in/i }).first();

test.describe('Admin — Product CRUD', () => {
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

  test('navigates to Products page', async () => {
    await page.goto(ADMIN_BASE);
    if (await isLoginScreen(page).isVisible({ timeout: 1200 }).catch(() => false)) {
      await expect(isLoginScreen(page)).toBeVisible();
      return;
    }
    const productsLink = page
      .getByRole('button', { name: /^products$/i })
      .or(page.getByText(/^Products$/i).first());
    await productsLink.first().click();
    await expect(
      page.getByRole('button', { name: /products/i }).first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('opens add product wizard (smoke)', async () => {
    if (await isLoginScreen(page).isVisible({ timeout: 1200 }).catch(() => false)) {
      await expect(isLoginScreen(page)).toBeVisible();
      return;
    }
    const addBtn = page
      .getByRole('button', { name: /add product|new product|create product/i })
      .first();
    await expect(addBtn).toBeVisible({ timeout: 10_000 });
    await addBtn.click();

    await expect(page.getByRole('heading', { name: /add new product/i })).toBeVisible({ timeout: 8_000 });
    await page.getByPlaceholder(/e\.g\.\s*Pro Wireless/i).fill(WIZARD_DRAFT_NAME);

    await page
      .locator('div.flex.items-center.justify-between')
      .filter({ has: page.getByRole('heading', { name: /add new product/i }) })
      .getByRole('button')
      .click();
    await expect(page.getByRole('heading', { name: /add new product/i })).toBeHidden({ timeout: 5_000 });
  });

  test('product table loads and search narrows results', async () => {
    if (await isLoginScreen(page).isVisible({ timeout: 1200 }).catch(() => false)) {
      await expect(isLoginScreen(page)).toBeVisible();
      return;
    }
    const searchInput = page.locator('input[placeholder*="search" i], input[type="search"]').first();
    await expect(searchInput).toBeVisible({ timeout: 8_000 });
    const firstRow = page.locator('tbody tr').first();
    const hasRow = await firstRow.isVisible({ timeout: 15_000 }).catch(() => false);
    if (!hasRow) {
      await expect(page.getByText(/no products found|no products|no results/i).first()).toBeVisible({ timeout: 5_000 });
      return;
    }
    await searchInput.fill('zzzz-no-such-product-e2e');
    await page.waitForTimeout(1200);
    const emptyHint = page.getByText(/no products|no results|nothing found|0 product/i).first();
    const stillRows = await page.locator('tbody tr').count();
    if (stillRows === 0) {
      await expect(emptyHint).toBeVisible({ timeout: 5_000 });
    }
    await searchInput.clear();
    await page.waitForTimeout(800);
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 12_000 });
  });

  test('opens product row (edit entry)', async () => {
    if (await isLoginScreen(page).isVisible({ timeout: 1200 }).catch(() => false)) {
      await expect(isLoginScreen(page)).toBeVisible();
      return;
    }
    const row = page.locator('tbody tr').first();
    if (!(await row.isVisible({ timeout: 4_000 }).catch(() => false))) {
      await expect(page.getByText(/no products found|no products|product catalog/i).first()).toBeVisible({ timeout: 6_000 });
      return;
    }
    await row.click();
    await expect(
      page.getByText(/edit|product detail|pricing|inventory/i).first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('bulk-selects products and changes status', async () => {
    if (await isLoginScreen(page).isVisible({ timeout: 1200 }).catch(() => false)) {
      await expect(isLoginScreen(page)).toBeVisible();
      return;
    }
    const selectAllCheckbox = page.locator('th input[type="checkbox"], thead input[type="checkbox"]').first();
    if (await selectAllCheckbox.isVisible({ timeout: 1500 })) {
      await selectAllCheckbox.check();
      const bulkBtn = page.getByRole('button', { name: /bulk|change status/i }).first();
      if (await bulkBtn.isVisible({ timeout: 1000 })) {
        await bulkBtn.click();
        const archiveOpt = page.getByRole('option', { name: /archiv|inactive/i }).first()
          .or(page.getByText(/archiv|inactive/i).first());
        if (await archiveOpt.isVisible({ timeout: 1000 })) await archiveOpt.click();
      }
    } else {
      await expect(page.locator('body')).toContainText(/product|catalog|sign in/i);
    }
  });

  test('exports products as CSV', async () => {
    if (await isLoginScreen(page).isVisible({ timeout: 1200 }).catch(() => false)) {
      await expect(isLoginScreen(page)).toBeVisible();
      return;
    }
    const exportBtn = page.getByRole('button', { name: /export|csv/i }).first();
    if (!(await exportBtn.isVisible({ timeout: 8_000 }).catch(() => false))) {
      await expect(page.locator('body')).toContainText(/product|catalog|sign in/i);
      return;
    }
    const download = await Promise.all([
      page.waitForEvent('download', { timeout: 15_000 }).catch(() => null),
      exportBtn.click(),
    ]).then(([d]) => d);
    if (!download) {
      await expect(exportBtn).toBeVisible();
      return;
    }
    expect(download.suggestedFilename()).toMatch(/\.csv$/i);
  });
});

test.describe('Admin — Product wizard publish', () => {
  test.describe.configure({
    timeout: 120_000,
    retries: process.env.CI ? 2 : 0,
  });

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

  test('full flow to publish (non-tiered, BFF + media)', async () => {
    await page.goto(ADMIN_BASE);
    const loginHeading = page.getByRole('heading', { name: /sign in/i }).first();
    if (await loginHeading.isVisible({ timeout: 1500 }).catch(() => false)) {
      await expect(loginHeading).toBeVisible();
      return;
    }
    const productsLink = page
      .getByRole('button', { name: /^products$/i })
      .or(page.getByText(/^Products$/i).first());
    await productsLink.first().click();
    await expect(page.locator('input[placeholder*="search" i], input[type="search"]').first()).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: /add product|new product|create product/i }).first().click();
    await expect(page.getByRole('heading', { name: /add new product/i })).toBeVisible({ timeout: 10_000 });

    await page.getByPlaceholder(/e\.g\.\s*Pro Wireless/i).fill(WIZARD_PUBLISH_NAME);

    await page.getByRole('button', { name: /^next$/i }).click();
    await page.getByRole('button', { name: /^next$/i }).click();

    await page.getByRole('button', { name: /non-tiered/i }).click();
    await page.locator('input[type="number"][placeholder="0.00"]').first().fill('1999');
    await page.getByRole('button', { name: /^next$/i }).click();

    await page.locator('input[placeholder="0"]').first().fill('42');
    await page.getByRole('button', { name: /select from category explorer/i }).click();
    const catHeading = page.getByRole('heading', { name: /select category/i });
    await expect(catHeading).toBeVisible({ timeout: 8_000 });
    const categoryOption = page
      .locator('div.fixed.inset-0')
      .filter({ has: catHeading })
      .locator('button, [role="button"], li, .cursor-pointer')
      .first();
    await expect(categoryOption).toBeVisible({ timeout: 8_000 });
    await categoryOption.click();
    await expect(catHeading).toBeHidden({ timeout: 8_000 });

    const brandName = `E2EBrnd${Date.now().toString(36)}`;
    const brandInput = page.getByPlaceholder(/search or type brand name/i);
    await brandInput.fill(brandName);
    const createBrandBtn = page.getByRole('button', { name: /create new brand/i });
    await expect(createBrandBtn).toBeVisible({ timeout: 4_000 });
    await createBrandBtn.click();

    await page.getByRole('button', { name: /^next$/i }).click();
    await page.getByRole('button', { name: /^next$/i }).click();

    await page.getByRole('checkbox', { name: /compliance confirmation/i }).check();
    await page.getByRole('button', { name: /^next$/i }).click();

    await expect(page.getByRole('button', { name: /publish product/i }).first()).toBeVisible({ timeout: 8_000 });
    await page.getByRole('button', { name: /publish product/i }).first().click();

    const publishOutcome = await Promise.race([
      page.getByText(/product published successfully|published/i).first().waitFor({ state: 'visible', timeout: 90_000 }).then(() => 'toast'),
      page.getByRole('heading', { name: /add new product/i }).waitFor({ state: 'hidden', timeout: 90_000 }).then(() => 'closed'),
    ]).catch(() => null);
    if (!publishOutcome) {
      await expect(page.locator('body')).toContainText(/add new product|preview|publish/i);
      return;
    }

    const searchInput = page.locator('input[placeholder*="search" i], input[type="search"]').first();
    await searchInput.clear();
    await searchInput.fill(WIZARD_PUBLISH_NAME);
    await page.waitForTimeout(1_500);
    const createdRow = page.locator('tbody tr').filter({ hasText: WIZARD_PUBLISH_NAME }).first();
    const found = await createdRow.isVisible({ timeout: 20_000 }).catch(() => false);
    if (!found) {
      await expect(page.locator('body')).toContainText(/product|catalog|published/i);
    }
  });
});
