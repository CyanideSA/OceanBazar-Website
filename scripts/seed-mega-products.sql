-- Mega seed: 60+ products per category (9 categories × 65 products = 585 products)
-- Uses generate_series for efficient bulk insertion
-- Categories: Electronics(9679A2E8), Clothing(4C910991), Home&Garden(95F93CF9), 
--   Sports(23A69275), Accessories(77EE4A49), Books(2877D963), Food(B927BF92),
--   Laptops(133306AD), Smartphones(EBC63009)

DO $$
DECLARE
  cats TEXT[][] := ARRAY[
    ARRAY['9679A2E8','Electronics','ইলেকট্রনিক্স'],
    ARRAY['4C910991','Clothing','পোশাক'],
    ARRAY['95F93CF9','Home & Garden','ঘর ও বাগান'],
    ARRAY['23A69275','Sports','খেলাধুলা'],
    ARRAY['77EE4A49','Accessories','আনুষাঙ্গিক'],
    ARRAY['2877D963','Books','বই'],
    ARRAY['B927BF92','Food & Grocery','খাদ্য ও মুদি'],
    ARRAY['133306AD','Laptops','ল্যাপটপ'],
    ARRAY['EBC63009','Smartphones','স্মার্টফোন']
  ];
  cat_id TEXT; cat_en TEXT; cat_bn TEXT;
  prod_id TEXT; i INT; base_price NUMERIC;
  electronics_names TEXT[] := ARRAY['Wireless Earbuds','Bluetooth Speaker','Power Bank 20000mAh','USB-C Hub','Smart Watch','LED Desk Lamp','Portable SSD 1TB','Webcam HD','Mechanical Keyboard','Gaming Mouse','Monitor Stand','HDMI Cable 4K','Wi-Fi Router','Smart Plug','Digital Scale','Surge Protector','USB Microphone','Noise Cancelling Headphones','Wireless Charger','Smart Home Hub','Electric Kettle','Air Purifier','Robot Vacuum','Dash Camera','Portable Projector','Smart Doorbell','Electric Toothbrush','Hair Dryer','VR Headset','Streaming Stick','Fitness Tracker','Action Camera','Drone Mini','Solar Power Bank','Ring Light','Clip-on Fan','Phone Stand','Car Charger','Wall Charger 65W','Extension Board','Thermal Printer','Label Maker','Digital Clock','Night Light','Smart Scale','TV Wall Mount','Sound Bar','Subwoofer','Wireless Mouse','Drawing Tablet','Electric Screwdriver','Soldering Kit','Multimeter','LED Strip Lights','Smart Bulb','Baby Monitor','Walkie Talkie Set','Emergency Radio','Binoculars','FM Transmitter','Bluetooth Adapter','Cable Organizer','Screen Protector Kit','Memory Card 256GB','Card Reader'];
  clothing_names TEXT[] := ARRAY['Classic Cotton T-Shirt','Slim Fit Jeans','Formal Dress Shirt','Summer Floral Dress','Denim Jacket','Jogger Pants','Polo Shirt','Maxi Skirt','Wool Sweater','Leather Belt','Silk Tie','Casual Shorts','Linen Shirt','Hoodie','Windbreaker','Cardigan','Tank Top','Cargo Pants','Blazer','Trench Coat','Sweatpants','Graphic Tee','Chino Pants','Parka','Turtleneck','Bermuda Shorts','Oxford Shirt','Flannel Shirt','Athletic Leggings','Sports Bra','Track Jacket','Overalls','Romper','Kimono Wrap','Bomber Jacket','Peacoat','Rain Jacket','Corduroy Pants','Yoga Pants','Board Shorts','Hawaiian Shirt','Thermal Underwear','Compression Shirt','Running Shorts','Cycling Jersey','Swim Trunks','Sun Hat','Beanie','Scarf','Gloves','Socks Set 6-Pack','Pajama Set','Bathrobe','Undershirt 3-Pack','Boxers 5-Pack','Ankle Socks 12-Pack','Formal Trousers','Bow Tie','Cufflinks Set','Pocket Square','Suspenders','Waistcoat','Wedding Suit','Nehru Jacket','Kurta Pajama'];
  home_names TEXT[] := ARRAY['Memory Foam Pillow','Bed Sheet Set Queen','Throw Blanket','Table Lamp','Wall Clock','Photo Frame Set','Kitchen Knife Set','Cutting Board','Stainless Steel Pot','Non-Stick Pan','Glass Container Set','Spice Rack','Dish Drying Rack','Trash Can 13L','Shower Curtain','Bath Mat','Towel Set','Soap Dispenser','Laundry Basket','Ironing Board','Vacuum Storage Bags','Shoe Rack','Coat Hanger Set','Door Mat','Curtain Rod','Blackout Curtains','Cushion Cover Set','Rug 5x7ft','Bean Bag','Magazine Rack','Umbrella Stand','Key Holder','Letter Box','Plant Pot Set','Garden Hose','Watering Can','Garden Gloves','Pruning Shears','Lawn Seed','Compost Bin','Solar Garden Lights','Bird Feeder','Hammock','Outdoor Thermometer','Welcome Sign','Address Plaque','Doorbell Camera Mount','Weather Station','Fire Pit','BBQ Grill Cover','Picnic Blanket','Camping Chair','Cooler Box','Bug Zapper','Citronella Candle Set','Garden Kneeler','Trellis Panel','Fence Paint','Deck Chair','Pool Float','Wind Chimes','Hanging Basket','Planter Box','Raised Garden Bed','Lawn Mower Cover'];
  sports_names TEXT[] := ARRAY['Yoga Mat','Resistance Bands Set','Jump Rope','Foam Roller','Pull-Up Bar','Kettlebell 10kg','Dumbbells Set','Ab Wheel','Push-Up Board','Exercise Ball','Boxing Gloves','Punching Bag','Speed Ladder','Tennis Racket','Badminton Set','Table Tennis Set','Basketball','Football','Cricket Bat','Cricket Ball Set','Golf Club','Golf Balls 12-Pack','Fishing Rod','Fishing Reel','Tackle Box','Camping Tent 4-Person','Sleeping Bag','Hiking Backpack','Compass','Headlamp','Carabiner Set','Climbing Rope','Ski Goggles','Snowboard Wax','Surfboard Fins','Swim Goggles','Swim Cap','Kickboard','Snorkel Set','Life Jacket','Bicycle Helmet','Cycling Gloves','Bike Pump','Water Bottle 1L','Shaker Bottle','Gym Bag','Ankle Weights','Wrist Wraps','Knee Sleeves','Lifting Belt','Yoga Block Set','Stretching Strap','Agility Cones','Whistle','Scoreboard','Stopwatch','Heart Rate Monitor','Sports Tape','Muscle Roller Stick','Massage Gun','Ice Pack','First Aid Kit Sport','Arm Sleeves','Headband Set','Athletic Tape'];
  accessories_names TEXT[] := ARRAY['Leather Wallet','Sunglasses Polarized','Watch Classic','Phone Case Premium','Laptop Sleeve 15in','Backpack Urban','Tote Bag','Crossbody Bag','Duffel Bag','Travel Organizer','Passport Holder','Luggage Tag Set','Keychain Multitool','Carabiner Keyring','Money Clip','Card Holder','Bracelet Silver','Necklace Gold Plated','Earrings Set','Ring Adjustable','Hair Clips Set','Hair Tie Pack','Headband Elastic','Makeup Bag','Cosmetic Mirror','Nail Kit','Tweezers Set','Eyeglass Case','Lens Cleaning Kit','Watch Band','Watch Box','Jewelry Box','Brooch Pin','Cufflinks','Tie Bar','Lapel Pin','Hat Pin','Belt Buckle','Shoe Laces Set','Shoe Polish Kit','Umbrella Compact','Reusable Bag Set','Water Flask','Thermos 500ml','Lunch Box','Cutlery Set Travel','Straw Set Reusable','Coaster Set','Mouse Pad','Desk Organizer','Pen Set','Notebook A5','Sticker Pack','Washi Tape Set','Bookmark Set','Planner 2025','Calendar Desk','Sticky Notes Pack','Index Cards','Highlighter Set','Marker Set','Pencil Case','Eraser Pack','Ruler Set','Scissors'];
  books_names TEXT[] := ARRAY['The Art of Programming','Data Structures Explained','Machine Learning Basics','Web Development 2025','Python Masterclass','JavaScript Deep Dive','React Patterns','Node.js in Action','Docker Handbook','Cloud Architecture','Agile Project Management','Clean Code','Design Patterns','System Design Interview','Database Fundamentals','Network Security','Linux Administration','DevOps Practices','API Design','Microservices Architecture','Blockchain Explained','AI Ethics','Quantum Computing','Cybersecurity Guide','Mobile App Development','Game Development','UX Design Principles','Typography Handbook','Color Theory','Photography Basics','Creative Writing','Poetry Collection','Short Stories Anthology','Novel Writing Guide','Self-Help Essentials','Mindfulness Practice','Financial Literacy','Investment Guide','Startup Handbook','Marketing Strategy','Digital Marketing','Social Media Guide','SEO Mastery','Content Strategy','Public Speaking','Leadership Principles','Team Management','Negotiation Skills','Time Management','Productivity Habits','Cooking for Beginners','Baking Bible','Vegetarian Recipes','World Cuisines','Dessert Making','Healthy Eating','Fitness Guide','Yoga Philosophy','Meditation Guide','Travel Guide Bangladesh','History of Commerce','Economics 101','Philosophy Intro','Psychology Basics','Sociology Primer'];
  food_names TEXT[] := ARRAY['Basmati Rice 5kg','Jasmine Rice 2kg','Flour All Purpose 1kg','Sugar 2kg','Salt 1kg','Black Pepper 100g','Turmeric Powder 200g','Chili Powder 200g','Cumin Seeds 100g','Coriander Powder 200g','Garam Masala 100g','Mustard Oil 1L','Soybean Oil 5L','Olive Oil Extra Virgin','Coconut Oil 500ml','Ghee 400g','Butter 200g','Milk Powder 500g','Tea Leaves 400g','Coffee Beans 250g','Green Tea Bags 25pc','Honey Pure 500g','Jam Strawberry','Peanut Butter','Nutella 350g','Oats 500g','Cornflakes 300g','Muesli 400g','Biscuit Assorted','Chips Variety Pack','Chocolate Bar Set','Candy Mix 500g','Dried Fruits Mix','Cashew Nuts 250g','Almonds 250g','Walnuts 200g','Raisins 300g','Dates Premium 500g','Pasta 500g','Noodles Instant 10pc','Spaghetti 500g','Macaroni 400g','Tomato Sauce 500g','Soy Sauce 300ml','Vinegar 500ml','Mayonnaise 250g','Ketchup 500g','Pickle Mixed','Canned Tuna','Canned Corn','Canned Beans','Coconut Milk 400ml','Evaporated Milk','Condensed Milk','Baking Powder 100g','Baking Soda 200g','Vanilla Extract','Yeast Packets','Cocoa Powder','Dark Chocolate Chips','Sprinkles','Food Coloring Set','Gelatin Powder','Agar Powder','Panko Breadcrumbs'];
  laptop_names TEXT[] := ARRAY['UltraBook Pro 14','Gaming Titan 15.6','Business Elite 13','Student Notebook 14','Creative Pro 16','Developer Machine 15','Budget Friendly 14','Convertible Touch 13','Chromebook Plus','Workstation 17','Ultra Thin Air 13','Performance Pro 15','Gaming Stealth 14','Multimedia 15.6','Everyday 14','Pro Max 16','Coding Beast 15','Graphics Studio 17','Travel Lite 12','Rugged Field 14','Mini Laptop 10','All Day Battery 14','4K Display 15.6','Budget Gaming 15','ARM Processor 13','AI Accelerated 14','Fanless Silent 13','eBook Reader 10','OLED Screen 14','120Hz Gaming 16','RTX Power 15','Dual Screen 14','Foldable 13','Desktop Replace 17','USB-C Only 14','5G Connected 14','Video Editing 16','Music Production 15','3D Modeling 17','CAD Workstation 15','Server Laptop 14','Security Focused 14','Eco Friendly 13','Refurbished A+ 14','Open Source 15','Privacy First 14','Student Bundle 14','Corporate Fleet 14','Remote Work 13','Home Office 15','Presentation Pro 14','Sales Team 13','Engineering 15','Science Lab 14','Medical Grade 14','Education Pack 11','Classroom Set','Library Terminal','Kiosk Display','Point of Sale','Digital Signage','Thin Client','Edge Computing','Field Service','Inventory Terminal'];
  phone_names TEXT[] := ARRAY['Galaxy Ultra 24','iPhone Pro Max','Pixel 9 Pro','OnePlus 12','Xiaomi 14 Pro','Samsung A55','Redmi Note 13','Realme GT5','OPPO Find X7','Vivo X100','Nothing Phone 3','Motorola Edge 50','Sony Xperia 6','Nokia G60','Huawei P70','POCO F6','Samsung M55','iPhone SE 4','Pixel 8a','OnePlus Nord 4','Xiaomi 14T','Redmi 13C','Realme C67','OPPO A79','Vivo Y100','Samsung S24 FE','iPhone 16','Pixel 9','OnePlus 12R','Xiaomi Civi 4','Redmi K70','Realme 12 Pro','OPPO Reno 12','Vivo V30','Nothing Phone 2a','Motorola G84','Sony Xperia 10 VI','Nokia X40','Huawei Nova 12','POCO X6 Pro','Samsung A35','iPhone 15','Pixel 7a','OnePlus Ace 3','Xiaomi 13T','Redmi Note 12','Realme 11','OPPO A98','Vivo T3','Samsung M34','iPhone 14','Pixel 6a','OnePlus Nord CE4','Xiaomi 12T','Redmi 12','Realme C55','OPPO A58','Vivo Y56','Samsung A25','iPhone 13','Pixel 7','OnePlus 11','Xiaomi MIX Fold','Samsung Z Fold 6','Samsung Z Flip 6'];
  cat_names TEXT[][];
  pname TEXT;
BEGIN
  cat_names := ARRAY[
    electronics_names, clothing_names, home_names, sports_names, accessories_names,
    books_names, food_names, laptop_names, phone_names
  ];

  FOR c IN 1..9 LOOP
    cat_id := cats[c][1];
    cat_en := cats[c][2];
    cat_bn := cats[c][3];
    
    FOR i IN 1..65 LOOP
      -- Generate a unique 8-char hex id
      prod_id := upper(substring(md5(cat_id || i::text || random()::text) from 1 for 8));
      
      -- Pick product name from category arrays based on index
      CASE c
        WHEN 1 THEN pname := electronics_names[i];
        WHEN 2 THEN pname := clothing_names[i];
        WHEN 3 THEN pname := home_names[i];
        WHEN 4 THEN pname := sports_names[i];
        WHEN 5 THEN pname := accessories_names[i];
        WHEN 6 THEN pname := books_names[i];
        WHEN 7 THEN pname := food_names[i];
        WHEN 8 THEN pname := laptop_names[i];
        WHEN 9 THEN pname := phone_names[i];
      END CASE;

      base_price := 100 + (random() * 9900)::int;
      
      INSERT INTO products (
        id, category_id, title_en, title_bn, description_en, description_bn,
        sku, status, stock, moq, weight, weight_unit,
        is_featured, popularity_rank, popularity_label_en, popularity_label_bn,
        rating_avg, review_count, created_at, updated_at
      ) VALUES (
        prod_id, cat_id,
        pname,
        cat_bn || ' ' || i,
        'High quality ' || pname || ' from OceanBazar. Premium product with fast delivery across Bangladesh.',
        cat_bn || ' পণ্য ' || i || ' - ওশানবাজার থেকে উচ্চ মানের পণ্য।',
        'SKU-' || cat_id || '-' || lpad(i::text, 3, '0'),
        'active',
        (10 + (random() * 990)::int),
        1,
        (0.1 + random() * 5)::numeric(8,3),
        'kg',
        (random() < 0.2),
        CASE WHEN i <= 10 THEN i ELSE NULL END,
        CASE WHEN i <= 3 THEN 'Best Seller' WHEN i <= 6 THEN 'Trending' WHEN i <= 10 THEN 'New Arrival' ELSE NULL END,
        CASE WHEN i <= 3 THEN 'বেস্ট সেলার' WHEN i <= 6 THEN 'ট্রেন্ডিং' WHEN i <= 10 THEN 'নতুন' ELSE NULL END,
        (3.0 + random() * 2)::numeric(3,2),
        (random() * 200)::int,
        now() - (random() * interval '90 days'),
        now()
      ) ON CONFLICT (id) DO NOTHING;

      -- Insert 2 images per product
      INSERT INTO product_assets (product_id, asset_type, url, is_primary, sort_order, created_at)
      VALUES
        (prod_id, 'image', 'https://picsum.photos/seed/' || prod_id || 'a/800/800', true, 0, now()),
        (prod_id, 'image', 'https://picsum.photos/seed/' || prod_id || 'b/800/800', false, 1, now());

      -- Insert retail + wholesale pricing
      INSERT INTO product_pricing (product_id, customer_type, price, compare_at, sort_order)
      VALUES
        (prod_id, 'retail', base_price, base_price * 1.3, 0),
        (prod_id, 'wholesale', base_price * 0.8, base_price, 1)
      ON CONFLICT (product_id, customer_type) DO NOTHING;
      
    END LOOP;
    RAISE NOTICE 'Seeded 65 products for category: %', cat_en;
  END LOOP;
  
  RAISE NOTICE 'Total seed complete: 585 products';
END $$;
