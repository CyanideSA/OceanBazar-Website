import { Page, expect } from '@playwright/test';

const STOREFRONT_BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000';
const ADMIN_BASE      = process.env.PLAYWRIGHT_ADMIN_URL || 'http://127.0.0.1:5173';
const API_BASE        = process.env.PLAYWRIGHT_API_URL || 'http://127.0.0.1:4000';

/* ── Storefront auth ─────────────────────────────────────────────────────── */

export async function storefrontLogin(page: Page, options?: {
  email?: string;
  password?: string;
}) {
  const email    = options?.email    ?? process.env.TEST_USER_EMAIL    ?? 'e2e.storefront@oceanbazar.test';
  const password = options?.password ?? process.env.TEST_USER_PASSWORD ?? 'Test@1234';

  // Prefer API login for deterministic E2E and to avoid UI/env flakiness.
  try {
    const loginRes = await page.request.post(`${API_BASE}/api/auth/login`, {
      data: { identifier: email, password },
      timeout: 15_000,
    });
    if (loginRes.ok()) {
      const body = await loginRes.json();
      const token = body?.token || body?.access || '';
      const user = body?.user || null;
      if (token && user) {
        await page.addInitScript(({ tk, u }) => {
          localStorage.setItem('ob_access_token', tk);
          localStorage.setItem('ob-auth', JSON.stringify({ state: { user: u, isAuthenticated: true }, version: 0 }));
        }, { tk: token, u: user });
        await page.goto(`${STOREFRONT_BASE}/en/account`, { waitUntil: 'domcontentloaded' });
        if (!page.url().includes('/auth/login')) return;
      }
    }
  } catch {
    // Fall through to UI login.
  }

  await page.goto(`${STOREFRONT_BASE}/en/auth/login`, { waitUntil: 'domcontentloaded' });
  const passwordTab = page.getByRole('button', { name: /^password$/i }).first();
  if (await passwordTab.isVisible({ timeout: 1500 }).catch(() => false)) await passwordTab.click();
  await page.locator('input[type="email"], input[type="text"], input[type="tel"], input[placeholder*="email" i], input[placeholder*="phone" i]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.getByRole('button', { name: /sign in|log in|login/i }).first().click();
  await expect(page).not.toHaveURL(/\/auth\/login/, { timeout: 20_000 });
}

export async function storefrontLogout(page: Page) {
  await page.goto(`${STOREFRONT_BASE}/en/account`);
  const logoutBtn = page.getByRole('button', { name: /logout|sign out/i });
  if (await logoutBtn.isVisible()) await logoutBtn.click();
}

/* ── Admin auth ──────────────────────────────────────────────────────────── */

export async function adminLogin(page: Page, options?: {
  email?: string;
  username?: string;
  password?: string;
}) {
  const preferredUsername = options?.username ?? options?.email ?? process.env.TEST_ADMIN_USERNAME ?? process.env.TEST_ADMIN_EMAIL;
  const preferredPassword = options?.password ?? process.env.TEST_ADMIN_PASSWORD;
  const otp      = process.env.TEST_ADMIN_TOTP ?? '';
  const credentialCandidates = [
    { username: preferredUsername, password: preferredPassword },
    { username: 'superadmin', password: 'Admin@1234' },
  ].filter((c): c is { username: string; password: string } => Boolean(c.username && c.password));

  // First try API-backed session bootstrap for reliability.
  for (const candidate of credentialCandidates) {
    try {
      const loginRes = await page.request.post(`${API_BASE}/api/admin/auth/login`, {
        data: { username: candidate.username, password: candidate.password },
        timeout: 15_000,
      });
      if (!loginRes.ok()) continue;
      const body = await loginRes.json();
      const token = body?.token || '';
      const admin = body?.admin || null;
      if (!token || !admin) continue;
      await page.addInitScript(({ tk, adm }) => {
        localStorage.setItem('oceanbazar_admin_token', tk);
        localStorage.setItem('oceanbazar_admin_user', JSON.stringify(adm));
      }, { tk: token, adm: admin });
      await page.goto(ADMIN_BASE, { waitUntil: 'domcontentloaded' });
      if (await Promise.race([
        page.locator('nav').first().isVisible({ timeout: 5000 }).catch(() => false),
        page.getByRole('button', { name: /dashboard|products|orders|alerts/i }).first().isVisible({ timeout: 5000 }).catch(() => false),
      ]).catch(() => false)) {
        return;
      }
    } catch {
      // Fall through to UI login.
    }
  }

  const hasEnteredApp = async () =>
    Promise.race([
      page.locator('[data-page="dashboard"], .crm-nav, nav').first().isVisible({ timeout: 3000 }).catch(() => false),
      page.getByRole('button', { name: /dashboard|products|orders|alerts/i }).first().isVisible({ timeout: 3000 }).catch(() => false),
    ]).catch(() => false);

  await page.goto(ADMIN_BASE, { waitUntil: 'domcontentloaded' });
  if (await hasEnteredApp()) return;

  for (const candidate of credentialCandidates) {
    if (await hasEnteredApp()) return;

    const usernameField = page
      .locator('input[placeholder="admin_id"], input[placeholder*="username" i], input[placeholder*="admin" i], input[type="email"], input[type="text"]')
      .first();
    await usernameField.waitFor({ state: 'visible', timeout: 5_000 });
    await usernameField.fill(candidate.username);
    await page.locator('input[type="password"]').first().fill(candidate.password);
    const signInBtn = page.getByRole('button', { name: /log in|sign in|secure session|establish/i }).first();
    if (!(await signInBtn.isVisible({ timeout: 1500 }).catch(() => false))) {
      continue;
    }
    await signInBtn.click();

    const otpField = page.locator('input[placeholder*="authenticator" i], input[placeholder*="code" i][maxlength="6"]');
    if (await otpField.first().isVisible({ timeout: 2500 }).catch(() => false)) {
      if (!otp) {
        throw new Error('Admin login requires 2FA. Set TEST_ADMIN_TOTP env var for Playwright.');
      }
      await otpField.first().fill(otp);
      await page.getByRole('button', { name: /verify 2fa|verify|secure session|sign in/i }).click();
    }

    // Login may take a few seconds; wait for app shell or form to return.
    await Promise.race([
      page.locator('nav').first().waitFor({ state: 'visible', timeout: 7_000 }),
      signInBtn.waitFor({ state: 'visible', timeout: 7_000 }),
      page.locator('text=/invalid|failed|error|incorrect/i').first().waitFor({ state: 'visible', timeout: 7_000 }),
    ]).catch(() => {});

    if (await hasEnteredApp()) {
      return;
    }
  }

  throw new Error('Admin login failed for all known credential candidates. Set TEST_ADMIN_USERNAME and TEST_ADMIN_PASSWORD for this environment.');
}

export async function adminLogout(page: Page) {
  const logoutBtn = page.getByRole('button', { name: /logout|sign out/i });
  if (await logoutBtn.isVisible({ timeout: 3000 })) await logoutBtn.click();
}
