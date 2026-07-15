# Production Testing Checklist

## Product Media & Rich Description

### 1. Add Product Wizard — Multi-Media

- [ ] Open Admin CRM > Products > Add New Product
- [ ] **Step 2 — Images:** Upload 5+ product images; verify drag-reorder and set-primary work
- [ ] **Step 2 — Videos:** Upload 2+ product videos (MP4/WEBM); verify they appear in the video list
- [ ] **Step 2 — Banners:** Upload 2+ banner images (1200x400px recommended); verify thumbnail previews
- [ ] **Step 5 — Description:** Use rich text editor to format text (bold, headings, lists, table)
- [ ] **Step 5 — Insert Image:** Click the image button in the editor toolbar; upload an inline image; verify it appears in the editor
- [ ] **Step 7 — Preview:** Confirm all media counts are shown (images, videos, banners)
- [ ] **Publish:** Complete all steps and publish; verify success toast

### 2. Admin — Edit Product

- [ ] Open Products list and click a product to open the Edit Drawer
- [ ] **Media tab:** Verify images and videos are listed separately
- [ ] **Media tab — Videos:** Upload a new video; verify it appears; delete it
- [ ] **Media tab — Banners:** Upload a new banner; verify it appears with thumbnail; delete it
- [ ] **Content tab:** Verify the description loads in the RichTextEditor with existing formatting preserved
- [ ] **Content tab:** Edit description with inline image; save; reload — verify images are still visible
- [ ] **Explorer panel:** Open ProductDetailPanel; verify description field shows RichTextEditor

### 3. Storefront — Product Detail Page (PDP)

- [ ] Navigate to a product that has videos, banners, and a rich description
- [ ] **Gallery:** Verify images and video thumbnails appear in ProductZoomGallery
- [ ] **Banners:** Verify ProductBannerCarousel renders below the gallery (auto-rotation, arrows, dots)
- [ ] **Description tab:** Verify formatted HTML renders correctly (headings, bold, lists, tables)
- [ ] **Description tab:** Verify inline images render with `max-width:100%` and rounded corners
- [ ] **Description tab:** Verify no raw HTML tags are visible

### 4. SEO & JSON-LD

- [ ] View page source of a PDP; confirm `<meta name="description">` contains plain text (no HTML tags)
- [ ] Confirm JSON-LD `Product.image` array contains only image URLs (no video URLs)
- [ ] Confirm JSON-LD `Product.description` is plain text

### 5. Regression

- [ ] **Login:** Admin CRM login works; session persists on refresh
- [ ] **Category mega menu:** Storefront navigation works
- [ ] **Cart/checkout:** Add product to cart; proceed through checkout smoke test

### 6. Docker Rebuild

```bash
cd backend && npx tsc
docker compose build admin web api
docker compose up -d
# Clear product detail cache if needed:
# docker compose exec redis redis-cli KEYS "bff:product-detail*" | xargs docker compose exec redis redis-cli DEL
```
