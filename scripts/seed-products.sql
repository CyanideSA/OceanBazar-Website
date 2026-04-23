-- Seed random products with media for testing
-- Uses picsum.photos for placeholder product images

-- ─── Helper: generate 8-char hex IDs ──────────────────────────────────────
-- We use fixed IDs for reproducibility

-- ═══════════════════════════════════════════════════════════════════════════
-- PRODUCTS
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO products (id, category_id, title_en, title_bn, description_en, description_bn, sku, status, stock, moq, is_featured, created_at, updated_at) VALUES
-- Electronics (9679A2E8)
('A1B2C3D4', '9679A2E8', 'Wireless Bluetooth Headphones Pro', 'ওয়্যারলেস ব্লুটুথ হেডফোন প্রো', 'Premium noise-canceling Bluetooth headphones with 40-hour battery life, deep bass, and crystal clear audio. Perfect for music lovers and professionals.', 'প্রিমিয়াম নয়েজ-ক্যান্সেলিং ব্লুটুথ হেডফোন ৪০ ঘণ্টা ব্যাটারি লাইফ সহ।', 'ELEC-HP-001', 'active', 150, 1, true, now(), now()),
('B2C3D4E5', '9679A2E8', 'Smart LED Desk Lamp', 'স্মার্ট এলইডি ডেস্ক ল্যাম্প', 'Touch-controlled LED desk lamp with 5 brightness levels and 3 color temperatures. USB charging port included.', 'টাচ-কন্ট্রোল এলইডি ডেস্ক ল্যাম্প ৫ ব্রাইটনেস লেভেল সহ।', 'ELEC-DL-002', 'active', 200, 1, false, now(), now()),
('C3D4E5F6', '9679A2E8', 'Portable Power Bank 20000mAh', 'পোর্টেবল পাওয়ার ব্যাংক ২০০০০ এমএএইচ', 'Fast-charging 20000mAh power bank with dual USB ports and LED display. Compatible with all devices.', 'ফাস্ট চার্জিং ২০০০০ এমএএইচ পাওয়ার ব্যাংক।', 'ELEC-PB-003', 'active', 300, 1, true, now(), now()),
('D4E5F6A7', '9679A2E8', '4K Action Camera Waterproof', '4K অ্যাকশন ক্যামেরা ওয়াটারপ্রুফ', '4K Ultra HD action camera with waterproof case, image stabilization, and WiFi connectivity.', '4K আল্ট্রা এইচডি অ্যাকশন ক্যামেরা ওয়াটারপ্রুফ কেস সহ।', 'ELEC-AC-004', 'active', 50, 1, true, now(), now()),

-- Smartphones (EBC63009)
('E5F6A7B8', 'EBC63009', 'Galaxy Ultra X 256GB', 'গ্যালাক্সি আল্ট্রা এক্স ২৫৬ জিবি', 'Flagship smartphone with 6.8" AMOLED display, 200MP camera, 5000mAh battery and S-Pen support.', 'ফ্ল্যাগশিপ স্মার্টফোন ৬.৮" AMOLED ডিসপ্লে, ২০০MP ক্যামেরা সহ।', 'PHONE-GU-005', 'active', 75, 1, true, now(), now()),
('F6A7B8C9', 'EBC63009', 'Budget Phone A15', 'বাজেট ফোন A15', 'Affordable smartphone with 6.5" display, 48MP triple camera, 5000mAh battery, and 4GB RAM.', 'সাশ্রয়ী স্মার্টফোন ৬.৫" ডিসপ্লে, ৪৮MP ট্রিপল ক্যামেরা সহ।', 'PHONE-BA-006', 'active', 500, 1, false, now(), now()),

-- Clothing (4C910991)
('A7B8C9D0', '4C910991', 'Premium Cotton T-Shirt', 'প্রিমিয়াম কটন টি-শার্ট', '100% organic cotton t-shirt with modern fit. Available in multiple colors and sizes.', '১০০% অর্গানিক কটন টি-শার্ট আধুনিক ফিট।', 'CLO-TS-007', 'active', 1000, 5, false, now(), now()),
('B8C9D0E1', '4C910991', 'Winter Jacket Waterproof', 'উইন্টার জ্যাকেট ওয়াটারপ্রুফ', 'Insulated waterproof winter jacket with hood. Windproof and breathable for extreme cold.', 'ইনসুলেটেড ওয়াটারপ্রুফ উইন্টার জ্যাকেট হুড সহ।', 'CLO-WJ-008', 'active', 200, 1, true, now(), now()),
('C9D0E1F2', '4C910991', 'Formal Slim Fit Shirt', 'ফর্মাল স্লিম ফিট শার্ট', 'Elegant slim-fit formal shirt made from premium wrinkle-free fabric. Perfect for office and events.', 'এলিগ্যান্ট স্লিম-ফিট ফর্মাল শার্ট প্রিমিয়াম রিংকল-ফ্রি ফেব্রিক।', 'CLO-FS-009', 'active', 400, 3, false, now(), now()),

-- Laptops (133306AD)
('D0E1F2A3', '133306AD', 'UltraBook Pro 15" i7', 'আল্ট্রাবুক প্রো ১৫" i7', 'Intel Core i7 laptop with 16GB RAM, 512GB SSD, and 15.6" Full HD IPS display. Perfect for productivity.', 'ইন্টেল কোর i7 ল্যাপটপ ১৬GB RAM, ৫১২GB SSD সহ।', 'LAP-UB-010', 'active', 40, 1, true, now(), now()),
('E1F2A3B4', '133306AD', 'Gaming Laptop RTX 4060', 'গেমিং ল্যাপটপ RTX 4060', 'High-performance gaming laptop with RTX 4060, 32GB RAM, 1TB SSD, and 144Hz display.', 'হাই-পারফরম্যান্স গেমিং ল্যাপটপ RTX 4060, ৩২GB RAM সহ।', 'LAP-GL-011', 'active', 25, 1, true, now(), now()),

-- Home & Garden (95F93CF9)
('F2A3B4C5', '95F93CF9', 'Stainless Steel Cookware Set', 'স্টেইনলেস স্টিল কুকওয়্যার সেট', '10-piece stainless steel cookware set with non-stick coating. Dishwasher safe and oven compatible.', '১০-পিস স্টেইনলেস স্টিল কুকওয়্যার সেট নন-স্টিক কোটিং সহ।', 'HOME-CS-012', 'active', 150, 1, false, now(), now()),
('A3B4C5D6', '95F93CF9', 'Indoor Plant Collection (3 pots)', 'ইনডোর প্ল্যান্ট কালেকশন (৩ পট)', 'Beautiful collection of 3 indoor plants with decorative ceramic pots. Low maintenance.', '৩টি ইনডোর প্ল্যান্টের সুন্দর কালেকশন ডেকোরেটিভ সিরামিক পট সহ।', 'HOME-IP-013', 'active', 80, 1, false, now(), now()),
('B4C5D6E7', '95F93CF9', 'Memory Foam Pillow Set', 'মেমরি ফোম বালিশ সেট', 'Ergonomic memory foam pillow set of 2. Hypoallergenic and breathable cover for better sleep.', 'এরগোনমিক মেমরি ফোম বালিশ সেট ২টি। হাইপোঅ্যালার্জেনিক।', 'HOME-MF-014', 'active', 300, 2, false, now(), now()),

-- Sports (23A69275)
('C5D6E7F8', '23A69275', 'Professional Yoga Mat', 'প্রফেশনাল যোগা ম্যাট', 'Extra thick 6mm yoga mat with non-slip surface and carrying strap. Eco-friendly TPE material.', 'এক্সট্রা থিক ৬মিমি যোগা ম্যাট নন-স্লিপ সারফেস সহ।', 'SPO-YM-015', 'active', 250, 1, false, now(), now()),
('D6E7F8A9', '23A69275', 'Adjustable Dumbbells Set 25kg', 'অ্যাডজাস্টেবল ডাম্বেল সেট ২৫কেজি', 'Space-saving adjustable dumbbells from 2.5kg to 25kg. Quick weight change mechanism.', 'স্পেস-সেভিং অ্যাডজাস্টেবল ডাম্বেল ২.৫কেজি থেকে ২৫কেজি।', 'SPO-AD-016', 'active', 60, 1, true, now(), now()),

-- Accessories (77EE4A49)
('E7F8A9B0', '77EE4A49', 'Leather Wallet RFID Blocking', 'লেদার ওয়ালেট RFID ব্লকিং', 'Genuine leather bifold wallet with RFID blocking technology. Multiple card slots and coin pocket.', 'জেনুইন লেদার বাইফোল্ড ওয়ালেট RFID ব্লকিং টেকনোলজি সহ।', 'ACC-LW-017', 'active', 400, 1, false, now(), now()),
('F8A9B0C1', '77EE4A49', 'Polarized Sunglasses UV400', 'পোলারাইজড সানগ্লাস UV400', 'Stylish polarized sunglasses with UV400 protection. Lightweight titanium frame.', 'স্টাইলিশ পোলারাইজড সানগ্লাস UV400 প্রটেকশন সহ।', 'ACC-PS-018', 'active', 350, 1, false, now(), now()),

-- Books (2877D963)
('A9B0C1D2', '2877D963', 'JavaScript: The Complete Guide', 'জাভাস্ক্রিপ্ট: দ্য কমপ্লিট গাইড', 'Comprehensive JavaScript guide covering ES6+, async programming, and modern frameworks. 800 pages.', 'জাভাস্ক্রিপ্ট গাইড ES6+, অ্যাসিঙ্ক প্রোগ্রামিং এবং মডার্ন ফ্রেমওয়ার্ক কভার করে।', 'BOOK-JS-019', 'active', 500, 1, false, now(), now()),

-- Food & Grocery (B927BF92)
('B0C1D2E3', 'B927BF92', 'Organic Green Tea Collection', 'অর্গানিক গ্রিন টি কালেকশন', 'Premium organic green tea sampler with 5 varieties. Hand-picked from the finest gardens.', 'প্রিমিয়াম অর্গানিক গ্রিন টি স্যাম্পলার ৫ ভ্যারাইটি সহ।', 'FOOD-GT-020', 'active', 600, 3, false, now(), now())
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- PRODUCT PRICING (retail + wholesale)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO product_pricing (product_id, customer_type, price, compare_at, tier1_min_qty, tier1_discount, tier2_min_qty, tier2_discount, tier3_min_qty, tier3_discount) VALUES
-- Wireless Headphones
('A1B2C3D4', 'retail',    3500.00, 4500.00, 5, 5.00, 10, 10.00, 25, 15.00),
('A1B2C3D4', 'wholesale', 2800.00, NULL,    10, 2.00, 50, 5.00,  100, 8.00),
-- Smart LED Desk Lamp
('B2C3D4E5', 'retail',    1200.00, 1800.00, 5, 5.00, 10, 10.00, 25, 15.00),
('B2C3D4E5', 'wholesale', 900.00,  NULL,    10, 2.00, 50, 5.00,  100, 8.00),
-- Power Bank
('C3D4E5F6', 'retail',    2500.00, 3200.00, 3, 5.00, 10, 10.00, 25, 15.00),
('C3D4E5F6', 'wholesale', 2000.00, NULL,    10, 2.00, 50, 5.00,  100, 8.00),
-- Action Camera
('D4E5F6A7', 'retail',    8500.00, 12000.00,2, 5.00, 5, 10.00,  10, 15.00),
('D4E5F6A7', 'wholesale', 7000.00, NULL,    5, 2.00,  20, 5.00,  50, 8.00),
-- Galaxy Ultra
('E5F6A7B8', 'retail',    95000.00,120000.00,1, 3.00, 3, 5.00,   5, 8.00),
('E5F6A7B8', 'wholesale', 85000.00,NULL,    3, 2.00,  10, 4.00,  25, 6.00),
-- Budget Phone
('F6A7B8C9', 'retail',    12000.00,15000.00,2, 5.00, 5, 10.00,  10, 15.00),
('F6A7B8C9', 'wholesale', 9500.00, NULL,    10, 2.00, 50, 5.00,  100, 8.00),
-- Cotton T-Shirt
('A7B8C9D0', 'retail',    450.00,  650.00,  5, 5.00, 20, 10.00, 50, 15.00),
('A7B8C9D0', 'wholesale', 300.00,  NULL,    20, 2.00, 100, 5.00, 500, 8.00),
-- Winter Jacket
('B8C9D0E1', 'retail',    4500.00, 6000.00, 2, 5.00, 5, 10.00,  10, 15.00),
('B8C9D0E1', 'wholesale', 3500.00, NULL,    5, 2.00,  20, 5.00,  50, 8.00),
-- Formal Shirt
('C9D0E1F2', 'retail',    1800.00, 2500.00, 3, 5.00, 10, 10.00, 25, 15.00),
('C9D0E1F2', 'wholesale', 1200.00, NULL,    10, 2.00, 50, 5.00,  100, 8.00),
-- UltraBook Pro
('D0E1F2A3', 'retail',    85000.00,110000.00,1, 3.00, 2, 5.00,   5, 8.00),
('D0E1F2A3', 'wholesale', 75000.00,NULL,    2, 2.00,  5, 4.00,   10, 6.00),
-- Gaming Laptop
('E1F2A3B4', 'retail',    120000.00,150000.00,1, 3.00, 2, 5.00,  3, 8.00),
('E1F2A3B4', 'wholesale', 105000.00,NULL,   2, 2.00,  5, 4.00,   10, 6.00),
-- Cookware Set
('F2A3B4C5', 'retail',    3800.00, 5500.00, 2, 5.00, 5, 10.00,  10, 15.00),
('F2A3B4C5', 'wholesale', 2800.00, NULL,    5, 2.00,  20, 5.00,  50, 8.00),
-- Indoor Plants
('A3B4C5D6', 'retail',    1500.00, 2200.00, 2, 5.00, 5, 10.00,  10, 15.00),
('A3B4C5D6', 'wholesale', 1000.00, NULL,    5, 2.00,  20, 5.00,  50, 8.00),
-- Memory Foam Pillow
('B4C5D6E7', 'retail',    2200.00, 3000.00, 2, 5.00, 5, 10.00,  10, 15.00),
('B4C5D6E7', 'wholesale', 1600.00, NULL,    5, 2.00,  20, 5.00,  50, 8.00),
-- Yoga Mat
('C5D6E7F8', 'retail',    1200.00, 1800.00, 3, 5.00, 10, 10.00, 25, 15.00),
('C5D6E7F8', 'wholesale', 800.00,  NULL,    10, 2.00, 50, 5.00,  100, 8.00),
-- Dumbbells
('D6E7F8A9', 'retail',    6500.00, 8500.00, 2, 5.00, 5, 10.00,  10, 15.00),
('D6E7F8A9', 'wholesale', 5000.00, NULL,    5, 2.00,  20, 5.00,  50, 8.00),
-- Leather Wallet
('E7F8A9B0', 'retail',    1500.00, 2200.00, 5, 5.00, 15, 10.00, 30, 15.00),
('E7F8A9B0', 'wholesale', 1000.00, NULL,    15, 2.00, 50, 5.00,  100, 8.00),
-- Sunglasses
('F8A9B0C1', 'retail',    2800.00, 4000.00, 3, 5.00, 10, 10.00, 25, 15.00),
('F8A9B0C1', 'wholesale', 2000.00, NULL,    10, 2.00, 50, 5.00,  100, 8.00),
-- JS Book
('A9B0C1D2', 'retail',    800.00,  1200.00, 5, 5.00, 20, 10.00, 50, 15.00),
('A9B0C1D2', 'wholesale', 500.00,  NULL,    20, 2.00, 100, 5.00, 500, 8.00),
-- Green Tea
('B0C1D2E3', 'retail',    650.00,  900.00,  5, 5.00, 20, 10.00, 50, 15.00),
('B0C1D2E3', 'wholesale', 400.00,  NULL,    20, 2.00, 100, 5.00, 500, 8.00)
ON CONFLICT (product_id, customer_type) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- PRODUCT ASSETS (images from picsum.photos — each product gets 3 images)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO product_assets (product_id, asset_type, url, alt_en, alt_bn, sort_order, is_primary) VALUES
-- Wireless Headphones
('A1B2C3D4', 'image', 'https://picsum.photos/seed/headphones1/800/800', 'Wireless Bluetooth Headphones - Front', 'ব্লুটুথ হেডফোন - সামনে', 0, true),
('A1B2C3D4', 'image', 'https://picsum.photos/seed/headphones2/800/800', 'Wireless Bluetooth Headphones - Side', 'ব্লুটুথ হেডফোন - পাশে', 1, false),
('A1B2C3D4', 'image', 'https://picsum.photos/seed/headphones3/800/800', 'Wireless Bluetooth Headphones - Detail', 'ব্লুটুথ হেডফোন - বিস্তারিত', 2, false),
-- Smart LED Desk Lamp
('B2C3D4E5', 'image', 'https://picsum.photos/seed/desklamp1/800/800', 'Smart LED Desk Lamp - Front', 'এলইডি ডেস্ক ল্যাম্প - সামনে', 0, true),
('B2C3D4E5', 'image', 'https://picsum.photos/seed/desklamp2/800/800', 'Smart LED Desk Lamp - Lit', 'এলইডি ডেস্ক ল্যাম্প - আলো', 1, false),
('B2C3D4E5', 'image', 'https://picsum.photos/seed/desklamp3/800/800', 'Smart LED Desk Lamp - Close up', 'এলইডি ডেস্ক ল্যাম্প - কাছ থেকে', 2, false),
-- Power Bank
('C3D4E5F6', 'image', 'https://picsum.photos/seed/powerbank1/800/800', 'Power Bank 20000mAh - Front', 'পাওয়ার ব্যাংক - সামনে', 0, true),
('C3D4E5F6', 'image', 'https://picsum.photos/seed/powerbank2/800/800', 'Power Bank 20000mAh - Ports', 'পাওয়ার ব্যাংক - পোর্ট', 1, false),
-- Action Camera
('D4E5F6A7', 'image', 'https://picsum.photos/seed/actioncam1/800/800', '4K Action Camera', '4K অ্যাকশন ক্যামেরা', 0, true),
('D4E5F6A7', 'image', 'https://picsum.photos/seed/actioncam2/800/800', '4K Action Camera - Accessories', '4K অ্যাকশন ক্যামেরা - আনুষঙ্গিক', 1, false),
('D4E5F6A7', 'image', 'https://picsum.photos/seed/actioncam3/800/800', '4K Action Camera - Underwater', '4K অ্যাকশন ক্যামেরা - পানির নিচে', 2, false),
-- Galaxy Ultra
('E5F6A7B8', 'image', 'https://picsum.photos/seed/galaxy1/800/800', 'Galaxy Ultra X - Front', 'গ্যালাক্সি আল্ট্রা - সামনে', 0, true),
('E5F6A7B8', 'image', 'https://picsum.photos/seed/galaxy2/800/800', 'Galaxy Ultra X - Back', 'গ্যালাক্সি আল্ট্রা - পেছনে', 1, false),
('E5F6A7B8', 'image', 'https://picsum.photos/seed/galaxy3/800/800', 'Galaxy Ultra X - Camera Detail', 'গ্যালাক্সি আল্ট্রা - ক্যামেরা', 2, false),
-- Budget Phone
('F6A7B8C9', 'image', 'https://picsum.photos/seed/budgetphone1/800/800', 'Budget Phone A15 - Front', 'বাজেট ফোন A15 - সামনে', 0, true),
('F6A7B8C9', 'image', 'https://picsum.photos/seed/budgetphone2/800/800', 'Budget Phone A15 - Back', 'বাজেট ফোন A15 - পেছনে', 1, false),
-- Cotton T-Shirt
('A7B8C9D0', 'image', 'https://picsum.photos/seed/tshirt1/800/800', 'Premium Cotton T-Shirt - Front', 'কটন টি-শার্ট - সামনে', 0, true),
('A7B8C9D0', 'image', 'https://picsum.photos/seed/tshirt2/800/800', 'Premium Cotton T-Shirt - Back', 'কটন টি-শার্ট - পেছনে', 1, false),
('A7B8C9D0', 'image', 'https://picsum.photos/seed/tshirt3/800/800', 'Premium Cotton T-Shirt - Detail', 'কটন টি-শার্ট - বিস্তারিত', 2, false),
-- Winter Jacket
('B8C9D0E1', 'image', 'https://picsum.photos/seed/jacket1/800/800', 'Winter Jacket - Front', 'উইন্টার জ্যাকেট - সামনে', 0, true),
('B8C9D0E1', 'image', 'https://picsum.photos/seed/jacket2/800/800', 'Winter Jacket - Side', 'উইন্টার জ্যাকেট - পাশে', 1, false),
('B8C9D0E1', 'image', 'https://picsum.photos/seed/jacket3/800/800', 'Winter Jacket - Detail', 'উইন্টার জ্যাকেট - বিস্তারিত', 2, false),
-- Formal Shirt
('C9D0E1F2', 'image', 'https://picsum.photos/seed/formalshirt1/800/800', 'Formal Slim Fit Shirt - Front', 'ফর্মাল শার্ট - সামনে', 0, true),
('C9D0E1F2', 'image', 'https://picsum.photos/seed/formalshirt2/800/800', 'Formal Slim Fit Shirt - Detail', 'ফর্মাল শার্ট - বিস্তারিত', 1, false),
-- UltraBook Pro
('D0E1F2A3', 'image', 'https://picsum.photos/seed/ultrabook1/800/800', 'UltraBook Pro 15" - Open', 'আল্ট্রাবুক প্রো - খোলা', 0, true),
('D0E1F2A3', 'image', 'https://picsum.photos/seed/ultrabook2/800/800', 'UltraBook Pro 15" - Side', 'আল্ট্রাবুক প্রো - পাশে', 1, false),
('D0E1F2A3', 'image', 'https://picsum.photos/seed/ultrabook3/800/800', 'UltraBook Pro 15" - Keyboard', 'আল্ট্রাবুক প্রো - কীবোর্ড', 2, false),
-- Gaming Laptop
('E1F2A3B4', 'image', 'https://picsum.photos/seed/gaminglaptop1/800/800', 'Gaming Laptop RTX 4060', 'গেমিং ল্যাপটপ', 0, true),
('E1F2A3B4', 'image', 'https://picsum.photos/seed/gaminglaptop2/800/800', 'Gaming Laptop - RGB Keyboard', 'গেমিং ল্যাপটপ - কীবোর্ড', 1, false),
-- Cookware Set
('F2A3B4C5', 'image', 'https://picsum.photos/seed/cookware1/800/800', 'Stainless Steel Cookware Set', 'কুকওয়্যার সেট', 0, true),
('F2A3B4C5', 'image', 'https://picsum.photos/seed/cookware2/800/800', 'Cookware Set - Individual Pieces', 'কুকওয়্যার সেট - আলাদা পিস', 1, false),
-- Indoor Plants
('A3B4C5D6', 'image', 'https://picsum.photos/seed/plants1/800/800', 'Indoor Plant Collection', 'ইনডোর প্ল্যান্ট কালেকশন', 0, true),
('A3B4C5D6', 'image', 'https://picsum.photos/seed/plants2/800/800', 'Indoor Plant - Close up', 'ইনডোর প্ল্যান্ট - কাছ থেকে', 1, false),
-- Memory Foam Pillow
('B4C5D6E7', 'image', 'https://picsum.photos/seed/pillow1/800/800', 'Memory Foam Pillow Set', 'মেমরি ফোম বালিশ সেট', 0, true),
('B4C5D6E7', 'image', 'https://picsum.photos/seed/pillow2/800/800', 'Memory Foam Pillow - Cross section', 'মেমরি ফোম বালিশ - ক্রস সেকশন', 1, false),
-- Yoga Mat
('C5D6E7F8', 'image', 'https://picsum.photos/seed/yogamat1/800/800', 'Professional Yoga Mat', 'প্রফেশনাল যোগা ম্যাট', 0, true),
('C5D6E7F8', 'image', 'https://picsum.photos/seed/yogamat2/800/800', 'Yoga Mat - Rolled', 'যোগা ম্যাট - রোল্ড', 1, false),
-- Dumbbells
('D6E7F8A9', 'image', 'https://picsum.photos/seed/dumbbells1/800/800', 'Adjustable Dumbbells Set', 'অ্যাডজাস্টেবল ডাম্বেল সেট', 0, true),
('D6E7F8A9', 'image', 'https://picsum.photos/seed/dumbbells2/800/800', 'Dumbbells - Weight Plates', 'ডাম্বেল - ওজন প্লেট', 1, false),
('D6E7F8A9', 'image', 'https://picsum.photos/seed/dumbbells3/800/800', 'Dumbbells - In use', 'ডাম্বেল - ব্যবহারে', 2, false),
-- Leather Wallet
('E7F8A9B0', 'image', 'https://picsum.photos/seed/wallet1/800/800', 'Leather Wallet - Open', 'লেদার ওয়ালেট - খোলা', 0, true),
('E7F8A9B0', 'image', 'https://picsum.photos/seed/wallet2/800/800', 'Leather Wallet - Closed', 'লেদার ওয়ালেট - বন্ধ', 1, false),
-- Sunglasses
('F8A9B0C1', 'image', 'https://picsum.photos/seed/sunglasses1/800/800', 'Polarized Sunglasses', 'পোলারাইজড সানগ্লাস', 0, true),
('F8A9B0C1', 'image', 'https://picsum.photos/seed/sunglasses2/800/800', 'Sunglasses - Side View', 'সানগ্লাস - পাশ থেকে', 1, false),
-- JS Book
('A9B0C1D2', 'image', 'https://picsum.photos/seed/jsbook1/800/800', 'JavaScript Book - Cover', 'জাভাস্ক্রিপ্ট বই - কভার', 0, true),
('A9B0C1D2', 'image', 'https://picsum.photos/seed/jsbook2/800/800', 'JavaScript Book - Pages', 'জাভাস্ক্রিপ্ট বই - পৃষ্ঠা', 1, false),
-- Green Tea
('B0C1D2E3', 'image', 'https://picsum.photos/seed/greentea1/800/800', 'Organic Green Tea Collection', 'অর্গানিক গ্রিন টি কালেকশন', 0, true),
('B0C1D2E3', 'image', 'https://picsum.photos/seed/greentea2/800/800', 'Green Tea - Brewing', 'গ্রিন টি - তৈরি', 1, false);
