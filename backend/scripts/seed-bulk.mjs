/**
 * OceanBazar Bulk Seed Script
 * Creates: 8 root categories → 3 subcategories each → 3 leaf categories each (104 total)
 *          25 brands, ~600 products with Cloudinary images + videos, pricing tiers
 *
 * Usage (from backend/ directory):
 *   node scripts/seed-bulk.mjs
 *
 * Requires DATABASE_URL in .env (auto-loaded).
 */

import { createRequire } from 'module';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Load .env ─────────────────────────────────────────────────────────────────
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] ??= m[2].trim().replace(/^"|"$/g, '');
  }
}

const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');
const { v2: cloudinary } = require('cloudinary');

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

// ── Cloudinary config ─────────────────────────────────────────────────────────
cloudinary.config({
  cloud_name: 'dmtafp1fi',
  api_key:    '487252925521551',
  api_secret: '_rHB9A85bxjgZqzcNZb0ja9vBk8',
  secure: true,
});

// ── Helpers ───────────────────────────────────────────────────────────────────
const genId = () => crypto.randomBytes(4).toString('hex').toUpperCase();
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const rnd = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/** Upload a URL to Cloudinary; reuse if public_id already exists */
async function cldUpload(sourceUrl, publicId, resourceType = 'image') {
  try {
    const result = await cloudinary.uploader.upload(sourceUrl, {
      public_id: publicId,
      folder: 'oceanbazar/seed',
      overwrite: false,
      resource_type: resourceType,
      transformation: resourceType === 'image'
        ? [{ width: 800, height: 800, crop: 'fill', quality: 'auto', fetch_format: 'auto' }]
        : [],
    });
    return result.secure_url;
  } catch (e) {
    // If already exists (overwrite:false), reconstruct URL
    if (e.error?.http_code === 409 || String(e).includes('already exists')) {
      return `https://res.cloudinary.com/dmtafp1fi/${resourceType}/upload/oceanbazar/seed/${publicId}`;
    }
    console.warn(`  ⚠ Cloudinary upload failed for ${publicId}: ${e.message ?? e}`);
    return `https://res.cloudinary.com/dmtafp1fi/${resourceType}/upload/oceanbazar/seed/${publicId}`;
  }
}

// ── Image sources (picsum — stable by seed keyword) ───────────────────────────
const DOMAIN_IMG_SEEDS = {
  electronics: ['gadget-pro','smart-device','tech-gear','digital-hub','circuit-board'],
  fashion:     ['street-wear','modern-fashion','urban-style','classic-look','trend-set'],
  home:        ['cozy-home','interior-design','living-room','kitchen-tools','home-decor'],
  beauty:      ['skincare-glow','hair-care','cosmetics','wellness-kit','beauty-kit'],
  sports:      ['fitness-gear','outdoor-sport','gym-equipment','running-shoes','sports-play'],
  food:        ['fresh-produce','spice-blend','grocery-pack','healthy-food','organic-eats'],
  books:       ['book-shelf','reading-nook','study-desk','library-light','learn-today'],
  toys:        ['toy-play','kids-fun','board-game','puzzle-fun','outdoor-play'],
};

const DOMAIN_VIDEO_SEEDS = {
  electronics: 'https://res.cloudinary.com/dmtafp1fi/video/upload/v1/samples/elephants',
  fashion:     'https://res.cloudinary.com/dmtafp1fi/video/upload/v1/samples/elephants',
  home:        'https://res.cloudinary.com/dmtafp1fi/video/upload/v1/samples/elephants',
  beauty:      'https://res.cloudinary.com/dmtafp1fi/video/upload/v1/samples/elephants',
  sports:      'https://res.cloudinary.com/dmtafp1fi/video/upload/v1/samples/elephants',
  food:        'https://res.cloudinary.com/dmtafp1fi/video/upload/v1/samples/elephants',
  books:       'https://res.cloudinary.com/dmtafp1fi/video/upload/v1/samples/elephants',
  toys:        'https://res.cloudinary.com/dmtafp1fi/video/upload/v1/samples/elephants',
};

// ── Category tree ─────────────────────────────────────────────────────────────
// Format: [nameEn, nameBn, icon, domain, [[subNameEn, subNameBn, [[leafEn, leafBn], ...]], ...]]
const CATEGORY_TREE = [
  ['Electronics', 'ইলেকট্রনিক্স', '📱', 'electronics', [
    ['Mobile & Tablets', 'মোবাইল ও ট্যাবলেট', [
      ['Smartphones', 'স্মার্টফোন'],
      ['Tablets', 'ট্যাবলেট'],
      ['Feature Phones', 'ফিচার ফোন'],
    ]],
    ['Computers', 'কম্পিউটার', [
      ['Laptops', 'ল্যাপটপ'],
      ['Desktop PCs', 'ডেস্কটপ পিসি'],
      ['PC Accessories', 'পিসি আনুষাঙ্গিক'],
    ]],
    ['Audio & TV', 'অডিও ও টিভি', [
      ['Headphones & Earphones', 'হেডফোন ও ইয়ারফোন'],
      ['Speakers', 'স্পিকার'],
      ['TVs & Monitors', 'টিভি ও মনিটর'],
    ]],
  ]],
  ['Fashion', 'ফ্যাশন', '👗', 'fashion', [
    ["Men's Clothing", 'পুরুষের পোশাক', [
      ['T-Shirts & Tops', 'টি-শার্ট ও টপস'],
      ['Pants & Jeans', 'প্যান্ট ও জিন্স'],
      ['Traditional Wear', 'ঐতিহ্যবাহী পোশাক'],
    ]],
    ["Women's Clothing", 'মহিলাদের পোশাক', [
      ['Dresses', 'ড্রেস'],
      ['Tops & Blouses', 'টপস ও ব্লাউজ'],
      ['Sarees & Kurtis', 'শাড়ি ও কুর্তি'],
    ]],
    ["Kids' Fashion", 'শিশুদের পোশাক', [
      ['Boys Clothing', 'ছেলেদের পোশাক'],
      ['Girls Clothing', 'মেয়েদের পোশাক'],
      ['Baby Wear', 'বেবি পোশাক'],
    ]],
  ]],
  ['Home & Living', 'ঘর ও জীবন', '🏠', 'home', [
    ['Furniture', 'আসবাবপত্র', [
      ['Beds & Mattresses', 'বিছানা ও ম্যাট্রেস'],
      ['Sofas & Seating', 'সোফা ও আসন'],
      ['Storage & Shelving', 'স্টোরেজ ও তাক'],
    ]],
    ['Kitchen', 'রান্নাঘর', [
      ['Cookware', 'রান্নার পাত্র'],
      ['Kitchen Appliances', 'রান্নাঘর যন্ত্রপাতি'],
      ['Dining & Tableware', 'ডাইনিং ও টেবিলওয়্যার'],
    ]],
    ['Home Decor', 'হোম ডেকোর', [
      ['Wall Decor', 'দেওয়াল সজ্জা'],
      ['Lighting', 'আলোক সজ্জা'],
      ['Rugs & Curtains', 'কার্পেট ও পর্দা'],
    ]],
  ]],
  ['Beauty & Health', 'সৌন্দর্য ও স্বাস্থ্য', '💄', 'beauty', [
    ['Skincare', 'স্কিনকেয়ার', [
      ['Face Care', 'মুখের যত্ন'],
      ['Body Care', 'শরীরের যত্ন'],
      ['Sun Care', 'সান কেয়ার'],
    ]],
    ['Haircare', 'চুলের যত্ন', [
      ['Shampoo & Conditioner', 'শ্যাম্পু ও কন্ডিশনার'],
      ['Hair Tools', 'চুলের সরঞ্জাম'],
      ['Hair Color', 'চুলের রং'],
    ]],
    ['Health & Wellness', 'স্বাস্থ্য ও সুস্থতা', [
      ['Vitamins & Supplements', 'ভিটামিন ও সাপ্লিমেন্ট'],
      ['Fitness Equipment', 'ফিটনেস সরঞ্জাম'],
      ['Medical Devices', 'চিকিৎসা যন্ত্র'],
    ]],
  ]],
  ['Sports & Outdoors', 'খেলাধুলা ও আউটডোর', '⚽', 'sports', [
    ['Team Sports', 'দলগত খেলা', [
      ['Cricket', 'ক্রিকেট'],
      ['Football', 'ফুটবল'],
      ['Badminton', 'ব্যাডমিন্টন'],
    ]],
    ['Fitness', 'ফিটনেস', [
      ['Gym Equipment', 'জিম সরঞ্জাম'],
      ['Yoga & Pilates', 'যোগ ও পিলেটস'],
      ['Running Gear', 'রানিং গিয়ার'],
    ]],
    ['Outdoor', 'আউটডোর', [
      ['Camping', 'ক্যাম্পিং'],
      ['Cycling', 'সাইক্লিং'],
      ['Fishing', 'মাছ ধরা'],
    ]],
  ]],
  ['Food & Grocery', 'খাদ্য ও মুদিখানা', '🛒', 'food', [
    ['Rice & Grains', 'চাল ও শস্য', [
      ['Rice', 'চাল'],
      ['Flour & Bread', 'আটা ও রুটি'],
      ['Cereals & Oats', 'সিরিয়াল ও ওটস'],
    ]],
    ['Spices & Condiments', 'মশলা ও কন্ডিমেন্ট', [
      ['Spices', 'মশলা'],
      ['Oils & Vinegar', 'তেল ও ভিনেগার'],
      ['Sauces & Dips', 'সস ও ডিপ'],
    ]],
    ['Snacks & Beverages', 'স্ন্যাকস ও পানীয়', [
      ['Chips & Snacks', 'চিপস ও স্ন্যাকস'],
      ['Tea & Coffee', 'চা ও কফি'],
      ['Juices & Drinks', 'জুস ও পানীয়'],
    ]],
  ]],
  ['Books & Education', 'বই ও শিক্ষা', '📚', 'books', [
    ['Academic', 'একাডেমিক', [
      ['Textbooks', 'পাঠ্যপুস্তক'],
      ['Reference Books', 'রেফারেন্স বই'],
      ["Children's Education", 'শিশু শিক্ষা'],
    ]],
    ['Literature', 'সাহিত্য', [
      ['Bangla Literature', 'বাংলা সাহিত্য'],
      ['English Fiction', 'ইংরেজি কল্পকাহিনী'],
      ['Self-Help', 'স্ব-সহায়তা'],
    ]],
    ['Digital Learning', 'ডিজিটাল শিক্ষা', [
      ['Online Courses', 'অনলাইন কোর্স'],
      ['Software & Apps', 'সফটওয়্যার ও অ্যাপ'],
      ['E-Learning Materials', 'ই-লার্নিং উপকরণ'],
    ]],
  ]],
  ['Toys & Games', 'খেলনা ও গেমস', '🎮', 'toys', [
    ['Kids Toys', 'শিশু খেলনা', [
      ['Infant & Toddler', 'শিশু ও ছোট্ট'],
      ['Action Figures', 'অ্যাকশন ফিগার'],
      ['Educational Toys', 'শিক্ষামূলক খেলনা'],
    ]],
    ['Games & Puzzles', 'গেমস ও পাজল', [
      ['Board Games', 'বোর্ড গেমস'],
      ['Card Games', 'কার্ড গেমস'],
      ['Puzzles', 'পাজল'],
    ]],
    ['Outdoor Play', 'আউটডোর খেলা', [
      ['Sports Toys', 'স্পোর্টস খেলনা'],
      ['Ride-Ons', 'রাইড-অন'],
      ['Playsets', 'প্লেসেট'],
    ]],
  ]],
];

// ── Brands ────────────────────────────────────────────────────────────────────
const BRANDS = [
  { nameEn: 'Samsung',   nameBn: 'স্যামসাং',   slug: 'samsung',   domains: ['electronics'] },
  { nameEn: 'Apple',     nameBn: 'অ্যাপল',     slug: 'apple',     domains: ['electronics'] },
  { nameEn: 'Xiaomi',    nameBn: 'শাওমি',       slug: 'xiaomi',    domains: ['electronics'] },
  { nameEn: 'Sony',      nameBn: 'সনি',         slug: 'sony',      domains: ['electronics'] },
  { nameEn: 'Walton',    nameBn: 'ওয়ালটন',     slug: 'walton',    domains: ['electronics', 'home'] },
  { nameEn: 'Symphony',  nameBn: 'সিম্ফনি',     slug: 'symphony',  domains: ['electronics'] },
  { nameEn: 'Dell',      nameBn: 'ডেল',         slug: 'dell',      domains: ['electronics'] },
  { nameEn: 'HP',        nameBn: 'এইচপি',       slug: 'hp',        domains: ['electronics'] },
  { nameEn: 'Lenovo',    nameBn: 'লেনোভো',     slug: 'lenovo',    domains: ['electronics'] },
  { nameEn: 'Asus',      nameBn: 'আসুস',        slug: 'asus',      domains: ['electronics'] },
  { nameEn: 'Nike',      nameBn: 'নাইকি',       slug: 'nike',      domains: ['fashion', 'sports'] },
  { nameEn: 'Adidas',    nameBn: 'আডিডাস',     slug: 'adidas',    domains: ['fashion', 'sports'] },
  { nameEn: 'Puma',      nameBn: 'পুমা',        slug: 'puma',      domains: ['fashion', 'sports'] },
  { nameEn: 'Aarong',    nameBn: 'আড়ং',         slug: 'aarong',    domains: ['fashion'] },
  { nameEn: 'Yellow',    nameBn: 'ইয়েলো',       slug: 'yellow',    domains: ['fashion'] },
  { nameEn: 'RFL',       nameBn: 'আরএফএল',     slug: 'rfl',       domains: ['home', 'food'] },
  { nameEn: 'Bata',      nameBn: 'বাটা',        slug: 'bata',      domains: ['fashion'] },
  { nameEn: "L'Oreal",   nameBn: 'লোরিয়াল',    slug: 'loreal',    domains: ['beauty'] },
  { nameEn: 'Dove',      nameBn: 'ডাভ',         slug: 'dove',      domains: ['beauty'] },
  { nameEn: 'Marico',    nameBn: 'মেরিকো',      slug: 'marico',    domains: ['beauty'] },
  { nameEn: 'Pran',      nameBn: 'প্রাণ',        slug: 'pran',      domains: ['food'] },
  { nameEn: 'Nestle',    nameBn: 'নেসলে',       slug: 'nestle',    domains: ['food'] },
  { nameEn: 'ACI',       nameBn: 'এসিআই',       slug: 'aci',       domains: ['food', 'beauty'] },
  { nameEn: 'Nirapad',   nameBn: 'নিরাপদ',      slug: 'nirapad',   domains: ['books'] },
  { nameEn: 'Mattel',    nameBn: 'ম্যাটেল',     slug: 'mattel',    domains: ['toys'] },
];

// ── Product name lists per domain ─────────────────────────────────────────────
const PRODUCTS_BY_DOMAIN = {
  electronics: [
    ['Wireless Earbuds Pro', 'ওয়্যারলেস ইয়ারবাড প্রো', 1200, 4500],
    ['Bluetooth Speaker 20W', 'ব্লুটুথ স্পিকার ২০W', 800, 3500],
    ['Power Bank 20000mAh', 'পাওয়ার ব্যাংক ২০০০০mAh', 1500, 4000],
    ['USB-C Hub 7-in-1', 'ইউএসবি-সি হাব ৭-ইন-১', 900, 3200],
    ['Smart Watch Series 7', 'স্মার্ট ওয়াচ সিরিজ ৭', 2500, 8000],
    ['LED Desk Lamp USB', 'এলইডি ডেস্ক ল্যাম্প ইউএসবি', 600, 2200],
    ['Portable SSD 1TB', 'পোর্টেবল এসএসডি ১টিবি', 3500, 9000],
    ['HD Webcam 1080p', 'এইচডি ওয়েবক্যাম ১০৮০পি', 1200, 4500],
    ['Mechanical Keyboard', 'মেকানিক্যাল কীবোর্ড', 2000, 6500],
    ['Gaming Mouse RGB', 'গেমিং মাউস আরজিবি', 1100, 4000],
    ['Monitor Stand Ergonomic', 'মনিটর স্ট্যান্ড আর্গোনমিক', 700, 2500],
    ['HDMI Cable 4K 2m', 'এইচডিএমআই কেবল ৪K ২মি', 300, 1200],
  ],
  fashion: [
    ['Classic Cotton T-Shirt', 'ক্লাসিক কটন টি-শার্ট', 250, 800],
    ['Slim Fit Jeans', 'স্লিম ফিট জিন্স', 800, 2500],
    ['Formal Dress Shirt', 'ফর্মাল ড্রেস শার্ট', 600, 1800],
    ['Summer Floral Dress', 'গ্রীষ্মকালীন ফ্লোরাল ড্রেস', 700, 2200],
    ['Denim Jacket', 'ডেনিম জ্যাকেট', 1500, 4500],
    ['Jogger Pants', 'জগার প্যান্ট', 450, 1500],
    ['Polo Shirt Premium', 'পোলো শার্ট প্রিমিয়াম', 500, 1600],
    ['Maxi Skirt Printed', 'ম্যাক্সি স্কার্ট প্রিন্টেড', 650, 2000],
    ['Wool Sweater', 'উল সোয়েটার', 1200, 3500],
    ['Traditional Kurta', 'ঐতিহ্যবাহী কুর্তা', 800, 2500],
    ['Women Saree Cotton', 'মহিলা শাড়ি কটন', 1200, 4000],
    ['Kids Party Dress', 'শিশু পার্টি ড্রেস', 600, 2000],
  ],
  home: [
    ['Memory Foam Pillow', 'মেমরি ফোম বালিশ', 800, 2500],
    ['Bed Sheet Set Queen', 'বেড শীট সেট কুইন', 1200, 3500],
    ['Throw Blanket Fleece', 'থ্রো ব্লাংকেট ফ্লিস', 900, 2800],
    ['Table Lamp Modern', 'টেবিল ল্যাম্প মডার্ন', 600, 2000],
    ['Kitchen Knife Set', 'কিচেন নাইফ সেট', 1500, 4500],
    ['Cutting Board Bamboo', 'কাটিং বোর্ড বাম্বু', 400, 1400],
    ['Stainless Steel Pot Set', 'স্টেইনলেস স্টিল পট সেট', 2000, 6000],
    ['Non-Stick Fry Pan', 'নন-স্টিক ফ্রাই প্যান', 800, 2500],
    ['Glass Container Set', 'গ্লাস কন্টেইনার সেট', 700, 2200],
    ['Wall Clock Wooden', 'ওয়াল ক্লক উডেন', 500, 1800],
    ['Photo Frame Set 3pc', 'ফটো ফ্রেম সেট ৩পিস', 600, 2000],
    ['Shower Curtain Printed', 'শাওয়ার কার্টেন প্রিন্টেড', 450, 1600],
  ],
  beauty: [
    ['Vitamin C Face Serum', 'ভিটামিন সি ফেস সিরাম', 600, 2200],
    ['Moisturizing Face Cream', 'ময়েশ্চারাইজিং ফেস ক্রিম', 450, 1600],
    ['Sunscreen SPF 50+', 'সানস্ক্রিন এসপিএফ ৫০+', 500, 1800],
    ['Shampoo Argan Oil 400ml', 'শ্যাম্পু আর্গান অয়েল ৪০০মিলি', 350, 1200],
    ['Hair Conditioner Deep', 'হেয়ার কন্ডিশনার ডিপ', 300, 1100],
    ['Hair Straightener Pro', 'হেয়ার স্ট্রেইটনার প্রো', 1200, 4000],
    ['Body Lotion Rose 250ml', 'বডি লোশন রোজ ২৫০মিলি', 350, 1200],
    ['Facial Cleanser Gentle', 'ফেসিয়াল ক্লেনজার জেন্টেল', 400, 1400],
    ['Lip Balm Set 6pc', 'লিপ বাম সেট ৬পিস', 250, 800],
    ['Multivitamin 60 Tablets', 'মাল্টিভিটামিন ৬০ ট্যাবলেট', 700, 2500],
    ['Blood Pressure Monitor', 'রক্তচাপ মনিটর', 1500, 5000],
    ['Resistance Bands Set', 'রেজিস্ট্যান্স ব্যান্ড সেট', 600, 2200],
  ],
  sports: [
    ['Yoga Mat Premium 6mm', 'যোগ মাট প্রিমিয়াম ৬মিমি', 800, 2500],
    ['Resistance Bands 5-Set', 'রেজিস্ট্যান্স ব্যান্ড ৫-সেট', 600, 2000],
    ['Cricket Bat English Willow', 'ক্রিকেট ব্যাট ইংলিশ উইলো', 2500, 8000],
    ['Football Training', 'ফুটবল ট্রেনিং', 800, 2500],
    ['Badminton Set 4-Player', 'ব্যাডমিন্টন সেট ৪-প্লেয়ার', 700, 2200],
    ['Dumbbells Pair 5kg', 'ডাম্বেলস পেয়ার ৫কেজি', 1200, 3800],
    ['Jump Rope Speed', 'জাম্প রোপ স্পিড', 300, 1100],
    ['Boxing Gloves 10oz', 'বক্সিং গ্লাভস ১০oz', 1500, 4500],
    ['Cycling Helmet Safety', 'সাইক্লিং হেলমেট সেফটি', 900, 3000],
    ['Camping Tent 4-Person', 'ক্যাম্পিং তাঁবু ৪-জন', 3500, 10000],
    ['Fishing Rod Telescopic', 'ফিশিং রড টেলিস্কোপিক', 800, 2800],
    ['Running Shoes Cushion', 'রানিং শুজ কুশন', 2000, 6500],
  ],
  food: [
    ['Basmati Rice Premium 5kg', 'বাসমতি চাল প্রিমিয়াম ৫কেজি', 450, 1500],
    ['Mustard Oil Pure 1L', 'সরিষার তেল খাঁটি ১লি', 280, 950],
    ['Soybean Oil 5L', 'সয়াবিন তেল ৫লি', 650, 2200],
    ['Turmeric Powder 200g', 'হলুদ গুড়া ২০০গ্রাম', 120, 450],
    ['Garam Masala 100g', 'গরম মশলা ১০০গ্রাম', 150, 550],
    ['Pure Honey 500g', 'খাঁটি মধু ৫০০গ্রাম', 600, 2000],
    ['Green Tea Bags 25pc', 'গ্রিন টি ব্যাগ ২৫পিস', 200, 700],
    ['Oats Premium 500g', 'ওটস প্রিমিয়াম ৫০০গ্রাম', 250, 850],
    ['Canned Tuna 160g', 'ক্যানড টুনা ১৬০গ্রাম', 180, 650],
    ['Cashew Nuts 250g', 'কাজু বাদাম ২৫০গ্রাম', 450, 1500],
    ['Dark Chocolate 100g', 'ডার্ক চকোলেট ১০০গ্রাম', 250, 850],
    ['Instant Noodles 10-Pack', 'ইনস্ট্যান্ট নুডলস ১০-প্যাক', 200, 700],
  ],
  books: [
    ['Clean Code - Robert Martin', 'ক্লিন কোড - রবার্ট মার্টিন', 800, 2500],
    ['Rich Dad Poor Dad', 'রিচ ড্যাড পুওর ড্যাড', 600, 1800],
    ['Atomic Habits', 'অ্যাটমিক হ্যাবিটস', 700, 2200],
    ['Python Programming', 'পাইথন প্রোগ্রামিং', 900, 2800],
    ['Design Patterns', 'ডিজাইন প্যাটার্ন', 1000, 3000],
    ['System Design Interview', 'সিস্টেম ডিজাইন ইন্টারভিউ', 1200, 3500],
    ['Bangla Grammar Advanced', 'বাংলা ব্যাকরণ উচ্চতর', 300, 1000],
    ['HSC Physics Guide', 'এইচএসসি পদার্থবিজ্ঞান গাইড', 400, 1200],
    ['SSC Math Practice', 'এসএসসি গণিত অনুশীলন', 350, 1100],
    ['The Alchemist', 'দ্য অ্যালকেমিস্ট', 500, 1600],
    ['Psychology of Money', 'মানি সাইকোলজি', 650, 2000],
    ['English Spoken Course', 'ইংরেজি স্পোকেন কোর্স', 550, 1800],
  ],
  toys: [
    ['LEGO Classic Bricks 500pc', 'লেগো ক্লাসিক ব্রিকস ৫০০পিস', 1500, 5000],
    ['Remote Control Car', 'রিমোট কন্ট্রোল কার', 1200, 4000],
    ['Board Game Monopoly', 'বোর্ড গেম মনোপলি', 800, 2500],
    ['Puzzle 1000 Pieces', 'পাজল ১০০০ পিস', 600, 2000],
    ['Baby Rattles Set', 'বেবি র‍্যাটেলস সেট', 350, 1200],
    ['Action Figure Set 5pc', 'অ্যাকশন ফিগার সেট ৫পিস', 700, 2400],
    ['Educational Abacus', 'শিক্ষামূলক অ্যাবাকাস', 400, 1400],
    ['Card Game UNO', 'কার্ড গেম UNO', 300, 1000],
    ['Toy Kitchen Set', 'টয় কিচেন সেট', 900, 3000],
    ['Tricycle Kids', 'ট্রাইসাইকেল কিডস', 2500, 8000],
    ['Playmat Activity', 'প্লেম্যাট অ্যাক্টিভিটি', 800, 2800],
    ['Sports Toy Set', 'স্পোর্টস টয় সেট', 600, 2000],
  ],
};

// ── Brand logo upload ─────────────────────────────────────────────────────────
async function uploadBrandLogos() {
  const logos = {};
  const brandLogoSeeds = {
    samsung: 'brand-samsung', apple: 'brand-apple', xiaomi: 'brand-xiaomi',
    sony: 'brand-sony', walton: 'brand-walton', symphony: 'brand-symphony',
    dell: 'brand-dell', hp: 'brand-hp', lenovo: 'brand-lenovo', asus: 'brand-asus',
    nike: 'brand-nike', adidas: 'brand-adidas', puma: 'brand-puma',
    aarong: 'brand-aarong', yellow: 'brand-yellow', rfl: 'brand-rfl',
    bata: 'brand-bata', loreal: 'brand-loreal', dove: 'brand-dove',
    marico: 'brand-marico', pran: 'brand-pran', nestle: 'brand-nestle',
    aci: 'brand-aci', nirapad: 'brand-nirapad', mattel: 'brand-mattel',
  };
  console.log('  📤 Uploading brand logos to Cloudinary...');
  for (const [brandSlug, seed] of Object.entries(brandLogoSeeds)) {
    const url = `https://picsum.photos/seed/${seed}/200/200`;
    logos[brandSlug] = await cldUpload(url, `logo_${brandSlug}`, 'image');
  }
  return logos;
}

// ── Domain image upload ───────────────────────────────────────────────────────
async function uploadDomainImages() {
  const domainImgs = {};
  const domainVideos = {};
  console.log('  📤 Uploading product images to Cloudinary...');
  for (const [domain, seeds] of Object.entries(DOMAIN_IMG_SEEDS)) {
    domainImgs[domain] = [];
    for (let i = 0; i < seeds.length; i++) {
      const url = `https://picsum.photos/seed/${seeds[i]}/800/800`;
      const pid = `prod_${domain}_${i}`;
      const cldUrl = await cldUpload(url, pid, 'image');
      domainImgs[domain].push(cldUrl);
    }
    // Upload video (1 per domain, use sample)
    const vidPid = `vid_${domain}`;
    const sampleVideo = 'https://res.cloudinary.com/dmtafp1fi/video/upload/v1/samples/elephants';
    // Just reference the sample video directly instead of re-uploading
    domainVideos[domain] = `https://res.cloudinary.com/dmtafp1fi/video/upload/v1/samples/elephants`;
    console.log(`    ✓ ${domain}: ${domainImgs[domain].length} images`);
  }
  return { domainImgs, domainVideos };
}

// ── Seed categories ───────────────────────────────────────────────────────────
async function seedCategories() {
  console.log('  🗂  Seeding categories...');
  const leafIds = {}; // domain -> [categoryId, ...]
  let totalCats = 0;

  for (const [rootEn, rootBn, icon, domain, subcats] of CATEGORY_TREE) {
    const rootSlug = slug(rootEn);
    const rootId = genId();

    // Upsert root
    await prisma.category.upsert({
      where: { slug: rootSlug },
      create: { id: rootId, nameEn: rootEn, nameBn: rootBn, slug: rootSlug, icon, depth: 0, path: rootSlug, is_leaf: false, sortOrder: totalCats },
      update: { nameEn: rootEn, nameBn: rootBn, icon, is_leaf: false },
    });
    const root = await prisma.category.findUnique({ where: { slug: rootSlug } });
    leafIds[domain] = [];
    totalCats++;

    for (let si = 0; si < subcats.length; si++) {
      const [subEn, subBn, leaves] = subcats[si];
      const subSlug = slug(`${rootSlug}-${subEn}`);
      const subId = genId();

      await prisma.category.upsert({
        where: { slug: subSlug },
        create: { id: subId, parentId: root.id, nameEn: subEn, nameBn: subBn, slug: subSlug, depth: 1, path: `${rootSlug}/${subSlug}`, is_leaf: false, sortOrder: si },
        update: { nameEn: subEn, nameBn: subBn, is_leaf: false, parentId: root.id },
      });
      const sub = await prisma.category.findUnique({ where: { slug: subSlug } });
      totalCats++;

      for (let li = 0; li < leaves.length; li++) {
        const [leafEn, leafBn] = leaves[li];
        const leafSlug = slug(`${subSlug}-${leafEn}`);
        const leafId = genId();
        await prisma.category.upsert({
          where: { slug: leafSlug },
          create: { id: leafId, parentId: sub.id, nameEn: leafEn, nameBn: leafBn, slug: leafSlug, depth: 2, path: `${rootSlug}/${subSlug}/${leafSlug}`, is_leaf: true, sortOrder: li },
          update: { nameEn: leafEn, nameBn: leafBn, is_leaf: true, parentId: sub.id },
        });
        const leaf = await prisma.category.findUnique({ where: { slug: leafSlug } });
        leafIds[domain].push(leaf.id);
        totalCats++;
      }
    }
    console.log(`    ✓ ${rootEn} subtree created`);
  }
  console.log(`  ✓ ${totalCats} categories total`);
  return leafIds;
}

// ── Seed brands ───────────────────────────────────────────────────────────────
async function seedBrands(brandLogos) {
  console.log('  🏷  Seeding brands...');
  const brandMap = {}; // slug -> { id, domains }
  for (let i = 0; i < BRANDS.length; i++) {
    const b = BRANDS[i];
    const existing = await prisma.brand.findUnique({ where: { slug: b.slug } });
    const id = existing?.id ?? genId();
    await prisma.brand.upsert({
      where: { slug: b.slug },
      create: { id, nameEn: b.nameEn, nameBn: b.nameBn, slug: b.slug, logoUrl: brandLogos[b.slug] ?? null, active: true, sortOrder: i },
      update: { nameEn: b.nameEn, nameBn: b.nameBn, logoUrl: brandLogos[b.slug] ?? null },
    });
    const saved = await prisma.brand.findUnique({ where: { slug: b.slug } });
    brandMap[b.slug] = { id: saved.id, domains: b.domains };
  }
  console.log(`  ✓ ${BRANDS.length} brands`);
  return brandMap;
}

// ── Seed products ─────────────────────────────────────────────────────────────
async function seedProducts(leafIds, brandMap, domainImgs, domainVideos) {
  console.log('  📦 Seeding products...');
  let totalProds = 0;

  for (const [domain, catIds] of Object.entries(leafIds)) {
    const prodList = PRODUCTS_BY_DOMAIN[domain];
    if (!prodList || catIds.length === 0) continue;

    // Brands for this domain
    const domainBrands = Object.entries(brandMap)
      .filter(([, v]) => v.domains.includes(domain))
      .map(([, v]) => v.id);

    const imgs = domainImgs[domain] ?? [];

    for (const catId of catIds) {
      for (let pi = 0; pi < prodList.length; pi++) {
        const [titleEn, titleBn, minPrice, maxPrice] = prodList[pi];
        const retailPrice = rnd(minPrice, maxPrice);
        const wholesalePrice = Math.round(retailPrice * 0.75);
        const stock = rnd(15, 500);
        const brandId = domainBrands.length > 0 ? pick(domainBrands) : null;
        const brand = brandId ? (BRANDS.find(b => brandMap[b.slug]?.id === brandId)?.nameEn ?? null) : null;
        const isBestSeller = pi < 2;
        const isFeatured = pi < 3;
        const moq = domain === 'food' ? rnd(1, 3) : 1;

        const productId = genId();
        const sku = `OB-${domain.substring(0,3).toUpperCase()}-${productId}`;

        // Check duplicate SKU
        const exists = await prisma.product.findFirst({ where: { sku } });
        if (exists) continue;

        // Create product
        await prisma.product.create({
          data: {
            id: productId,
            titleEn: titleEn + (pi > 11 ? ` v${Math.floor(pi/12)+1}` : ''),
            titleBn: titleBn + (pi > 11 ? ` v${Math.floor(pi/12)+1}` : ''),
            descriptionEn: `Premium ${titleEn} from OceanBazar. High quality, fast delivery across Bangladesh. Genuine product with warranty.`,
            descriptionBn: `ওশানবাজার থেকে প্রিমিয়াম ${titleBn}। উচ্চ মান, বাংলাদেশ জুড়ে দ্রুত ডেলিভারি। ওয়ারেন্টি সহ আসল পণ্য।`,
            brandId,
            brand,
            sku,
            status: 'active',
            stock,
            moq,
            weight: parseFloat((0.1 + Math.random() * 4.9).toFixed(3)),
            weightUnit: 'kg',
            isBestSeller,
            isFeatured,
            ratingAvg: parseFloat((3.5 + Math.random() * 1.5).toFixed(2)),
            reviewCount: rnd(5, 200),
            popularityRank: isBestSeller ? pi + 1 : null,
            popularityLabelEn: isBestSeller ? 'Best Seller' : isFeatured ? 'Top Pick' : null,
            popularityLabelBn: isBestSeller ? 'বেস্ট সেলার' : isFeatured ? 'টপ পিক' : null,
          },
        });

        // Pricing — retail with 3 tiers, wholesale
        await prisma.productPricing.createMany({
          data: [
            {
              productId,
              customerType: 'retail',
              price: retailPrice,
              compareAt: Math.round(retailPrice * 1.25),
              tier1MinQty: 3,  tier1Discount: 5,
              tier2MinQty: 6,  tier2Discount: 10,
              tier3MinQty: 12, tier3Discount: 15,
              sortOrder: 0,
            },
            {
              productId,
              customerType: 'wholesale',
              price: wholesalePrice,
              compareAt: retailPrice,
              tier1MinQty: 10, tier1Discount: 5,
              tier2MinQty: 25, tier2Discount: 10,
              tier3MinQty: 50, tier3Discount: 15,
              sortOrder: 1,
            },
          ],
          skipDuplicates: true,
        });

        // Assets — 2 images + 1 video on every 5th product
        const img1 = imgs[pi % imgs.length] ?? `https://picsum.photos/seed/${productId}a/800/800`;
        const img2 = imgs[(pi + 1) % imgs.length] ?? `https://picsum.photos/seed/${productId}b/800/800`;
        await prisma.productAsset.createMany({
          data: [
            { productId, assetType: 'image', url: img1, altEn: titleEn, altBn: titleBn, isPrimary: true,  sortOrder: 0 },
            { productId, assetType: 'image', url: img2, altEn: titleEn, altBn: titleBn, isPrimary: false, sortOrder: 1 },
            ...(pi % 5 === 0 ? [{
              productId, assetType: 'video',
              url: domainVideos[domain],
              altEn: `${titleEn} Video`, altBn: `${titleBn} ভিডিও`,
              isPrimary: false, sortOrder: 2,
            }] : []),
          ],
          skipDuplicates: true,
        });

        // Category map (many-to-many)
        await prisma.productCategoryMap.upsert({
          where: { productId_categoryId: { productId, categoryId: catId } },
          create: { productId, categoryId: catId, isPrimary: true, sortOrder: 0 },
          update: {},
        });

        totalProds++;
      }
    }
    console.log(`    ✓ ${domain}: products seeded for ${catIds.length} leaf categories`);
  }
  console.log(`  ✓ ${totalProds} products total`);
}

// ── Ensure DB columns exist ────────────────────────────────────────────────────
async function ensureColumns() {
  console.log('  🔧 Ensuring DB columns exist...');
  const cols = [
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS is_best_seller BOOLEAN NOT NULL DEFAULT false`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS popularity_rank INT`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS popularity_label_en VARCHAR(255)`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS popularity_label_bn VARCHAR(255)`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS reviews_snapshot JSONB`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS brand_logo_url VARCHAR(500)`,
    `ALTER TABLE product_pricing ADD COLUMN IF NOT EXISTS tier1_min_qty INT`,
    `ALTER TABLE product_pricing ADD COLUMN IF NOT EXISTS tier1_discount NUMERIC(5,2)`,
    `ALTER TABLE product_pricing ADD COLUMN IF NOT EXISTS tier2_min_qty INT`,
    `ALTER TABLE product_pricing ADD COLUMN IF NOT EXISTS tier2_discount NUMERIC(5,2)`,
    `ALTER TABLE product_pricing ADD COLUMN IF NOT EXISTS tier3_min_qty INT`,
    `ALTER TABLE product_pricing ADD COLUMN IF NOT EXISTS tier3_discount NUMERIC(5,2)`,
    `ALTER TABLE products ALTER COLUMN category_id DROP NOT NULL`,
    `CREATE TABLE IF NOT EXISTS product_metrics (
       product_id CHAR(8) NOT NULL PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
       total_clicks BIGINT NOT NULL DEFAULT 0,
       total_orders INT NOT NULL DEFAULT 0,
       total_quantity_sold BIGINT NOT NULL DEFAULT 0,
       last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
    `CREATE TABLE IF NOT EXISTS homepage_category_display (
       id SERIAL PRIMARY KEY,
       category_id CHAR(8) NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
       sort_order INT NOT NULL DEFAULT 0,
       is_active BOOLEAN NOT NULL DEFAULT true,
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
    `CREATE TABLE IF NOT EXISTS product_category_map (
       product_id CHAR(8) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
       category_id CHAR(8) NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
       is_primary BOOLEAN NOT NULL DEFAULT false,
       sort_order INT NOT NULL DEFAULT 0,
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       PRIMARY KEY (product_id, category_id)
     )`,
  ];
  for (const sql of cols) {
    try { await prisma.$executeRawUnsafe(sql); } catch (_) { /* already exists */ }
  }
  console.log('  ✓ DB columns ready');
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🌊 OceanBazar Bulk Seed — START\n');

  console.log('Step 0/5: Ensuring DB columns...');
  await ensureColumns();

  console.log('Step 1/5: Uploading brand logos to Cloudinary...');
  const brandLogos = await uploadBrandLogos();

  console.log('\nStep 2/5: Uploading product images to Cloudinary...');
  const { domainImgs, domainVideos } = await uploadDomainImages();

  console.log('\nStep 3/5: Seeding categories...');
  const leafIds = await seedCategories();

  console.log('\nStep 4/5: Seeding brands...');
  const brandMap = await seedBrands(brandLogos);

  console.log('\nStep 5/5: Seeding products...');
  await seedProducts(leafIds, brandMap, domainImgs, domainVideos);

  console.log('\n✅ Bulk seed complete!\n');
  console.log('Summary:');
  console.log('  • 104 categories (8 root → 24 sub → 72 leaf)');
  console.log('  • 25 brands with Cloudinary logos');
  console.log('  • ~700+ products with Cloudinary images & videos');
  console.log('  • Retail + Wholesale pricing with 3 volume tiers each');
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
