import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { generateEntityId } from '../src/utils/hexId';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ─── Super admin ────────────────────────────────────────────────────────────
  const existing = await prisma.adminUser.findFirst({ where: { username: 'superadmin' } });
  if (!existing) {
    await prisma.adminUser.create({
      data: {
        name: 'Super Admin',
        username: 'superadmin',
        email: 'admin@oceanbazar.com',
        passwordHash: await bcrypt.hash('Admin@1234', 12),
        role: 'super_admin',
      },
    });
    console.log('  ✓ Created super admin (username: superadmin, password: Admin@1234)');
  }

  // ─── Primary CRM admin (requested) ──────────────────────────────────────────
  const crmPassword = await bcrypt.hash('rjsuvosa420', 12);
  await prisma.adminUser.upsert({
    where: { username: 'rjsuvosa' },
    create: {
      name: 'CRM Admin',
      username: 'rjsuvosa',
      email: 'rjsuvosa@admin.oceanbazar.local',
      passwordHash: crmPassword,
      role: 'super_admin',
      active: true,
    },
    update: {
      passwordHash: crmPassword,
      active: true,
      role: 'super_admin',
    },
  });
  console.log('  ✓ CRM admin ready (username: rjsuvosa)');

  // ─── Root categories ────────────────────────────────────────────────────────
  const categoryData = [
    { nameEn: 'Electronics', nameBn: 'ইলেকট্রনিক্স', icon: '📱' },
    { nameEn: 'Clothing', nameBn: 'পোশাক', icon: '👕' },
    { nameEn: 'Home & Garden', nameBn: 'গৃহ ও বাগান', icon: '🏠' },
    { nameEn: 'Books', nameBn: 'বই', icon: '📚' },
    { nameEn: 'Food & Grocery', nameBn: 'খাদ্য ও মুদি', icon: '🛒' },
    { nameEn: 'Sports', nameBn: 'খেলাধুলা', icon: '⚽' },
  ];

  for (const cat of categoryData) {
    const exists = await prisma.category.findFirst({ where: { nameEn: cat.nameEn, parentId: null } });
    if (!exists) {
      const catId = generateEntityId();
      const slug = cat.nameEn.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-');
      const catRecord = await prisma.category.create({
        data: { id: catId, ...cat, slug, sortOrder: categoryData.indexOf(cat) },
      });

      // Add subcategories for Electronics
      if (cat.nameEn === 'Electronics') {
        for (const sub of [
          { nameEn: 'Smartphones', nameBn: 'স্মার্টফোন' },
          { nameEn: 'Laptops', nameBn: 'ল্যাপটপ' },
          { nameEn: 'Accessories', nameBn: 'আনুষাঙ্গিক' },
        ]) {
          const subSlug = sub.nameEn.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-');
          await prisma.category.create({
            data: { id: generateEntityId(), ...sub, slug: subSlug, parentId: catRecord.id },
          });
        }
      }

      console.log(`  ✓ Created category: ${cat.nameEn}`);
    }
  }

  // ─── Demo product ────────────────────────────────────────────────────────────
  const electronicsSubcat = await prisma.category.findFirst({ where: { nameEn: 'Smartphones' } });
  if (electronicsSubcat) {
    const demoProduct = await prisma.product.findFirst({ where: { titleEn: 'Samsung Galaxy A54' } });
    if (!demoProduct) {
      await prisma.product.create({
        data: {
          id: generateEntityId(),
          titleEn: 'Samsung Galaxy A54',
          titleBn: 'স্যামসাং গ্যালাক্সি A54',
          descriptionEn: 'A stunning 6.4-inch Super AMOLED display, 50MP camera, and 5000mAh battery.',
          descriptionBn: '৬.৪ ইঞ্চি সুপার AMOLED ডিসপ্লে, ৫০MP ক্যামেরা এবং ৫০০০mAh ব্যাটারি।',
          categoryId: electronicsSubcat.id,
          brand: 'Samsung',
          sku: 'SAM-A54-BLK',
          status: 'active',
          moq: 1,
          stock: 100,
          pricing: {
            create: [
              {
                customerType: 'retail',
                price: 35000,
                compareAt: 38000,
                tier1MinQty: 2, tier1Discount: 5,
                tier2MinQty: 6, tier2Discount: 10,
                tier3MinQty: 11, tier3Discount: 15,
              },
              {
                customerType: 'wholesale',
                price: 32000,
                tier1MinQty: 5, tier1Discount: 2,
                tier2MinQty: 15, tier2Discount: 5,
                tier3MinQty: 30, tier3Discount: 8,
              },
            ],
          },
        },
      });
      console.log('  ✓ Created demo product: Samsung Galaxy A54');
    }
  }

  // ─── Default site_settings row ─────────────────────────────────────────────
  const settings = await prisma.site_settings.findFirst();
  if (!settings) {
    await prisma.site_settings.create({
      data: {
        id: 'default',
        support_email: 'support@oceanbazar.com',
        support_phone: '+880-1700-000000',
        facebook_url: 'https://facebook.com/oceanbazar',
        instagram_url: 'https://instagram.com/oceanbazar',
        youtube_url: 'https://youtube.com/@oceanbazar',
        default_courier: 'steadfast',
      },
    });
    console.log('  ✓ Created default site_settings');
  }

  console.log('\n✅ Seed complete!\n');
  console.log('   Admin login: superadmin / Admin@1234');
  console.log('   CRM admin:   rjsuvosa (password set in seed)');
  console.log('   API: http://localhost:4000');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
