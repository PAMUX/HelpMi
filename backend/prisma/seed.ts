import { PrismaClient } from '@prisma/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } } as any);

async function main() {
  const categories = [
    { slug: 'errands-queueing', nameEn: 'Errands & Queueing', nameSi: 'කාර්ය හා පෝලිම්', nameTa: 'தொல்லைகள் & வரிசை', sortOrder: 1 },
    { slug: 'vehicle-services', nameEn: 'Vehicle Services', nameSi: 'වාහන සේවා', nameTa: 'வாகன சேவைகள்', sortOrder: 2 },
    { slug: 'pickup-drop', nameEn: 'Pickup & Drop', nameSi: 'ගෙනෙන & ලබාදෙන', nameTa: 'பிக்-அப் & டிராப்', sortOrder: 3 },
    { slug: 'home-help', nameEn: 'Home Help', nameSi: 'ගෙදර උදව්', nameTa: 'வீட்டு உதவி', sortOrder: 4 },
    { slug: 'tech-setup', nameEn: 'Tech Setup', nameSi: 'තාක්ෂණ පිහිටුවීම', nameTa: 'தொழில்நுட்ப அமைப்பு', sortOrder: 5 },
    { slug: 'elderly-assistance', nameEn: 'Elderly Assistance', nameSi: 'වැඩිහිටි සහය', nameTa: 'முதியோர் உதவி', sortOrder: 6, minTier: 'SILVER' as const },
    { slug: 'event-help', nameEn: 'Event Help', nameSi: 'උත්සව සහය', nameTa: 'நிகழ்வு உதவி', sortOrder: 7 },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: cat,
      create: cat,
    });
    console.log(`Seeded category: ${cat.nameEn}`);
  }

  console.log('Seed complete.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
