#!/usr/bin/env node
/**
 * Seed CRM storefront content demos (logos, testimonials, trust badges,
 * curated product IDs, carousel timing) into site_settings via BFF admin API
 * or direct Prisma when DATABASE_URL is set.
 *
 * Usage (admin JWT):
 *   ADMIN_TOKEN=... API_BASE=https://oceanbazar.com.bd node scripts/ops/seed-storefront-content-demos.js
 *
 * Usage (direct DB):
 *   DATABASE_URL=... node scripts/ops/seed-storefront-content-demos.js --prisma
 */
const DEMO = {
  logoLightUrl: 'https://oceanbazar.com.bd/ob-brand-logo.png?v=7',
  logoDarkUrl: 'https://oceanbazar.com.bd/ob-footer-logo.png?v=7',
  faviconUrl: 'https://oceanbazar.com.bd/ob-brand-logo.png?v=7',
  defaultBannerRotationMs: 5500,
  testimonialCarouselMs: 7000,
  testimonials: [
    {
      name: 'Nusrat Rahman',
      title: 'Dhaka',
      quote: 'Every serum arrived sealed and authentic — exactly what OceanBazar promises.',
      rating: 5,
      verified: true,
    },
    {
      name: 'Farhan Ahmed',
      title: 'Chattogram',
      quote: 'Wholesale pricing with retail-grade packaging. Reordered within a week.',
      rating: 5,
      verified: true,
    },
    {
      name: 'Maliha Chowdhury',
      title: 'Sylhet',
      quote: 'Support answered on chat the same hour. Delivery was on time across town.',
      rating: 5,
      verified: true,
    },
  ],
  trustBadges: [
    { icon: 'shield', label: '100% authentic', labelBn: '১০০% অথেন্টিক', description: 'Verified genuine products' },
    { icon: 'truck', label: 'Nationwide delivery', labelBn: 'সারাদেশে ডেলিভারি', description: 'Across Bangladesh' },
    { icon: 'lock', label: 'Secure payment', labelBn: 'নিরাপদ পেমেন্ট', description: 'bKash · Nagad · COD' },
    { icon: 'headphones', label: 'Real support', labelBn: 'লাইভ সাপোর্ট', description: 'Chat when you need it' },
  ],
};

async function seedViaApi() {
  const base = (process.env.API_BASE || 'https://oceanbazar.com.bd').replace(/\/$/, '');
  const token = process.env.ADMIN_TOKEN;
  if (!token) throw new Error('ADMIN_TOKEN required for API seed');

  const productsRes = await fetch(`${base}/api/products?limit=12&page=1`, {
    headers: { Accept: 'application/json' },
  });
  const productsJson = await productsRes.json().catch(() => ({}));
  const products = Array.isArray(productsJson.products) ? productsJson.products : [];
  const ids = products.map((p) => p.id).filter(Boolean);
  const featuredProductIds = ids.slice(0, 4);
  const bestDealsProductIds = ids.slice(0, 3);
  const newArrivalsProductIds = ids.slice(Math.max(0, ids.length - 4));

  const payload = {
    ...DEMO,
    featuredProductIds,
    bestDealsProductIds,
    newArrivalsProductIds,
  };

  const res = await fetch(`${base}/api/admin/global-settings`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API seed failed ${res.status}: ${text.slice(0, 400)}`);
  }
  console.log('Seeded via admin API', {
    featuredProductIds,
    bestDealsProductIds,
    newArrivalsProductIds,
  });
}

async function seedViaPrisma() {
  const { PrismaClient } = require('../../backend/node_modules/@prisma/client');
  const prisma = new PrismaClient();
  try {
    const products = await prisma.product.findMany({
      where: { status: 'active' },
      select: { id: true },
      orderBy: { updatedAt: 'desc' },
      take: 12,
    });
    const ids = products.map((p) => p.id);
    await prisma.site_settings.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        logo_light_url: DEMO.logoLightUrl,
        logo_dark_url: DEMO.logoDarkUrl,
        favicon_url: DEMO.faviconUrl,
        testimonials: DEMO.testimonials,
        trust_badges: DEMO.trustBadges,
        featured_product_ids: ids.slice(0, 4),
        best_deals_product_ids: ids.slice(0, 3),
        new_arrivals_product_ids: ids.slice(Math.max(0, ids.length - 4)),
        default_banner_rotation_ms: DEMO.defaultBannerRotationMs,
        testimonial_carousel_ms: DEMO.testimonialCarouselMs,
      },
      update: {
        logo_light_url: DEMO.logoLightUrl,
        logo_dark_url: DEMO.logoDarkUrl,
        favicon_url: DEMO.faviconUrl,
        testimonials: DEMO.testimonials,
        trust_badges: DEMO.trustBadges,
        featured_product_ids: ids.slice(0, 4),
        best_deals_product_ids: ids.slice(0, 3),
        new_arrivals_product_ids: ids.slice(Math.max(0, ids.length - 4)),
        default_banner_rotation_ms: DEMO.defaultBannerRotationMs,
        testimonial_carousel_ms: DEMO.testimonialCarouselMs,
        updated_at: new Date(),
      },
    });
    console.log('Seeded via Prisma', { productIds: ids.length });
  } finally {
    await prisma.$disconnect();
  }
}

(async () => {
  if (process.argv.includes('--prisma')) await seedViaPrisma();
  else await seedViaApi();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
