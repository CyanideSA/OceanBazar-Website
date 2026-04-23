/**
 * OceanBazar Presentation Seed Script v2
 * Uploads REAL images to Cloudinary, seeds products, banners, orders.
 * Usage: node scripts/seed-presentation.mjs
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

const JAVA = 'http://127.0.0.1:8000';
const BFF  = 'http://127.0.0.1:4000';

// Cloudinary direct upload (unsigned not needed — we use the admin API)
const CLOUD_NAME = 'dmtafp1fi';
const CLOUD_KEY  = '487252925521551';
const CLOUD_SEC  = '_rHB9A85bxjgZqzcNZb0ja9vBk8';

// ─── Helpers ─────────────────────────────────────────────────
const j = (url, opts = {}) => fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', ...opts.headers } }).then(async r => {
  const txt = await r.text();
  try { return { ok: r.ok, status: r.status, data: JSON.parse(txt) }; } catch { return { ok: r.ok, status: r.status, data: txt }; }
});

const psql = (sql) => execSync(
  `docker exec -i oceanbazar_postgres psql -U oceanbazar -d oceanbazar -t -A`,
  { input: sql + ';\n', encoding: 'utf-8' }
).trim();

/** Upload a local file to Cloudinary via the admin media endpoint */
async function uploadToCloudinary(filePath, folder, token) {
  const form = new FormData();
  const buf = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mime = ext === '.mp4' || ext === '.mov' ? 'video/mp4'
    : ext === '.png' ? 'image/png'
    : ext === '.webp' ? 'image/webp'
    : 'image/jpeg';
  form.append('file', new Blob([buf], { type: mime }), path.basename(filePath));
  form.append('folder', folder);
  form.append('tags', 'seed,presentation');
  const r = await fetch(`${JAVA}/api/admin/media/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`Upload failed ${r.status}: ${JSON.stringify(data).substring(0, 200)}`);
  return data.media || data;
}

/** Upload a remote URL image to Cloudinary via admin API by downloading first */
async function uploadUrlToCloudinary(url, folder, name, token) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Fetch failed: ${url}`);
  const buf = Buffer.from(await resp.arrayBuffer());
  const form = new FormData();
  form.append('file', new Blob([buf], { type: 'image/jpeg' }), name + '.jpg');
  form.append('folder', folder);
  form.append('tags', 'seed,presentation');
  const r = await fetch(`${JAVA}/api/admin/media/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`Upload failed ${r.status}: ${JSON.stringify(data).substring(0, 200)}`);
  return data.media || data;
}

// ═══════════════════════════════════════════════════════════════
async function main() {
  console.log('🌊 OceanBazar Presentation Seed v2\n' + '─'.repeat(50));

  // 0) Clean old seeded products to avoid duplicates
  console.log('🧹 Cleaning previous seed data...');
  try {
    psql(`DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE order_number LIKE 'ORD-2024-%')`);
    psql(`DELETE FROM orders WHERE order_number LIKE 'ORD-2024-%'`);
    psql(`DELETE FROM product_assets WHERE product_id IN (SELECT id FROM products WHERE import_source='seed-presentation')`);
    psql(`DELETE FROM product_pricing WHERE product_id IN (SELECT id FROM products WHERE import_source='seed-presentation')`);
    psql(`DELETE FROM products WHERE import_source='seed-presentation'`);
    console.log('  ✓ Old seed data removed');
  } catch (e) { console.log('  ⚠ Cleanup: ' + e.message?.substring(0, 100)); }

  // 1) Admin login
  const { data: loginData } = await j(`${JAVA}/api/admin/auth/login`, { method: 'POST', body: JSON.stringify({ username: 'superadmin', password: 'Admin@123' }) });
  if (!loginData?.token) { console.error('FATAL: Admin login failed'); process.exit(1); }
  const token = loginData.token;
  const auth = { Authorization: `Bearer ${token}` };
  console.log('✓ Admin logged in');

  // 2) Resolve leaf categories
  const catTree = await fetch(`${JAVA}/api/categories`).then(r => r.json());
  const flat = {};
  (function walk(arr) { for (const c of arr) { flat[c.slug || c.nameEn?.toLowerCase()] = c; if (c.children?.length) walk(c.children); } })(catTree);

  const electronicsId = flat['electronics']?.id;
  let gadgetsCatId = null;
  for (const [, v] of Object.entries(flat)) {
    if (v.leaf && v.parentId === electronicsId) { gadgetsCatId = v.id; break; }
  }
  if (!gadgetsCatId) {
    const r = await j(`${JAVA}/api/admin/categories`, { method: 'POST', headers: auth, body: JSON.stringify({ name: 'Gadgets', nameEn: 'Gadgets', nameBn: 'গ্যাজেট', slug: 'gadgets', icon: '', parentId: electronicsId }) });
    gadgetsCatId = r.data?.id;
  }
  const catId = {
    electronics: gadgetsCatId,
    fashion: flat['fashion']?.id,
    'home-garden': flat['home-garden']?.id || flat['home & garden']?.id,
    'beauty-health': flat['beauty-health']?.id || flat['beauty & health']?.id,
    'sports-outdoor': flat['sports-outdoor']?.id || flat['sports & outdoor']?.id,
    'books-stationery': flat['books-stationery']?.id || flat['books & stationery']?.id,
  };
  for (const [k, v] of Object.entries(catId)) {
    if (!v) { for (const [, cat] of Object.entries(flat)) { if (cat.nameEn?.toLowerCase().includes(k.split('-')[0]) && cat.leaf) { catId[k] = cat.id; break; } } }
  }
  console.log('✓ Categories:', JSON.stringify(Object.fromEntries(Object.entries(catId).map(([k, v]) => [k, v?.substring(0, 8) || '???']))));

  // 3) Upload images to Cloudinary for each product
  console.log('\n☁️  Uploading product images to Cloudinary...');

  // Stock image URLs from picsum (we'll download and re-upload to Cloudinary)
  const stockImages = {
    earbuds1:  'https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=600&h=600&fit=crop',
    laptop2:   'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=600&h=600&fit=crop',
    watch3:    'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&h=600&fit=crop',
    saree4:    'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600&h=600&fit=crop',
    polo5:     'https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=600&h=600&fit=crop',
    vacuum6:   'https://images.unsplash.com/photo-1563453392212-326f5e854473?w=600&h=600&fit=crop',
    bedding7:  'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=600&h=600&fit=crop',
    skincare8: 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=600&h=600&fit=crop',
    yoga9:     'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600&h=600&fit=crop',
    books10:   'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=600&h=600&fit=crop',
    speaker11: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=600&h=600&fit=crop',
    bottle12:  'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=600&h=600&fit=crop',
  };

  const cloudUrls = {}; // key → Cloudinary URL
  for (const [key, url] of Object.entries(stockImages)) {
    try {
      const result = await uploadUrlToCloudinary(url, 'products/seed', key, token);
      cloudUrls[key] = result.url;
      console.log(`  ✓ ${key}`);
    } catch (e) {
      console.log(`  ⚠ ${key}: ${e.message?.substring(0, 80)}`);
      cloudUrls[key] = `https://picsum.photos/seed/${key}/600/600`; // fallback
    }
  }

  // 3b) Upload demo folder images
  console.log('\n📂 Uploading demo folder images to Cloudinary...');
  const DEMO_DIR = 'C:\\Users\\akand\\Desktop\\All Categories (Demo)';
  const demoProducts = [
    {
      titleEn: 'Middle East Two Piece Muslim Dubai Casual Dress', titleBn: 'মিডল ইস্ট টু পিস মুসলিম দুবাই ক্যাজুয়াল ড্রেস',
      cat: 'fashion', desc: 'Elegant two-piece Muslim casual dress. Dubai-inspired design, comfortable fabric.', descBn: 'এলিগ্যান্ট টু-পিস মুসলিম ক্যাজুয়াল ড্রেস। দুবাই ডিজাইন।',
      retail: 4500, compare: 6000,
      folder: path.join(DEMO_DIR, 'Apparel & Accessories', 'Ethnic Clothing & Accessories', 'Islamic Clothing', 'Traditional muslim clothing accessories', 'Middle East Two Piece Femmes Muslim Dubai Casual Dress'),
    },
    {
      titleEn: "Zaynab Elegant Women's Abaya Muslim Dress", titleBn: 'জয়নব এলিগ্যান্ট আবায়া মুসলিম ড্রেস',
      cat: 'fashion', desc: 'Premium abaya with elegant design. Perfect for daily and formal wear.', descBn: 'প্রিমিয়াম আবায়া, দৈনন্দিন ও ফর্মাল পরিধান।',
      retail: 5500, compare: 7500,
      folder: path.join(DEMO_DIR, 'Apparel & Accessories', 'Ethnic Clothing & Accessories', 'Islamic Clothing', 'Traditional muslim clothing accessories', "Zaynab Elegant Women's Abaya Muslim Dress"),
    },
    {
      titleEn: 'Pistachio Kernels Fresh Raw Nuts', titleBn: 'পেস্তা বাদাম ফ্রেশ কাঁচা বাদাম',
      cat: 'beauty-health', desc: 'Premium pistachio kernels. Fresh raw, large-sized nuts for snacking and cooking.', descBn: 'প্রিমিয়াম পেস্তা বাদাম। ফ্রেশ, বড় সাইজ।',
      retail: 1200, compare: 1800,
      folder: path.join(DEMO_DIR, 'Pet Supplies', 'Pet food', 'Dry Food', 'Pistachio Kernels Fresh Raw Pistachio Nuts Dry Processed Snacks and Food Ingredients Selected Large Nuts'),
    },
  ];

  const demoAssets = []; // [{productIdx, assets: [{url, type}]}]
  for (const dp of demoProducts) {
    const assets = [];
    if (fs.existsSync(dp.folder)) {
      const files = fs.readdirSync(dp.folder).filter(f => /\.(jpg|jpeg|png|webp|mp4|mov)$/i.test(f));
      for (const file of files.slice(0, 6)) { // max 6 media per product
        const filePath = path.join(dp.folder, file);
        const isVideo = /\.(mp4|mov)$/i.test(file);
        try {
          const result = await uploadToCloudinary(filePath, 'products/demo', token);
          assets.push({ url: result.url, type: isVideo ? 'video' : 'image' });
          console.log(`  ✓ ${dp.titleEn.substring(0, 30)}… → ${file.substring(0, 25)}`);
        } catch (e) {
          console.log(`  ⚠ ${file.substring(0, 25)}: ${e.message?.substring(0, 60)}`);
        }
      }
    } else {
      console.log(`  ⚠ Folder not found: ${dp.folder.substring(dp.folder.length - 40)}`);
    }
    demoAssets.push(assets);
  }

  // 4) Create products via Java API
  console.log('\n📦 Creating products...');
  const PRODUCTS = [
    { titleEn: 'Premium Wireless Earbuds Pro', titleBn: 'প্রিমিয়াম ওয়্যারলেস ইয়ারবাডস প্রো', cat: 'electronics', desc: 'Crystal-clear ANC sound, 36h battery, IPX5.', descBn: 'ANC সাউন্ড, ৩৬ ঘণ্টা ব্যাটারি, IPX5।', retail: 4500, compare: 5500, imgKey: 'earbuds1' },
    { titleEn: 'Ultra-Slim Laptop 15.6" i7',   titleBn: 'আল্ট্রা-স্লিম ল্যাপটপ ১৫.৬" i7',   cat: 'electronics', desc: '12th Gen i7, 16GB, 512GB NVMe, FHD IPS.',       descBn: '১২তম জেন i7, ১৬জিবি, ৫১২জিবি NVMe।',  retail: 89000, compare: 105000, imgKey: 'laptop2' },
    { titleEn: 'Smart Watch Series 8',          titleBn: 'স্মার্ট ওয়াচ সিরিজ ৮',              cat: 'electronics', desc: 'AMOLED, HR, SpO2, GPS. 7-day battery.',       descBn: 'AMOLED, HR, SpO2, GPS। ৭ দিন ব্যাটারি।', retail: 8500, compare: 12000, imgKey: 'watch3' },
    { titleEn: 'Designer Silk Saree',           titleBn: 'ডিজাইনার সিল্ক শাড়ি',                cat: 'fashion',     desc: 'Banarasi silk with gold zari, blouse pc.',  descBn: 'বেনারসি সিল্ক, গোল্ড জরি, ব্লাউজ পিস।',  retail: 15000, compare: 22000, imgKey: 'saree4' },
    { titleEn: "Men's Premium Cotton Polo",     titleBn: 'পুরুষদের প্রিমিয়াম কটন পোলো',        cat: 'fashion',     desc: '100% Pima cotton, slim fit, 8 colors.',     descBn: '১০০% পিমা কটন, স্লিম ফিট, ৮ রঙ।',         retail: 2200, compare: 2800, imgKey: 'polo5' },
    { titleEn: 'Robot Vacuum Cleaner',          titleBn: 'রোবট ভ্যাকুয়াম ক্লিনার',             cat: 'home-garden', desc: '3000Pa suction, smart mapping, 180 min.',    descBn: '৩০০০Pa, স্মার্ট ম্যাপিং, ১৮০ মিনিট।',     retail: 35000, compare: 45000, imgKey: 'vacuum6' },
    { titleEn: 'Luxury Bedding Set (King)',     titleBn: 'লাক্সারি বেডিং সেট (কিং)',            cat: 'home-garden', desc: '1000TC Egyptian cotton duvet + sheets.',     descBn: '১০০০TC ইজিপশিয়ান কটন ডুভেট ও শীট।',       retail: 12000, compare: 16000, imgKey: 'bedding7' },
    { titleEn: 'Korean Skincare 10-Step Kit',   titleBn: 'কোরিয়ান স্কিনকেয়ার ১০-স্টেপ কিট',   cat: 'beauty-health', desc: 'Complete K-beauty routine, all skin types.',descBn: 'সম্পূর্ণ কে-বিউটি রুটিন, সব স্কিন টাইপ।', retail: 6500, compare: 9000, imgKey: 'skincare8' },
    { titleEn: 'Professional Yoga Mat Set',     titleBn: 'প্রফেশনাল ইয়োগা ম্যাট সেট',         cat: 'sports-outdoor', desc: 'Non-slip TPE 6mm + blocks + strap.',     descBn: 'নন-স্লিপ TPE ৬মিমি + ব্লক + স্ট্র্যাপ।',   retail: 3500, compare: 4500, imgKey: 'yoga9' },
    { titleEn: 'Bestseller Novel Bundle',       titleBn: 'বেস্টসেলার উপন্যাস বান্ডেল',          cat: 'books-stationery', desc: '5 top 2024 fiction novels, hardcover.',  descBn: '২০২৪-এর ৫টি শীর্ষ উপন্যাস, হার্ডকভার।',    retail: 2500, compare: 3500, imgKey: 'books10' },
    { titleEn: 'Bluetooth Portable Speaker',    titleBn: 'ব্লুটুথ পোর্টেবল স্পিকার',            cat: 'electronics', desc: '360° sound, IPX7, 24h battery.',            descBn: '৩৬০° সাউন্ড, IPX7, ২৪ ঘণ্টা ব্যাটারি।',     retail: 5500, compare: 7500, imgKey: 'speaker11' },
    { titleEn: 'Steel Water Bottle 1L',         titleBn: 'স্টিল ওয়াটার বোতল ১ লি.',             cat: 'sports-outdoor', desc: 'Vacuum insulated, hot 12h / cold 24h.',  descBn: 'ভ্যাকুয়াম ইনসুলেটেড, গরম ১২ঘ / ঠান্ডা ২৪ঘ।', retail: 1800, compare: 2500, imgKey: 'bottle12' },
  ];

  const productIds = [];
  const allProducts = []; // for orders

  // Create 12 stock products
  for (let i = 0; i < PRODUCTS.length; i++) {
    const p = PRODUCTS[i];
    const cid = catId[p.cat];
    if (!cid) { console.error(`  ✗ No leaf category for "${p.cat}"`); continue; }
    const imgUrl = cloudUrls[p.imgKey] || `https://picsum.photos/seed/${p.imgKey}/600/600`;
    const payload = {
      titleEn: p.titleEn, titleBn: p.titleBn,
      descriptionEn: p.desc, descriptionBn: p.descBn,
      categoryId: cid, status: 'active', stock: 50 + Math.floor(Math.random() * 400), moq: 1,
      isFeatured: i < 6, importSource: 'seed-presentation',
      ratingAvg: +(3.5 + Math.random() * 1.5).toFixed(2),
      reviewCount: Math.floor(10 + Math.random() * 150),
      popularityRank: i + 1,
      popularityLabelEn: i < 3 ? 'Trending' : i < 6 ? 'Popular' : 'New',
      popularityLabelBn: i < 3 ? 'ট্রেন্ডিং' : i < 6 ? 'জনপ্রিয়' : 'নতুন',
      assets: [
        { url: imgUrl, assetType: 'image', altEn: p.titleEn, altBn: p.titleBn, sortOrder: 0, isPrimary: true },
      ],
      pricing: [
        { customerType: 'retail', price: p.retail, compareAt: p.compare, sortOrder: 0 },
        { customerType: 'wholesale', price: Math.round(p.retail * 0.85), compareAt: p.retail, sortOrder: 1, tier1MinQty: 10, tier1Discount: 5 },
      ],
    };
    const r = await j(`${JAVA}/api/admin/products`, { method: 'POST', headers: auth, body: JSON.stringify(payload) });
    if (r.ok) {
      productIds.push(r.data.id);
      allProducts.push(p);
      console.log(`  ✓ ${p.titleEn} (${r.data.id})`);
    } else {
      console.error(`  ✗ ${p.titleEn}: ${r.status} ${JSON.stringify(r.data).substring(0, 120)}`);
    }
  }

  // Create 3 demo-folder products with real Cloudinary images+videos
  for (let i = 0; i < demoProducts.length; i++) {
    const dp = demoProducts[i];
    const assets = demoAssets[i];
    const cid = catId[dp.cat];
    if (!cid || assets.length === 0) { console.log(`  ⚠ Skipping ${dp.titleEn} (no cat or no assets)`); continue; }
    const payload = {
      titleEn: dp.titleEn, titleBn: dp.titleBn,
      descriptionEn: dp.desc, descriptionBn: dp.descBn,
      categoryId: cid, status: 'active', stock: 100 + Math.floor(Math.random() * 200), moq: 1,
      isFeatured: true, importSource: 'seed-presentation',
      ratingAvg: +(4.0 + Math.random()).toFixed(2),
      reviewCount: Math.floor(20 + Math.random() * 100),
      popularityRank: PRODUCTS.length + i + 1,
      popularityLabelEn: 'New', popularityLabelBn: 'নতুন',
      assets: assets.map((a, idx) => ({
        url: a.url, assetType: a.type, altEn: dp.titleEn, altBn: dp.titleBn,
        sortOrder: idx, isPrimary: idx === 0,
      })),
      pricing: [
        { customerType: 'retail', price: dp.retail, compareAt: dp.compare, sortOrder: 0 },
        { customerType: 'wholesale', price: Math.round(dp.retail * 0.85), compareAt: dp.retail, sortOrder: 1, tier1MinQty: 10, tier1Discount: 5 },
      ],
    };
    const r = await j(`${JAVA}/api/admin/products`, { method: 'POST', headers: auth, body: JSON.stringify(payload) });
    if (r.ok) {
      productIds.push(r.data.id);
      allProducts.push(dp);
      console.log(`  ✓ ${dp.titleEn} (${r.data.id}) [${assets.length} media]`);
    } else {
      console.error(`  ✗ ${dp.titleEn}: ${r.status} ${JSON.stringify(r.data).substring(0, 120)}`);
    }
  }

  // 5) Upload hero/banner images to Cloudinary + update site settings
  console.log('\n🎨 Uploading hero/banner images & updating site settings...');
  const heroImgs = [];
  for (const [name, url] of [
    ['hero-sale', 'https://images.unsplash.com/photo-1607082349566-187342175e2f?w=1400&h=500&fit=crop'],
    ['hero-new',  'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1400&h=500&fit=crop'],
    ['hero-ship', 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1400&h=500&fit=crop'],
  ]) {
    try {
      const r = await uploadUrlToCloudinary(url, 'banners', name, token);
      heroImgs.push(r.url);
      console.log(`  ✓ ${name}`);
    } catch (e) {
      heroImgs.push(`https://picsum.photos/seed/${name}/1400/500`);
      console.log(`  ⚠ ${name} fallback`);
    }
  }
  const bannerImgs = [];
  for (const [name, url] of [
    ['banner-tech',    'https://images.unsplash.com/photo-1518770660439-4636190af475?w=700&h=300&fit=crop'],
    ['banner-fashion', 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=700&h=300&fit=crop'],
  ]) {
    try {
      const r = await uploadUrlToCloudinary(url, 'banners', name, token);
      bannerImgs.push(r.url);
      console.log(`  ✓ ${name}`);
    } catch (e) {
      bannerImgs.push(`https://picsum.photos/seed/${name}/700/300`);
    }
  }

  const settingsPayload = {
    heroSlides: [
      { title: 'Mega Summer Sale', titleBn: 'মেগা সামার সেল', subtitle: 'Up to 60% off on Electronics & Fashion', subtitleBn: 'ইলেকট্রনিক্স ও ফ্যাশনে ৬০% পর্যন্ত ছাড়', image: heroImgs[0], cta: 'Shop Now', ctaBn: 'এখনই কিনুন', link: '/products', bgColor: '#0891b2' },
      { title: 'New Arrivals', titleBn: 'নতুন পণ্য', subtitle: 'Fresh picks for your home & lifestyle', subtitleBn: 'আপনার ঘর ও জীবনযাত্রার জন্য নতুন পছন্দ', image: heroImgs[1], cta: 'Explore', ctaBn: 'দেখুন', link: '/products', bgColor: '#7c3aed' },
      { title: 'Free Shipping ৳5000+', titleBn: '৳৫০০০+ এ বিনামূল্যে শিপিং', subtitle: 'Nationwide delivery 2-5 days', subtitleBn: 'সারা দেশে ২-৫ দিনে ডেলিভারি', image: heroImgs[2], cta: 'Start Shopping', ctaBn: 'শপিং শুরু', link: '/products', bgColor: '#059669' },
    ],
    productBanners: [
      { title: 'Tech Deals', titleBn: 'টেক ডিল', image: bannerImgs[0], link: '/products?category=electronics' },
      { title: 'Fashion Week', titleBn: 'ফ্যাশন সপ্তাহ', image: bannerImgs[1], link: '/products?category=fashion' },
    ],
    testimonials: [
      { name: 'Raihan Ahmed', text: 'Best prices and fastest delivery in Bangladesh!', rating: 5 },
      { name: 'Tasnia Farin', text: 'Great quality products. Excellent customer support.', rating: 5 },
      { name: 'Sakib Hasan', text: 'Amazing wholesale prices for my shop!', rating: 4 },
    ],
    trustBadges: [
      { icon: 'lock', title: 'Secure Payment', titleBn: 'নিরাপদ পেমেন্ট' },
      { icon: 'truck', title: 'Fast Delivery', titleBn: 'দ্রুত ডেলিভারি' },
      { icon: 'refresh', title: 'Easy Returns', titleBn: 'সহজ রিটার্ন' },
      { icon: 'shield', title: 'Genuine Products', titleBn: 'আসল পণ্য' },
    ],
    featuredProductIds: productIds.slice(0, 6),
    bestDealsProductIds: productIds.slice(2, 8),
    newArrivalsProductIds: productIds.slice(8),
    defaultBannerRotationMs: 5000,
    supportEmail: 'support@oceanbazar.com.bd',
    supportPhone: '+880-1700-000000',
    facebookUrl: 'https://facebook.com/oceanbazar',
    instagramUrl: 'https://instagram.com/oceanbazar',
  };
  const setR = await j(`${JAVA}/api/admin/global-settings`, { method: 'PUT', headers: auth, body: JSON.stringify(settingsPayload) });
  console.log(setR.ok ? '  ✓ Site settings updated' : `  ✗ Settings: ${setR.status} ${JSON.stringify(setR.data).substring(0, 200)}`);

  // 6) Demo customer
  console.log('\n👤 Ensuring demo customer...');
  let custR = await j(`${BFF}/api/auth/register`, { method: 'POST', body: JSON.stringify({ name: 'Demo Customer', email: 'demo@oceanbazar.com', phone: '+8801712345678', password: 'Demo@1234' }) });
  if (!custR.ok) {
    custR = await j(`${BFF}/api/auth/login`, { method: 'POST', body: JSON.stringify({ identifier: 'demo@oceanbazar.com', password: 'Demo@1234' }) });
  }
  console.log(custR.ok ? '  ✓ Demo customer ready' : '  ⚠ Customer auth issue (orders via DB)');

  // 7) Sample orders via direct DB insert
  console.log('\n🛒 Inserting sample orders...');
  try {
    const custId = psql("SELECT id FROM users WHERE email='demo@oceanbazar.com' LIMIT 1");
    if (custId && productIds.length >= 5) {
      const statuses = ['delivered', 'shipped', 'processing', 'confirmed', 'pending'];
      for (let i = 0; i < 5; i++) {
        const ordId = (Date.now().toString(36) + i).toUpperCase().slice(-8).padStart(8, '0');
        const orderNum = `ORD-2024-${10001 + i}`;
        const qty = 1 + i % 3;
        const unitPrice = allProducts[i].retail;
        const lineTotal = unitPrice * qty;
        const shipping = 60;
        const titleEsc = allProducts[i].titleEn.replace(/'/g, "''");
        psql(`INSERT INTO orders (id, order_number, user_id, status, customer_type, subtotal, discount, gst, shipping_fee, service_fee, ob_points_used, ob_discount, total, payment_method, payment_status, created_at, updated_at) VALUES ('${ordId}', '${orderNum}', '${custId}', '${statuses[i]}', 'retail', ${lineTotal}, 0, 0, ${shipping}, 0, 0, 0, ${lineTotal + shipping}, 'cod', 'paid', NOW() - interval '${10 - i * 2} days', NOW() - interval '${8 - i * 2} days') ON CONFLICT DO NOTHING`);
        psql(`INSERT INTO order_items (order_id, product_id, product_title, unit_price, quantity, line_total, discount_pct) VALUES ('${ordId}', '${productIds[i]}', '${titleEsc}', ${unitPrice}, ${qty}, ${lineTotal}, 0) ON CONFLICT DO NOTHING`);
        console.log(`  ✓ ${orderNum} — ${statuses[i]} (৳${lineTotal + shipping})`);
      }
    } else {
      console.log('  ⚠ No customer or not enough products for orders');
    }
  } catch (e) {
    console.log(`  ⚠ Order error: ${e.message?.substring(0, 150)}`);
  }

  // Summary
  console.log('\n' + '═'.repeat(50));
  console.log('✅ SEED COMPLETE');
  console.log(`   Products: ${productIds.length} (${PRODUCTS.length} stock + ${demoProducts.length} demo-folder)`);
  console.log(`   Media: All uploaded to Cloudinary (${CLOUD_NAME})`);
  console.log('   Hero slides: 3 | Banners: 2 | Testimonials: 3');
  console.log('   Orders: 5 sample');
  console.log('   Admin: superadmin / Admin@123');
  console.log('   Customer: demo@oceanbazar.com / Demo@1234');
  console.log('═'.repeat(50));
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
