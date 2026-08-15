/* Seed company vision + leadership. Run after: npx prisma generate */
const { PrismaClient } = require('@prisma/client');

const vision =
  'Ocean Bazar was founded by a collaborative team of entrepreneurs with one clear ambition: to redefine modern e-commerce in Bangladesh through reliability, innovation, and uncompromising customer care. We built a digital marketplace where seamless technology meets a carefully managed supply chain—so authentic, high-quality products are accessible and delivered with care. As shared owners, we are personally invested in every step of your journey. From our digital storefront to your doorstep, we are dedicated to growing Ocean Bazar into your most trusted destination for value and excellence.';

const intro =
  'Our success is driven by a leadership team committed to exceptional products and a seamless shopping experience. As co-founders, each member brings a specialized focus—from our digital storefront to your doorstep. Reach out to the relevant department head for specific inquiries.';

const team = [
  {
    name: 'Suvo Ahmed',
    title: 'Chief Technology Officer (CTO) & Head of Strategy',
    bio: 'Suvo leads our digital infrastructure and business planning. He keeps Ocean Bazar platform secure, innovative, and user-friendly while charting the strategic roadmap for long-term growth.',
    email: 'suvo-ahmed@oceanbazar.com.bd',
    phone: '',
  },
  {
    name: 'Eamam Hasan Nishad',
    title: 'Chief Customer Officer (CCO)',
    bio: 'Eamam is the voice of our brand and the primary champion for our shoppers. He oversees customer interactions and relationship management so every query is met with dedicated support.',
    email: 'nishad@oceanbazar.com.bd',
    phone: '',
  },
  {
    name: 'Naeimuzzaman Akand',
    title: 'Chief Financial Officer (CFO) & Director of Sales',
    bio: 'Naeimuzzaman drives commercial success and financial health. By managing financial strategy and sales initiatives, he keeps operations sustainable while delivering competitive value.',
    email: 'akand@oceanbazar.com.bd',
    phone: '',
  },
  {
    name: 'MD Jobayer',
    title: 'Chief Operating Officer (COO) & Head of Logistics',
    bio: 'Jobayer powers our supply chain—inventory, restocking, and fulfillment—so every order is processed accurately and delivered with care across Bangladesh.',
    email: 'md-jobayer@oceanbazar.com.bd',
    phone: '',
  },
];

(async () => {
  const prisma = new PrismaClient();
  const row = await prisma.site_settings.findFirst({ where: { id: 'default' } });
  if (!row) {
    await prisma.site_settings.create({
      data: {
        id: 'default',
        company_vision: vision,
        leadership_intro: intro,
        leadership_team: team,
      },
    });
    console.log('created site_settings with vision/leadership');
  } else {
    const data = {};
    if (!row.company_vision) data.company_vision = vision;
    if (!row.leadership_intro) data.leadership_intro = intro;
    if (!row.leadership_team) data.leadership_team = team;
    if (Object.keys(data).length) {
      await prisma.site_settings.update({ where: { id: row.id }, data });
      console.log('seeded keys:', Object.keys(data).join(','));
    } else {
      console.log('vision/leadership already present');
    }
  }
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
