import { chromium } from '@playwright/test';

const STOREFRONT = process.env.SMOKE_STOREFRONT_URL || 'http://localhost:3000';
const ADMIN = process.env.SMOKE_ADMIN_URL || 'http://localhost:5173';
const API = process.env.SMOKE_API_URL || 'http://localhost:4000';
const SMOKE_BATCH = (process.env.SMOKE_BATCH || 'all').toLowerCase();
const E2E_USER_EMAIL = process.env.SMOKE_USER_EMAIL || 'e2e.storefront@oceanbazar.test';
const E2E_USER_PASSWORD = process.env.SMOKE_USER_PASSWORD || 'Test@1234';

const NOISY_REQ_PATTERNS = [
  /_rsc=/i,
  /videos\.pexels\.com/i,
];

function shouldIgnoreRequestFailure(url = '', errorText = '') {
  if (NOISY_REQ_PATTERNS.some((re) => re.test(url))) return true;
  if (/ERR_ABORTED/i.test(errorText) && /localhost:(3000|3001)/i.test(url)) return true;
  return false;
}

function trackPage(page, label) {
  const issues = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text() || '';
      if (/Failed to load resource: the server responded with a status of 404/i.test(text)) return;
      if (/Failed to fetch RSC payload/i.test(text)) return;
      issues.push(`[${label}] console.error: ${text}`);
    }
  });
  page.on('pageerror', (err) => {
    issues.push(`[${label}] pageerror: ${err.message}`);
  });
  page.on('response', (res) => {
    if (res.status() >= 500) {
      issues.push(`[${label}] HTTP ${res.status()} ${res.url()}`);
    }
  });
  page.on('requestfailed', (req) => {
    const failure = req.failure()?.errorText || 'unknown';
    if (shouldIgnoreRequestFailure(req.url(), failure)) return;
    issues.push(
      `[${label}] requestfailed ${req.resourceType()} ${req.url()} :: ${failure}`
    );
  });
  return issues;
}

async function enableTestModePopupSuppression(page) {
  await page.context().addInitScript(() => {
    try {
      localStorage.setItem('ob_e2e_disable_popups', '1');
      localStorage.setItem('ob_welcome_dismissed', String(Date.now()));
      document.documentElement.setAttribute('data-e2e-smoke', '1');
      const style = document.createElement('style');
      style.setAttribute('data-e2e-smoke-style', '1');
      style.textContent = `
        [data-nav-loading-overlay="true"],
        .fixed.inset-0.z-\\[90\\],
        .fixed.inset-0.z-\\[100\\],
        .fixed.inset-0.z-50,
        [role="dialog"][aria-modal="true"] + .fixed.inset-0,
        div[class*="newsletter"],
        div[class*="popup"],
        div[class*="modal-backdrop"] {
          pointer-events: none !important;
        }
      `;
      document.head.appendChild(style);
    } catch {}
  });
}

async function closeKnownOverlays(page) {
  const closeSelectors = [
    'button[aria-label="Close"]',
    'button[aria-label="close"]',
    'button:has-text("Close")',
    'button:has-text("Cancel")',
    'button:has-text("Skip")',
    'button:has-text("Not now")',
    '[role="dialog"] button svg',
  ];
  const blockers = [
    '[data-nav-loading-overlay="true"]',
    '[role="status"][aria-busy="true"]',
    '.absolute.inset-0.bg-black\\/50.backdrop-blur-md',
    '.fixed.inset-0.z-\\[100\\]',
    '.fixed.inset-0.z-\\[90\\]',
    '.fixed.inset-0.z-50',
  ];
  for (const sel of closeSelectors) {
    const el = page.locator(sel).first();
    if (await el.isVisible().catch(() => false)) {
      await el.click({ timeout: 1000 }).catch(() => {});
      await page.waitForTimeout(120);
    }
  }
  await page.keyboard.press('Escape').catch(() => {});
  await page.locator('.absolute.inset-0.bg-black\\/50.backdrop-blur-md').first().click({ timeout: 500 }).catch(() => {});
  await page.waitForTimeout(80);
  for (const b of blockers) {
    const blocker = page.locator(b).first();
    await blocker.waitFor({ state: 'hidden', timeout: 1500 }).catch(() => {});
  }
}

async function gotoWithRetry(page, url, opts = {}) {
  const attempts = opts.attempts || 3;
  let lastErr = null;
  for (let i = 0; i < attempts; i += 1) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(300);
      await closeKnownOverlays(page);
      return;
    } catch (err) {
      lastErr = err;
      await page.waitForTimeout(500 * (i + 1));
    }
  }
  throw lastErr || new Error(`Failed to navigate: ${url}`);
}

async function assertEssentialUI(page, path, issues, label) {
  const routeChecks = {
    '/en': ['header', 'main'],
    '/en/products': ['main', 'input[type="search"], input[placeholder*="search" i], [data-testid="search"]'],
    '/en/cart': ['main'],
    '/en/checkout': ['main'],
    '/en/account': ['main'],
    '/en/orders': ['main'],
    '/en/order-tracking': ['main'],
    '/en/notifications': ['main'],
    '/en/referral': ['main'],
    '/en/categories': ['main'],
  };
  const checks = routeChecks[path] || ['main'];
  for (const c of checks) {
    const loc = page.locator(c).first();
    const ok = await loc.isVisible({ timeout: 3000 }).catch(() => false);
    if (!ok) {
      issues.push(`[${label}] missing essential UI (${c}) on ${path}`);
    }
  }
}

async function clickVisibleButtons(page, label, max = 30) {
  const issues = [];
  await closeKnownOverlays(page);
  const buttons = page.locator('button:visible');
  const count = Math.min(await buttons.count(), max);
  for (let i = 0; i < count; i += 1) {
    const btn = buttons.nth(i);
    try {
      const text = (await btn.innerText()).trim().slice(0, 40) || `button-${i + 1}`;
      await closeKnownOverlays(page);
      await btn.click({ timeout: 2000 });
      await page.waitForTimeout(100);
      // Close modal/dialog escapes if opened
      await closeKnownOverlays(page);
      // eslint-disable-next-line no-console
      console.log(`[${label}] clicked: ${text}`);
    } catch (err) {
      issues.push(`[${label}] button click failed at index ${i}: ${err.message}`);
    }
  }
  return issues;
}

async function storefrontLogin(page, issues) {
  try {
    const res = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ identifier: E2E_USER_EMAIL, password: E2E_USER_PASSWORD }),
    });
    if (!res.ok) {
      issues.push(`[storefront-auth] login failed with status ${res.status}`);
      return false;
    }
    const body = await res.json();
    const token = body?.token || body?.access || '';
    const user = body?.user || null;
    if (!token || !user) {
      issues.push('[storefront-auth] login response missing token/user');
      return false;
    }
    await page.context().addInitScript(({ tk, u }) => {
      localStorage.setItem('ob_access_token', tk);
      localStorage.setItem('ob-auth', JSON.stringify({ state: { user: u, isAuthenticated: true }, version: 0 }));
      localStorage.setItem('ob_welcome_dismissed', String(Date.now()));
      localStorage.setItem('ob_e2e_disable_popups', '1');
    }, { tk: token, u: user });
    return true;
  } catch (err) {
    issues.push(`[storefront-auth] login error: ${err.message}`);
    return false;
  }
}

async function visitPaths(page, base, paths, label, checks, issues) {
  for (const path of paths) {
    try {
      await gotoWithRetry(page, `${base}${path}`);
      checks.push(`${label}-${path}-ok`);
      await assertEssentialUI(page, path, issues, label);
      issues.push(...await clickVisibleButtons(page, `${label}-${path}`, 12));
    } catch (err) {
      issues.push(`[${label}] navigation failure ${path}: ${err.message}`);
    }
  }
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await enableTestModePopupSuppression(page);
  const issues = trackPage(page, 'storefront');

  const checks = [];

  try {
    if (SMOKE_BATCH === 'all' || SMOKE_BATCH === 'storefront') {
      await gotoWithRetry(page, `${STOREFRONT}/en`);
      checks.push('storefront-home-ok');
      await assertEssentialUI(page, '/en', issues, 'storefront');
      issues.push(...await clickVisibleButtons(page, 'storefront-home', 20));

      await gotoWithRetry(page, `${STOREFRONT}/en/products`);
      checks.push('storefront-products-ok');
      await assertEssentialUI(page, '/en/products', issues, 'storefront');
      issues.push(...await clickVisibleButtons(page, 'storefront-products', 20));

      const productRes = await fetch(`${API}/api/products?limit=1&page=1`);
      const productJson = await productRes.json();
      const first = productJson?.products?.[0];
      if (first?.id) {
        await gotoWithRetry(page, `${STOREFRONT}/en/product/${first.slug || first.id}`);
        checks.push('storefront-product-detail-ok');
        await assertEssentialUI(page, '/en/product', issues, 'storefront');
        issues.push(...await clickVisibleButtons(page, 'storefront-product', 30));
      }
    }

    if (SMOKE_BATCH === 'all' || SMOKE_BATCH === 'account') {
      await storefrontLogin(page, issues);
      await visitPaths(
        page,
        STOREFRONT,
        [
          '/en/cart',
          '/en/checkout',
          '/en/account',
          '/en/account/orders',
          '/en/order-tracking',
          '/en/account/notifications',
          '/en/account/referral',
          '/en/categories',
        ],
        'storefront',
        checks,
        issues
      );
    }
  } catch (err) {
    issues.push(`[storefront] navigation failure: ${err.message}`);
  }

  const adminIssues = [];
  if (SMOKE_BATCH === 'all' || SMOKE_BATCH === 'admin') {
    const adminPage = await context.newPage();
    await enableTestModePopupSuppression(adminPage);
    adminIssues.push(...trackPage(adminPage, 'admin'));
    try {
      await gotoWithRetry(adminPage, ADMIN);
      await adminPage.waitForSelector('input[placeholder*="admin" i], input[type="text"]', { timeout: 20000 });
      checks.push('admin-login-page-ok');
      await adminPage
        .locator('input[placeholder*="admin" i], input[type="email"], input[type="text"]')
        .first()
        .fill(process.env.SMOKE_ADMIN_USER || 'superadmin');
      await adminPage.locator('input[type="password"]').first().fill(process.env.SMOKE_ADMIN_PASS || 'Admin@1234');
      await adminPage.getByRole('button', { name: /secure session|log in|sign in|establish/i }).first().click();
      await adminPage.waitForTimeout(1000);
      await closeKnownOverlays(adminPage);
      checks.push('admin-auth-ok');

      const adminModules = [
        'Dashboard', 'Analytics', 'Products', 'Explorer', 'Inventory', 'Orders',
        'Delivery', 'Returns', 'Payments', 'Coupons', 'Customers', 'Reviews',
        'Disputes', 'Live Chat', 'Tickets', 'Alerts', 'Engagement', 'Applications',
        'Team', 'Audit Logs', 'Settings',
      ];
      for (const moduleName of adminModules) {
        const navBtn = adminPage.getByRole('button', { name: new RegExp(`^${moduleName}$`, 'i') }).first();
        if (await navBtn.isVisible({ timeout: 1200 }).catch(() => false)) {
          await closeKnownOverlays(adminPage);
          await navBtn.click({ timeout: 3000 }).catch((err) => {
            adminIssues.push(`[admin] failed to open module ${moduleName}: ${err.message}`);
          });
          await adminPage.waitForTimeout(600);
        }
      }

      adminIssues.push(...await clickVisibleButtons(adminPage, 'admin-app', 25));
    } catch (err) {
      adminIssues.push(`[admin] navigation failure: ${err.message}`);
    }
  }

  const allIssues = [...new Set([...issues, ...adminIssues])];
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ batch: SMOKE_BATCH, checks, issueCount: allIssues.length, issues: allIssues }, null, 2));
  await browser.close();
  process.exit(allIssues.length ? 1 : 0);
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
