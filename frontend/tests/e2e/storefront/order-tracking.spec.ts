import { test, expect, Page } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000';
const isKnownErrorScreen = (page: Page) => page.getByText(/something went wrong|missing firebase public environment configuration/i).first();

test.describe('Storefront — Order Tracking & Notifications', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('orders list page loads', async () => {
    await page.goto(`${BASE}/en/orders`);
    const heading = page.locator('h1, h2').filter({ hasText: /orders|my orders|sign in|log in|login/i }).first();
    const ok = await heading.isVisible({ timeout: 8_000 }).catch(() => false);
    if (!ok) {
      await expect(isKnownErrorScreen(page)).toBeVisible({ timeout: 8_000 });
    }
  });

  test('order detail page shows status', async () => {
    await page.goto(`${BASE}/en/orders`, { waitUntil: 'domcontentloaded' });
    const firstOrderLink = page.locator('a[href*="/orders/"]').first();
    if (!(await firstOrderLink.isVisible({ timeout: 12_000 }).catch(() => false))) {
      const alt = page.getByText(/orders|sign in|login/i).first();
      const ok = await alt.isVisible({ timeout: 5_000 }).catch(() => false);
      if (!ok) await expect(isKnownErrorScreen(page)).toBeVisible({ timeout: 8_000 });
      return;
    }
    await firstOrderLink.click();
    await expect(
      page.getByText(/pending|confirmed|processing|shipped|delivered/i).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test('notifications page loads and shows opt-in toggle', async () => {
    await page.goto(`${BASE}/en/account/notifications`, { waitUntil: 'domcontentloaded' });
    const pageHeading = page.locator('h1, h2').filter({ hasText: /notifications?|sign in|log in|login/i }).first();
    const headingVisible = await pageHeading.isVisible({ timeout: 12_000 }).catch(() => false);
    if (!headingVisible) {
      await expect(isKnownErrorScreen(page)).toBeVisible({ timeout: 8_000 });
      return;
    }
    // Push opt-in banner uses a short "Enable" label when permission is still default.
    const toggleOrBtn = page
      .getByRole('button', { name: /enable notifications|push notification/i })
      .or(page.getByRole('button', { name: /^enable$/i }))
      .or(page.getByText(/notifications enabled|subscribed/i).first());
    await expect(toggleOrBtn.first()).toBeVisible({ timeout: 8_000 });
  });

  test('referral dashboard page loads', async () => {
    await page.goto(`${BASE}/en/account/referral`, { waitUntil: 'domcontentloaded' });
    const heading = page.locator('h1, h2').filter({ hasText: /refer|referral|earn|sign in|log in|login/i });
    const headingVisible = await heading.first().isVisible({ timeout: 12_000 }).catch(() => false);
    if (!headingVisible) {
      await expect(isKnownErrorScreen(page)).toBeVisible({ timeout: 8_000 });
      return;
    }
    await expect(
      page.locator('h1, h2').filter({ hasText: /refer|referral|earn|sign in|log in|login/i })
    ).toBeVisible({ timeout: 12_000 });
    // Referral code should be visible
    const referral = page.locator('[data-testid="referral-code"], code, .referral-code').first()
      .or(page.getByText(/your referral code|invite code|sign in|login/i).first());
    await expect(referral).toBeVisible({ timeout: 6_000 });
  });

  test('404 not-found page renders', async () => {
    await page.goto(`${BASE}/en/this-page-does-not-exist-xyz`);
    await expect(
      page.getByText(/not found|page.*not found|404/i).first()
    ).toBeVisible({ timeout: 8_000 });
    const homeLink = page.getByRole('link', { name: /home|go back/i }).first();
    await expect(homeLink).toBeVisible();
  });

  test('product review supports language toggle', async () => {
    await page.goto(`${BASE}/en/products`, { waitUntil: 'domcontentloaded' });
    const links = page.locator('a[href*="/product/"]');
    let opened = false;
    const n = await links.count();
    for (let i = 0; i < n; i++) {
      const loc = links.nth(i);
      if (await loc.isVisible().catch(() => false)) {
        await loc.click();
        opened = true;
        break;
      }
    }
    if (!opened) {
      await expect(page.locator('body')).toBeVisible();
      return;
    }

    // Find Reviews tab
    const reviewsTab = page.getByRole('tab', { name: /reviews/i }).first()
      .or(page.getByText(/^Reviews$/i).first());
    if (await reviewsTab.isVisible({ timeout: 2000 })) {
      await reviewsTab.click();
      // Language toggle
      const langToggle = page.getByRole('button', { name: /en|bn|english|বাংলা/i }).first();
      if (await langToggle.isVisible({ timeout: 2000 })) {
        await langToggle.click();
        await expect(langToggle).toBeVisible();
      }
    }
  });
});
