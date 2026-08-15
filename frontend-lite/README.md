# OceanBazar Lite Storefront

Near-zero-JS, server-rendered storefront for low-end devices (iPhone 6/7, Pixel 4, Android ≤12).

- **Stack:** Node.js + Express + EJS + tiny ES5 `public/app.js`
- **Data:** same Node BFF (`BFF_INTERNAL_URL`, default `http://api:4000`)
- **Canonical URL:** `https://oceanbazar.com.bd/lite` (`BASE_PATH=/lite`)
- **Toggle:** `/prefer?view=full|lite&next=/bn&ttl=` (sets `ob_view` cookie on `.oceanbazar.com.bd`)
  - Explicit Full/Lite site links: year-long cookie
  - Optional full-site prefer still available from footer; support tools stay on lite

## Performance budgets

| Asset | Target |
|-------|--------|
| `public/app.js` | &lt; 30 KB |
| `public/styles.css` | aim &lt; 40 KB gzipped |
| Fonts | Noto Sans Bengali **400 + 700** only |
| Default logos | WebP + compressed PNG (~15 KB) |
| LCP hero image | Cloudinary `w_960` / product cards `w_360` |

## Lite-native support tools

All available without opening the full site:

- Live chat (`/:locale/chat`) — SSR + light poll
- Support tickets (`/:locale/tickets`)
- Returns & refunds (`/:locale/returns`)
- OB Points (`/:locale/account/points`)
- Support center (`/:locale/support`) — static + deep links above

## Device routing

Low-end UAs are redirected to Lite unless `ob_view=full`:

- iOS 10–15
- Android 4–12

Rules must stay aligned in:

1. `nginx/nginx.conf` → `$ob_old_ua`
2. `frontend/lib/storefrontCapability.ts`
3. `frontend/app/layout.tsx` → `LITE_DEVICE_HINT`

On the full site, low-end UAs see a **Back to Lite** banner (`LiteReturnBanner`).

## Local

```bash
cd frontend-lite
npm install
BFF_INTERNAL_URL=http://127.0.0.1:4000 FULL_SITE_ORIGIN=http://localhost:3000 BASE_PATH= npm start
# http://localhost:3001/bn
```

## Production

Docker service `web_lite` behind nginx path `/lite/`.
Old-device User-Agents on the main domain redirect here unless `ob_view=full`.

## Low-end QA checklist

Run after every lite/nginx/web deploy on **iPhone 7 Safari** and **Pixel 4 Chrome**:

1. Cold open `https://oceanbazar.com.bd/` → lands on `/lite/...`
2. Home: hero + product grid paint without blank screen
3. PLP / PDP → Add to cart → Cart → Checkout → place COD or Pay now
4. Track order, Support Center, Privacy policy pages load on lite
5. Support → Live Chat / Tickets / Returns / OB Points work on lite (login where required)
6. Explicit Full site toggle still optional; low-end UAs are not forced off lite for tools
