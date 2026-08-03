import '../src/load-env.js';
import { PrismaClient, type Division, type Locale } from '@prisma/client';
import { SETTING_DEFAULTS } from '@nk/shared';

const prisma = new PrismaClient();

const CATEGORIES = [
  {
    key: 'safety',
    sortOrder: 10,
    division: 'SHARED',
    nameI18n: { en: 'Safety', lv: 'Drošība', ru: 'Безопасность' },
  },
  {
    key: 'equipment-simulators',
    sortOrder: 20,
    division: 'SHARED',
    nameI18n: { en: 'Equipment & simulators', lv: 'Aprīkojums un simulatori', ru: 'Оборудование и симуляторы' },
  },
  {
    key: 'course-quality',
    sortOrder: 30,
    division: 'TRAINING_CENTRE',
    nameI18n: { en: 'Course quality', lv: 'Kursu kvalitāte', ru: 'Качество курсов' },
  },
  {
    key: 'admin-processes',
    sortOrder: 40,
    division: 'SHARED',
    nameI18n: { en: 'Admin & processes', lv: 'Administrācija un procesi', ru: 'Администрирование и процессы' },
  },
  {
    key: 'facilities',
    sortOrder: 50,
    division: 'SHARED',
    nameI18n: { en: 'Facilities', lv: 'Telpas un infrastruktūra', ru: 'Помещения' },
  },
  {
    key: 'trainee-experience',
    sortOrder: 60,
    division: 'SHARED',
    nameI18n: { en: 'Trainee experience', lv: 'Kursantu pieredze', ru: 'Опыт курсантов' },
  },
  {
    key: 'digital-tools',
    sortOrder: 70,
    division: 'SHARED',
    nameI18n: { en: 'Digital tools', lv: 'Digitālie rīki', ru: 'Цифровые инструменты' },
  },
];

/**
 * Replace this list with the real HR export before launch. Seeding division and
 * department here is what makes the first sign-in correct rather than guessed.
 */
const STAFF: Array<{
  email: string;
  fullName: string;
  division: Division;
  department: string;
  role?: 'ADMIN' | 'STAFF';
  locale?: Locale;
}> = [
  { email: 'admin@novikontas.org', fullName: 'Suggestion Owner', division: 'SHARED', department: 'Quality', role: 'ADMIN' },
  { email: 'quality.head@novikontas.org', fullName: 'Quality Manager', division: 'SHARED', department: 'Quality', role: 'ADMIN', locale: 'LV' },
  { email: 'nav.instructor@novikontas.org', fullName: 'Navigation Instructor', division: 'COLLEGE', department: 'Navigation', locale: 'LV' },
  { email: 'eng.instructor@novikontas.org', fullName: 'Engine Room Instructor', division: 'COLLEGE', department: 'Marine Engineering' },
  { email: 'stcw.coordinator@novikontas.org', fullName: 'STCW Coordinator', division: 'TRAINING_CENTRE', department: 'Course Administration', locale: 'RU' },
  { email: 'survival.instructor@novikontas.org', fullName: 'Survival Instructor', division: 'TRAINING_CENTRE', department: 'Safety & Survival' },
  { email: 'gwo.lead@novikontas.org', fullName: 'GWO Lead', division: 'ENERGY', department: 'Wind' },
  { email: 'reception@novikontas.org', fullName: 'Front Desk', division: 'SHARED', department: 'Reception', locale: 'LV' },
];

async function main() {
  for (const [key, value] of Object.entries(SETTING_DEFAULTS)) {
    await prisma.setting.upsert({
      where: { key },
      create: { key, value: value as unknown as object },
      update: {},
    });
  }
  console.log(`settings: ${Object.keys(SETTING_DEFAULTS).length} defaults in place`);

  for (const c of CATEGORIES) {
    await prisma.category.upsert({
      where: { key: c.key },
      create: { ...c, division: c.division as Division },
      update: { nameI18n: c.nameI18n, sortOrder: c.sortOrder },
    });
  }
  console.log(`categories: ${CATEGORIES.length}`);

  for (const s of STAFF) {
    await prisma.user.upsert({
      where: { email: s.email },
      create: {
        email: s.email,
        fullName: s.fullName,
        division: s.division,
        department: s.department,
        role: s.role ?? 'STAFF',
        locale: s.locale ?? 'EN',
        notificationPref: { create: {} },
      },
      update: { division: s.division, department: s.department, role: s.role ?? 'STAFF' },
    });
  }
  console.log(`users: ${STAFF.length} (${STAFF.filter((s) => s.role === 'ADMIN').length} admin)`);
  console.log('\nSign in at http://localhost:5173/login with admin@novikontas.org');
  console.log('With MAIL_DRY_RUN=true the link is printed in the API console.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
