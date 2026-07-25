# OceanBazar Lite Storefront

Near-zero-JS, server-rendered storefront for low-end devices (iPhone 7, Pixel 4, etc.).

- **Stack:** Node.js + Express + EJS + tiny ES5 `public/app.js`
- **Data:** same Node BFF (`BFF_INTERNAL_URL`, default `http://api:4000`)
- **Public URL:** `https://lite.oceanbazar.com.bd`
- **Toggle:** `/prefer?view=full|lite&next=/bn` (sets `ob_view` cookie on `.oceanbazar.com.bd`)

## Local

```bash
cd frontend-lite
npm install
BFF_INTERNAL_URL=http://127.0.0.1:4000 FULL_SITE_ORIGIN=http://localhost:3000 npm start
# http://localhost:3001/bn
```

## Production

Served as Docker service `web_lite` (port 3001) behind nginx `lite.oceanbazar.com.bd`.
Old-device User-Agents on the main domain are redirected here unless `ob_view=full`.
