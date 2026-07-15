# CSP & third-party inventory (storefront)

Headers are built in `frontend/csp-headers.mjs` and attached via `next.config.mjs`.

| Source | Used for | CSP directive |
|--------|-----------|---------------|
| `'self'` | Next.js, API calls | default, script, style, connect |
| `https://www.google.com`, `gstatic.com`, `recaptcha.net` | reCAPTCHA / Google scripts | script-src, frame-src, connect-src |
| `https://*.googleapis.com` | Firebase / Google APIs | connect-src |
| `https://*.cloudinary.com` | Product media CDN | img-src, connect-src |
| `NEXT_PUBLIC_API_URL` origin | BFF | connect-src |
| `wss:` / `ws:` | Socket.IO / realtime | connect-src |
| Fonts | Google Fonts | style-src, font-src |

## SRI (Subresource Integrity)

Next.js bundles most JavaScript; **do not** add raw `<script src="…">` without `integrity=` and a pinned version. If you add `next/script` with an external `src`, generate an integrity hash (e.g. `openssl dgst -sha384 -binary` + base64) and document it here.

## Operational flags

| Env | Meaning |
|-----|---------|
| `CSP_MODE` | `report-only` (default) → `Content-Security-Policy-Report-Only`; `enforce` → blocking CSP |
| `CSP_UPGRADE_INSECURE` | `true` adds `upgrade-insecure-requests` (avoid on pure HTTP dev) |
| `NEXT_PUBLIC_CSP_EXTRA_CONNECT_SRC` | Space-separated extra `connect-src` hosts |

## Tightening

1. Run with **Report-Only** in staging; collect violations (browser console / reporting API).
2. Remove `unsafe-eval` if your build allows (often required for dev; test prod bundle).
3. Switch to `CSP_MODE=enforce` when clean.
