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

  // ─── E2E storefront user (Playwright) ───────────────────────────────────────
  const e2eEmail = 'e2e.storefront@oceanbazar.test';
  const e2ePasswordHash = await bcrypt.hash('Test@1234', 12);
  const existingE2e = await prisma.user.findFirst({ where: { email: e2eEmail } });
  if (!existingE2e) {
    await prisma.user.create({
      data: {
        id: generateEntityId(),
        name: 'E2E Storefront',
        email: e2eEmail,
        passwordHash: e2ePasswordHash,
        emailVerified: true,
        accountStatus: 'active',
      },
    });
    console.log(`  ✓ E2E storefront user: ${e2eEmail} / Test@1234`);
  } else {
    await prisma.user.update({
      where: { id: existingE2e.id },
      data: {
        passwordHash: e2ePasswordHash,
        emailVerified: true,
        accountStatus: 'active',
      },
    });
    console.log(`  ✓ E2E storefront user refreshed: ${e2eEmail}`);
  }

  // ─── E2E sample order (storefront order list + detail) ──────────────────────
  const e2eUserForOrder = await prisma.user.findUnique({ where: { email: e2eEmail } });
  if (e2eUserForOrder) {
    const anyProduct = await prisma.product.findFirst({
      where: { status: 'active' },
      orderBy: { updatedAt: 'desc' },
    });
    if (anyProduct) {
      const existingE2eOrder = await prisma.order.findFirst({ where: { userId: e2eUserForOrder.id } });
      if (!existingE2eOrder) {
        const orderId = generateEntityId();
        const orderNumber = `OB-E2E-${orderId.slice(0, 4)}`;
        await prisma.order.create({
          data: {
            id: orderId,
            orderNumber,
            userId: e2eUserForOrder.id,
            status: 'pending',
            customerType: 'retail',
            subtotal: 1000,
            discount: 0,
            gst: 0,
            shippingFee: 60,
            serviceFee: 10,
            obPointsUsed: 0,
            obDiscount: 0,
            total: 1070,
            paymentMethod: 'cod',
            paymentStatus: 'unpaid',
            items: {
              create: [
                {
                  productId: anyProduct.id,
                  productTitle: anyProduct.titleEn || 'Product',
                  unitPrice: 1000,
                  quantity: 1,
                  lineTotal: 1000,
                },
              ],
            },
            timeline: {
              create: [
                {
                  status: 'pending',
                  note: 'Seeded order for E2E / demos',
                  actorType: 'system',
                },
              ],
            },
          },
        });
        console.log(`  ✓ E2E sample order ${orderNumber} for ${e2eEmail}`);
      }
    }
  }

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
          brand: 'Samsung',
          sku: 'SAM-A54-BLK',
          status: 'active',
          moq: 1,
          stock: 100,
          productCategories: {
            create: {
              categoryId: electronicsSubcat.id,
              isPrimary: true,
              sortOrder: 0,
            },
          },
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
  console.log('   E2E user:    e2e.storefront@oceanbazar.test / Test@1234');
  console.log('   API: http://localhost:4000');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
