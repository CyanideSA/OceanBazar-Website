import { resolvePublicApiBase } from '@/lib/api';

/**
 * SSLCommerz Easy Checkout helpers.
 * Primary UX: official embed.min.js popup (compact Easy Checkout card).
 * Fallback: compact in-page iframe modal sized to the payment card.
 * Hosted full-page redirect only as last resort.
 */

export type SslPublicConfig = {
  mode: 'sandbox' | 'live';
  embedScriptUrl: string;
  configured: boolean;
};

export type SslInitiateResult = {
  status?: string;
  data?: string | null;
  logo?: string | null;
  redirectUrl?: string;
  transactionId?: string;
  sessionkey?: string | null;
  error?: string;
  message?: string;
};

const OVERLAY_ID = 'sslcz-easy-checkout-overlay';
const BRIDGE_BTN_ID = 'sslczPayBtn';
let embedScriptPromise: Promise<void> | null = null;
let cachedConfig: SslPublicConfig | null = null;
let paymentPollTimer: number | null = null;

export async function fetchSslPublicConfig(): Promise<SslPublicConfig> {
  if (cachedConfig) return cachedConfig;
  const url = `${resolvePublicApiBase()}/api/payments/sslcommerz/config`;
  try {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error('config fetch failed');
    const data = (await res.json()) as SslPublicConfig;
    cachedConfig = {
      mode: data.mode === 'live' ? 'live' : 'sandbox',
      embedScriptUrl:
        data.embedScriptUrl
        || (data.mode === 'live'
          ? 'https://seamless-epay.sslcommerz.com/embed.min.js'
          : 'https://sandbox.sslcommerz.com/embed.min.js'),
      configured: Boolean(data.configured),
    };
    return cachedConfig;
  } catch {
    cachedConfig = {
      mode: 'sandbox',
      embedScriptUrl: 'https://sandbox.sslcommerz.com/embed.min.js',
      configured: false,
    };
    return cachedConfig;
  }
}

export function loadSslEmbedScript(scriptUrl: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  const existing = document.querySelector<HTMLScriptElement>('script[data-sslcz-embed="1"]');
  if (existing) return Promise.resolve();
  if (embedScriptPromise) return embedScriptPromise;

  embedScriptPromise = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = `${scriptUrl}${scriptUrl.includes('?') ? '&' : '?'}${Math.random().toString(36).slice(2, 9)}`;
    script.async = true;
    script.dataset.sslczEmbed = '1';
    script.onload = () => resolve();
    script.onerror = () => resolve();
    const first = document.getElementsByTagName('script')[0];
    if (first?.parentNode) first.parentNode.insertBefore(script, first);
    else document.body.appendChild(script);
  });
  return embedScriptPromise;
}

function closeEasyCheckoutOverlay() {
  document.getElementById(OVERLAY_ID)?.remove();
  document.documentElement.style.overflow = '';
  document.body.style.overflow = '';
}

function stopPaymentPolling() {
  if (paymentPollTimer != null) {
    window.clearInterval(paymentPollTimer);
    paymentPollTimer = null;
  }
}

/**
 * Poll order payment status while Easy Checkout is open so OceanBazar updates
 * after successful payment (IPN / success callback) without requiring a full
 * parent-page redirect mid-checkout.
 */
function startPaymentPolling(opts: {
  orderId?: string;
  onPaid?: (status: string) => void;
}) {
  stopPaymentPolling();
  const orderId = String(opts.orderId || '').trim();
  if (!orderId || typeof window === 'undefined') return;

  let tries = 0;
  paymentPollTimer = window.setInterval(async () => {
    tries += 1;
    if (tries > 90) {
      stopPaymentPolling();
      return;
    }
    try {
      const res = await fetch(`${resolvePublicApiBase()}/api/orders/${encodeURIComponent(orderId)}`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { paymentStatus?: string; order?: { paymentStatus?: string } };
      const status = String(data.paymentStatus || data.order?.paymentStatus || '').toLowerCase();
      if (['under_verification', 'pending_verification', 'paid'].includes(status)) {
        stopPaymentPolling();
        // #region agent log
        fetch('http://127.0.0.1:7896/ingest/89e60d83-694f-49b3-8a65-19c43e3fa97c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e24651'},body:JSON.stringify({sessionId:'e24651',runId:'ssl-popup',hypothesisId:'P1',location:'sslcommerzEasyCheckout.ts:poll',message:'payment success detected via poll',data:{orderId,status},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        opts.onPaid?.(status);
      }
    } catch {
      /* keep polling */
    }
  }, 2500);
}

/** Compact modal matching SSL Easy Checkout card (~mobile width). */
function openCompactIframeModal(gatewayUrl: string, logo?: string | null): boolean {
  try {
    closeEasyCheckoutOverlay();

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'SSLCommerz payment');
    overlay.dataset.obSslCompact = '1';
    overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:2147483000',
      'background:rgba(15,23,42,0.55)',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'padding:max(8px, env(safe-area-inset-top)) max(8px, env(safe-area-inset-right)) max(8px, env(safe-area-inset-bottom)) max(8px, env(safe-area-inset-left))',
      'box-sizing:border-box',
    ].join(';');

    const panel = document.createElement('div');
    // Essential Easy Checkout card size (green-box area in merchant screenshots)
    panel.style.cssText = [
      'position:relative',
      'width:min(420px,100%)',
      'height:min(720px,92vh)',
      'max-height:92vh',
      'background:#fff',
      'border-radius:10px',
      'overflow:hidden',
      'box-shadow:0 20px 45px rgba(0,0,0,0.30)',
      'display:flex',
      'flex-direction:column',
    ].join(';');

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close payment');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText =
      'position:absolute;top:6px;right:8px;z-index:2;border:0;background:rgba(248,250,252,0.92);border-radius:999px;width:32px;height:32px;font:700 14px/1 system-ui,sans-serif;cursor:pointer;color:#64748b;box-shadow:0 1px 4px rgba(0,0,0,0.12)';
    closeBtn.onclick = () => {
      stopPaymentPolling();
      closeEasyCheckoutOverlay();
    };

    const iframe = document.createElement('iframe');
    iframe.src = gatewayUrl;
    iframe.title = 'SSLCommerz Easy Checkout';
    iframe.allow = 'payment *';
    iframe.setAttribute('allowpaymentrequest', 'true');
    iframe.style.cssText = 'display:block;width:100%;height:100%;border:0;background:#fff;';

    panel.appendChild(closeBtn);
    panel.appendChild(iframe);
    overlay.appendChild(panel);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        stopPaymentPolling();
        closeEasyCheckoutOverlay();
      }
    });
    document.body.appendChild(overlay);
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    if (logo) {
      // keep logo available for SSL chrome inside iframe; no outer header chrome
      void logo;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Prefer official Easy Checkout (embed.min.js → tingle popup with GatewayPageURL).
 * We feed the already-initiated URL through a same-origin bridge so the embed
 * script opens its compact popup instead of a full portal redirect.
 */
async function openViaOfficialEmbed(gatewayUrl: string, logo?: string | null): Promise<boolean> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;

  const bridgePath = '/api/payments/sslcommerz/easy-checkout-bridge';
  // Install a one-shot fetch/XHR patch so embed.min.js "endpoint" call returns our payload
  // without a second payment initiation.
  const payload = JSON.stringify({
    status: 'success',
    data: gatewayUrl,
    logo: logo || null,
  });

  const originalFetch = window.fetch.bind(window);
  let used = false;
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!used && url.includes('easy-checkout-bridge')) {
      used = true;
      window.fetch = originalFetch;
      return new Response(payload, {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return originalFetch(input, init);
  };

  // Also patch XHR (embed uses jQuery ajax → XHR)
  const XO = window.XMLHttpRequest;
  const Proto = XO.prototype;
  const openOrig = Proto.open;
  const sendOrig = Proto.send;
  Proto.open = function (this: XMLHttpRequest, method: string, url: string | URL, ...rest: unknown[]) {
    (this as XMLHttpRequest & { __obSslBridge?: boolean }).__obSslBridge =
      String(url).includes('easy-checkout-bridge');
    return openOrig.apply(this, [method, url, ...(rest as [])] as unknown as Parameters<typeof openOrig>);
  };
  Proto.send = function (this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null) {
    const self = this as XMLHttpRequest & { __obSslBridge?: boolean };
    if (self.__obSslBridge && !used) {
      used = true;
      Proto.open = openOrig;
      Proto.send = sendOrig;
      window.fetch = originalFetch;
      Object.defineProperty(self, 'readyState', { configurable: true, get: () => 4 });
      Object.defineProperty(self, 'status', { configurable: true, get: () => 200 });
      Object.defineProperty(self, 'responseText', { configurable: true, get: () => payload });
      Object.defineProperty(self, 'response', { configurable: true, get: () => payload });
      self.onreadystatechange?.call(self, new Event('readystatechange'));
      self.onload?.call(self, new ProgressEvent('load'));
      return;
    }
    return sendOrig.call(this, body);
  };

  // Clean any previous bridge button, then create official #sslczPayBtn
  document.getElementById(BRIDGE_BTN_ID)?.remove();
  const btn = document.createElement('button');
  btn.id = BRIDGE_BTN_ID;
  btn.type = 'button';
  btn.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none;width:1px;height:1px;';
  btn.setAttribute('endpoint', bridgePath);
  btn.setAttribute('postdata', '{}');
  document.body.appendChild(btn);

  // Give embed.min.js a tick to bind click handlers after script load
  await new Promise((r) => setTimeout(r, 50));
  btn.click();

  // If embed did not open a tingle modal shortly, fall back
  await new Promise((r) => setTimeout(r, 600));
  const tingleOpen = !!document.querySelector('.tingle-modal-box, .tingle-modal--visible, .tingle-enabled');
  // #region agent log
  fetch('http://127.0.0.1:7896/ingest/89e60d83-694f-49b3-8a65-19c43e3fa97c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e24651'},body:JSON.stringify({sessionId:'e24651',runId:'ssl-popup',hypothesisId:'P2',location:'sslcommerzEasyCheckout.ts:officialEmbed',message:'official embed attempt',data:{tingleOpen,usedBridge:used},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  // Restore patches if still in place
  window.fetch = originalFetch;
  Proto.open = openOrig;
  Proto.send = sendOrig;
  document.getElementById(BRIDGE_BTN_ID)?.remove();

  return tingleOpen || used;
}

/**
 * Opens SSLCommerz Easy Checkout as a compact popup (essential payment card).
 * Falls back to compact iframe modal, then hosted redirect.
 */
export async function openSslEasyCheckout(opts: {
  gatewayUrl: string;
  logo?: string | null;
  orderId?: string;
  onPaid?: (status: string) => void;
}): Promise<'modal' | 'redirect'> {
  const gatewayUrl = String(opts.gatewayUrl || '').trim();
  if (!gatewayUrl) throw new Error('Missing GatewayPageURL');

  const config = await fetchSslPublicConfig();
  await loadSslEmbedScript(config.embedScriptUrl);

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    window.location.href = gatewayUrl;
    return 'redirect';
  }

  startPaymentPolling({
    orderId: opts.orderId,
    onPaid: (status) => {
      closeEasyCheckoutOverlay();
      opts.onPaid?.(status);
    },
  });

  const viaOfficial = await openViaOfficialEmbed(gatewayUrl, opts.logo);
  if (viaOfficial) return 'modal';

  if (openCompactIframeModal(gatewayUrl, opts.logo)) {
    return 'modal';
  }

  stopPaymentPolling();
  window.location.href = gatewayUrl;
  return 'redirect';
}

/** Prefer Easy Checkout modal; fall back to redirect. */
export async function startSslCheckoutFromInitiate(
  result: SslInitiateResult,
  opts?: { orderId?: string; onPaid?: (status: string) => void },
): Promise<void> {
  const gatewayUrl = String(result.data || result.redirectUrl || '').trim();
  if (!gatewayUrl) {
    throw new Error(result.error || result.message || 'Could not start SSLCommerz payment');
  }
  await openSslEasyCheckout({
    gatewayUrl,
    logo: result.logo,
    orderId: opts?.orderId,
    onPaid: opts?.onPaid,
  });
}
