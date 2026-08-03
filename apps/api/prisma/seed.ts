/**
 * Real-rollout seed: settings defaults, categories, and a small set of test
 * users — no suggestions, cycles, votes or comments. Safe to run on every
 * deploy: upserts only, never deletes.
 *
 * `RESEED=true tsx prisma/seed.ts` (or `--reseed`) additionally wipes every
 * transactional table and any user not in TEST_USERS first — use this once to
 * clear out old demo data before a real rollout.
 */
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
 * Test accounts only. Replace with the real HR export before launch — see
 * docs/OPERATIONS.md. Since Google sign-in currently accepts any account
 * (ALLOWED_EMAIL_DOMAINS is unset), the admin entry's email must be a real
 * Google account you control so the first sign-in lands as admin; the two
 * staff entries are placeholders for exercising role-based views in the admin
 * UI and cannot themselves be logged into unless someone owns that address.
 */
const TEST_USERS: Array<{
  email: string;
  fullName: string;
  division: Division;
  department: string;
  role?: 'ADMIN' | 'STAFF';
  locale?: Locale;
}> = [
  { email: 'ansari.tech.rtu@gmail.com', fullName: 'Abdullah Ansari', division: 'SHARED', department: 'Quality', role: 'ADMIN' },
  { email: 'staff1@example.com', fullName: 'Test Staff One', division: 'COLLEGE', department: 'Navigation', role: 'STAFF', locale: 'LV' },
  { email: 'staff2@example.com', fullName: 'Test Staff Two', division: 'TRAINING_CENTRE', department: 'Course Administration', role: 'STAFF', locale: 'RU' },
];

const reseed = process.env.RESEED === 'true' || process.argv.includes('--reseed');

async function main() {
  if (reseed) {
    console.log('reseed — wiping demo/transactional data and stray users');
    await prisma.$transaction([
      prisma.auditLog.deleteMany(),
      prisma.emailLog.deleteMany(),
      prisma.reminderRun.deleteMany(),
      prisma.vote.deleteMany(),
      prisma.comment.deleteMany(),
      prisma.statusHistory.deleteMany(),
      prisma.cycleParticipation.deleteMany(),
      prisma.suggestionAttachment.deleteMany(),
      prisma.suggestion.deleteMany(),
      prisma.weeklyCycle.deleteMany(),
      prisma.session.deleteMany(),
    ]);
    const kept = await prisma.user.deleteMany({
      where: { email: { notIn: TEST_USERS.map((u) => u.email) } },
    });
    console.log(`removed ${kept.count} user(s) outside the test list`);
  }

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

  for (const u of TEST_USERS) {
    await prisma.user.upsert({
      where: { email: u.email },
      create: {
        email: u.email,
        fullName: u.fullName,
        division: u.division,
        department: u.department,
        role: u.role ?? 'STAFF',
        locale: u.locale ?? 'EN',
        notificationPref: { create: {} },
      },
      update: { division: u.division, department: u.department, role: u.role ?? 'STAFF' },
    });
  }
  console.log(`users: ${TEST_USERS.length} (${TEST_USERS.filter((u) => u.role === 'ADMIN').length} admin)`);
  console.log('\nSign in at /login with Google — any Google account works until');
  console.log('ALLOWED_EMAIL_DOMAINS is set.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
