/**
 * Demo dataset.
 *
 * Builds ten weeks of history so every screen has something real to show: a rank
 * list with real spread, a review queue with overdue items, a board with
 * answered suggestions, and cycles containing on-time, grace, missed and exempt
 * weeks.
 *
 * Idempotent: if suggestions already exist it stops, unless RESEED=true.
 */
import '../src/load-env.js';
import { PrismaClient, type Division, type Locale, type SuggestionStatus } from '@prisma/client';
import { DateTime } from 'luxon';
import { SETTING_DEFAULTS } from '@nk/shared';

const prisma = new PrismaClient();
const ZONE = 'Europe/Riga';
const WEEKS_OF_HISTORY = 10;

// Deterministic pseudo-random, so every deploy of the demo looks the same.
let seed = 20260803;
const rand = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)]!;
const chance = (p: number) => rand() < p;

// ---------------------------------------------------------------- people

interface Person {
  email: string;
  fullName: string;
  division: Division;
  department: string;
  role?: 'ADMIN' | 'STAFF';
  locale?: Locale;
  /** Likelihood of submitting in any given week — drives the rank spread. */
  diligence: number;
}

const PEOPLE: Person[] = [
  { email: 'admin@novikontas.org', fullName: 'Ilze Ozola', division: 'SHARED', department: 'Quality', role: 'ADMIN', locale: 'LV', diligence: 0.95 },
  { email: 'quality@novikontas.org', fullName: 'Marek Vaitkus', division: 'SHARED', department: 'Quality', role: 'ADMIN', locale: 'LT', diligence: 0.9 },
  { email: 'training.head@novikontas.org', fullName: 'Anna Berzina', division: 'TRAINING_CENTRE', department: 'Course Administration', role: 'ADMIN', locale: 'LV', diligence: 0.85 },

  { email: 'nav.instructor@novikontas.org', fullName: 'Juris Kalnins', division: 'COLLEGE', department: 'Navigation', locale: 'LV', diligence: 1.0 },
  { email: 'eng.instructor@novikontas.org', fullName: 'Sergey Volkov', division: 'COLLEGE', department: 'Marine Engineering', locale: 'RU', diligence: 0.9 },
  { email: 'ecdis.trainer@novikontas.org', fullName: 'Laura Zarina', division: 'COLLEGE', department: 'Navigation', locale: 'LV', diligence: 0.8 },
  { email: 'erm.trainer@novikontas.org', fullName: 'Tomas Petrauskas', division: 'COLLEGE', department: 'Marine Engineering', locale: 'LT', diligence: 0.7 },
  { email: 'polar.trainer@novikontas.org', fullName: 'Kristaps Liepa', division: 'COLLEGE', department: 'Navigation', diligence: 0.5 },

  { email: 'stcw.coordinator@novikontas.org', fullName: 'Olga Ivanova', division: 'TRAINING_CENTRE', department: 'Course Administration', locale: 'RU', diligence: 0.95 },
  { email: 'survival.instructor@novikontas.org', fullName: 'Andris Vitols', division: 'TRAINING_CENTRE', department: 'Safety & Survival', locale: 'LV', diligence: 0.85 },
  { email: 'firefighting@novikontas.org', fullName: 'Pavel Morozov', division: 'TRAINING_CENTRE', department: 'Safety & Survival', locale: 'RU', diligence: 0.6 },
  { email: 'medical.trainer@novikontas.org', fullName: 'Dace Krumina', division: 'TRAINING_CENTRE', department: 'Medical Care', locale: 'LV', diligence: 0.75 },
  { email: 'pool.supervisor@novikontas.org', fullName: 'Rihards Ozols', division: 'TRAINING_CENTRE', department: 'Safety & Survival', diligence: 0.4 },
  { email: 'huet.operator@novikontas.org', fullName: 'Gatis Brencis', division: 'TRAINING_CENTRE', department: 'Safety & Survival', diligence: 0.55 },
  { email: 'revalidation@novikontas.org', fullName: 'Elena Sokolova', division: 'TRAINING_CENTRE', department: 'Course Administration', locale: 'RU', diligence: 0.8 },

  { email: 'gwo.lead@novikontas.org', fullName: 'Mikk Saar', division: 'ENERGY', department: 'Wind', diligence: 0.9 },
  { email: 'irata.instructor@novikontas.org', fullName: 'Davis Lacis', division: 'ENERGY', department: 'Working at Height', locale: 'LV', diligence: 0.65 },
  { email: 'offshore.trainer@novikontas.org', fullName: 'Nikolai Petrov', division: 'ENERGY', department: 'Oil & Gas', locale: 'RU', diligence: 0.45 },
  { email: 'wind.coordinator@novikontas.org', fullName: 'Ieva Rudzite', division: 'ENERGY', department: 'Wind', locale: 'LV', diligence: 0.7 },

  { email: 'reception@novikontas.org', fullName: 'Marta Skujina', division: 'SHARED', department: 'Reception', locale: 'LV', diligence: 0.85 },
  { email: 'it.support@novikontas.org', fullName: 'Raivis Ozolins', division: 'SHARED', department: 'IT', diligence: 0.75 },
  { email: 'facilities@novikontas.org', fullName: 'Vitalijs Kuzmins', division: 'SHARED', department: 'Facilities', locale: 'RU', diligence: 0.5 },
  { email: 'hr@novikontas.org', fullName: 'Zane Bērziņa', division: 'SHARED', department: 'HR', locale: 'LV', diligence: 0.6 },
  { email: 'finance@novikontas.org', fullName: 'Agnese Liepina', division: 'SHARED', department: 'Finance', locale: 'LV', diligence: 0.35 },
];

const CATEGORIES = [
  { key: 'safety', sortOrder: 10, division: 'SHARED' as Division, nameI18n: { en: 'Safety', lv: 'Drošība', ru: 'Безопасность' } },
  { key: 'equipment-simulators', sortOrder: 20, division: 'SHARED' as Division, nameI18n: { en: 'Equipment & simulators', lv: 'Aprīkojums un simulatori', ru: 'Оборудование и симуляторы' } },
  { key: 'course-quality', sortOrder: 30, division: 'TRAINING_CENTRE' as Division, nameI18n: { en: 'Course quality', lv: 'Kursu kvalitāte', ru: 'Качество курсов' } },
  { key: 'admin-processes', sortOrder: 40, division: 'SHARED' as Division, nameI18n: { en: 'Admin & processes', lv: 'Administrācija un procesi', ru: 'Администрирование и процессы' } },
  { key: 'facilities', sortOrder: 50, division: 'SHARED' as Division, nameI18n: { en: 'Facilities', lv: 'Telpas un infrastruktūra', ru: 'Помещения' } },
  { key: 'trainee-experience', sortOrder: 60, division: 'SHARED' as Division, nameI18n: { en: 'Trainee experience', lv: 'Kursantu pieredze', ru: 'Опыт курсантов' } },
  { key: 'digital-tools', sortOrder: 70, division: 'SHARED' as Division, nameI18n: { en: 'Digital tools', lv: 'Digitālie rīki', ru: 'Цифровые инструменты' } },
];

/** Realistic maritime-training suggestions, keyed to a category. */
const IDEAS: Array<{ cat: string; title: string; body: string }> = [
  { cat: 'equipment-simulators', title: 'Second whiteboard in the bridge simulator briefing room', body: 'During BRM debriefs we run out of board space halfway through the second scenario, so the manoeuvring diagram gets wiped before the group has finished discussing it. A second mobile whiteboard would let us keep the track history visible while working through the decision points.' },
  { cat: 'safety', title: 'Colour-code the muster stations in the survival pool hall', body: 'International groups routinely gather at the wrong side of the pool during the initial brief, which costs three or four minutes each session. Painted floor markings with matching numbered signs would remove the confusion without needing an interpreter.' },
  { cat: 'course-quality', title: 'Print ECDIS quick-reference cards for the workstations', body: 'Participants spend the first twenty minutes of every ECDIS session hunting through menus. A laminated card per workstation covering route check, safety contour and alarm settings would let them start on the exercise instead of the interface.' },
  { cat: 'admin-processes', title: 'Pre-fill certificate details from the registration form', body: 'We retype trainee names and dates of birth from registration into the certificate template, and typos mean reprints. The data is already in the system at registration, so the certificate should draw from it directly.' },
  { cat: 'facilities', title: 'Drying rack for immersion suits between sessions', body: 'Suits go back on the rail wet, so the afternoon group starts in cold damp kit. A heated drying rack in the changing area would turn suits around between sessions and extend how long they last.' },
  { cat: 'trainee-experience', title: 'Printed timetable at reception for multi-day courses', body: 'Trainees on five-day programmes keep asking reception which room they are in next. A printed daily timetable at the desk, updated each morning, would answer most of those questions before they are asked.' },
  { cat: 'digital-tools', title: 'Shared calendar for simulator bookings', body: 'Simulator double-bookings happen a few times a month because the sheet lives in one office. A shared calendar visible to all instructors would make the clash obvious at the point of booking.' },
  { cat: 'equipment-simulators', title: 'Replace the worn throttle quadrant on engine station 4', body: 'The lever on station 4 sticks between 40 and 60 percent, so trainees learn to compensate for a fault rather than the plant behaviour. It has been noted in three course feedback rounds.' },
  { cat: 'safety', title: 'Second eyewash station in the firefighting yard', body: 'The only eyewash point is inside the equipment shed, roughly forty metres from the burn pit. A second unit at the pit edge would meet the response time we teach on the course itself.' },
  { cat: 'course-quality', title: 'Standardise the debrief structure across survival instructors', body: 'Debrief quality varies noticeably between instructors, and participants notice. A one-page debrief frame — what happened, what was decided, what would change — would keep the good practice and level up the rest.' },
  { cat: 'admin-processes', title: 'Batch the revalidation reminders to one weekly send', body: 'Returning trainees get separate emails per certificate, sometimes four in a week, and they stop reading them. One weekly summary per person would be read, and reduce the calls to the office.' },
  { cat: 'facilities', title: 'Better lighting over the IRATA rigging bay', body: 'The overhead lights leave the lower anchor points in shadow, and inspection of knots relies on head torches. Two additional fittings would make the bay usable through the winter afternoons.' },
  { cat: 'digital-tools', title: 'QR codes on equipment linking to the maintenance log', body: 'Finding the service history of a specific BA set means walking to the office and opening a folder. A QR sticker linking to that item’s log would let instructors check it where they stand.' },
  { cat: 'trainee-experience', title: 'Hot drinks available during the long safety days', body: 'The one-day STCW refresher runs 08:00 to 18:00 with a single vending machine. A basic urn and cups in the break area would cost very little and comes up in feedback repeatedly.' },
  { cat: 'equipment-simulators', title: 'Add a methanol bunkering scenario to the engine simulator library', body: 'Clients are increasingly asking about alternative fuels and we are turning enquiries away. The station already supports IGF, so building the scenario is instructor time rather than new hardware.' },
  { cat: 'safety', title: 'Refresher on the HUET emergency stop for all pool staff', body: 'Only two of the pool team have practised the emergency stop this year. A twenty-minute drill each quarter would keep the whole team current on a control they may need once.' },
  { cat: 'course-quality', title: 'Record model answers for the ARPA plotting exercises', body: 'Trainees who miss the worked example have nothing to check against afterwards. Short recorded walkthroughs would give them a reference and reduce repeat questions in the following session.' },
  { cat: 'admin-processes', title: 'One shared inbox for course enquiries', body: 'Enquiries arrive at four different addresses and get answered twice or not at all. A single monitored inbox with a simple rota would fix both failure modes.' },
  { cat: 'facilities', title: 'Bicycle parking near the Duntes street entrance', body: 'Staff and trainees lock bikes to the railing because there is no rack, which blocks part of the walkway. A rack for eight bikes would clear the entrance.' },
  { cat: 'digital-tools', title: 'Feedback form as a QR code at the end of each course', body: 'Paper feedback forms get transcribed by hand and about a third are lost. A QR code on the closing slide would collect the same answers straight into a sheet.' },
  { cat: 'trainee-experience', title: 'Name badges for the first day of long programmes', body: 'Instructors on multi-week programmes take days to learn twenty-five names, which slows down group work. Simple badges for week one would help both directions.' },
  { cat: 'equipment-simulators', title: 'Spare headsets for the bridge team exercises', body: 'Two of the eight headsets have intermittent microphones, so communication exercises get interrupted by hardware rather than the scenario. Four spares would cover normal failures.' },
  { cat: 'course-quality', title: 'Translate the safety induction into Russian and Latvian', body: 'The induction is delivered in English and roughly a fifth of participants clearly miss parts of it. Written translations to hand out alongside would close the gap cheaply.' },
  { cat: 'admin-processes', title: 'Checklist for handing over a course between instructors', body: 'When an instructor swaps mid-programme, context is lost and trainees repeat themselves. A short handover checklist would carry the group state across.' },
  { cat: 'safety', title: 'Monthly inspection of the fall-arrest anchor points', body: 'Anchor inspection is annual and documented, but the bay is used daily. A quick monthly visual check logged on the wall would catch damage far earlier.' },
  { cat: 'facilities', title: 'Soundproofing between classrooms 3 and 4', body: 'A firefighting theory session next door is audible through the wall, and both groups lose focus. Acoustic panels on one side would be enough given the wall construction.' },
  { cat: 'digital-tools', title: 'Automatic reminder to instructors with unsubmitted assessments', body: 'Assessment records sometimes arrive weeks late, which delays certificates. A nudge two days after a course closes would collect most of them without anyone chasing.' },
  { cat: 'trainee-experience', title: 'Clear signage from the car park to reception', body: 'First-time visitors regularly arrive late because the entrance is not obvious from the car park. Two signs would solve it.' },
];

const RESPONSES: Record<string, string> = {
  ACCEPTED: 'Accepted. Added to the quarterly improvement plan and assigned an owner. We will confirm the delivery date once the supplier has quoted.',
  IMPLEMENTED: 'Done — this is now in place. Thank you for raising it; the change was smaller than expected and the difference is already noticeable.',
  REJECTED: 'We are not taking this forward this year. The cost falls outside the current budget cycle and there is a workaround in place. Worth raising again when the budget is reviewed in Q1.',
  DEFERRED: 'Held for now. This depends on the facility works scheduled for later in the year, so we will revisit it once those dates are confirmed.',
};

const COMMENTS = [
  'Agreed — this comes up in almost every feedback round.',
  'Same problem on the afternoon sessions. Happy to help test a fix.',
  'Worth checking whether the Lithuanian centre already solved this.',
  'I raised something similar last year, so glad it is being looked at properly.',
  'Could we trial this with one group before committing to the full cost?',
];
const INTERNAL_COMMENTS = [
  'Quoted at roughly EUR 400. Within the maintenance budget, no approval needed.',
  'Checked with facilities — this needs to wait for the electrical works.',
  'Duplicate of an earlier item; merging the two for the improvement plan.',
];

// ------------------------------------------------------------------ main

/**
 * `RESEED=true tsx …` is POSIX-only shell syntax and fails on Windows, so the
 * flag is also accepted as an argument: `pnpm demo:reseed` works everywhere.
 */
const reseed = process.env.RESEED === 'true' || process.argv.includes('--reseed');

async function main() {
  const existing = await prisma.suggestion.count();
  if (existing > 0 && !reseed) {
    console.log(`Database already has ${existing} suggestions. Skipping.`);
    console.log('Run `pnpm demo:reseed` to wipe the demo data and rebuild it.');
    return;
  }

  if (reseed) {
    console.log('reseed — clearing existing demo data');
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
      prisma.authToken.deleteMany(),
    ]);
  }

  // -------------------------------------------------------- settings
  for (const [key, value] of Object.entries(SETTING_DEFAULTS)) {
    await prisma.setting.upsert({
      where: { key },
      create: { key, value: value as unknown as object },
      update: {},
    });
  }
  // The demo shows the full picture, including misses. In a real rollout this
  // stays off until HR and legal have signed off — see README.
  await prisma.setting.upsert({
    where: { key: 'leaderboard.showMissesToStaff' },
    create: { key: 'leaderboard.showMissesToStaff', value: true as unknown as object },
    update: { value: true as unknown as object },
  });
  console.log('settings ready');

  // ------------------------------------------------------ categories
  const categories = [];
  for (const c of CATEGORIES) {
    categories.push(
      await prisma.category.upsert({
        where: { key: c.key },
        create: c,
        update: { nameI18n: c.nameI18n, sortOrder: c.sortOrder },
      }),
    );
  }
  const catByKey = new Map(categories.map((c) => [c.key, c]));
  console.log(`categories: ${categories.length}`);

  // ----------------------------------------------------------- users
  const users = [];
  for (const p of PEOPLE) {
    const u = await prisma.user.upsert({
      where: { email: p.email },
      create: {
        email: p.email,
        fullName: p.fullName,
        division: p.division,
        department: p.department,
        role: p.role ?? 'STAFF',
        locale: p.locale ?? 'EN',
        notificationPref: { create: {} },
      },
      update: {
        fullName: p.fullName,
        division: p.division,
        department: p.department,
        role: p.role ?? 'STAFF',
      },
    });
    users.push({ ...u, diligence: p.diligence });
  }
  const admins = users.filter((u) => u.role === 'ADMIN');
  console.log(`users: ${users.length} (${admins.length} admin)`);

  // ---------------------------------------------------------- cycles
  const thisWeek = DateTime.now().setZone(ZONE).startOf('week');
  const cycles = [];

  for (let back = WEEKS_OF_HISTORY; back >= 0; back--) {
    const start = thisWeek.minus({ weeks: back });
    const isCurrent = back === 0;
    const cycle = await prisma.weeklyCycle.upsert({
      where: { isoYear_isoWeek: { isoYear: start.weekYear, isoWeek: start.weekNumber } },
      create: {
        isoYear: start.weekYear,
        isoWeek: start.weekNumber,
        startsAt: start.toJSDate(),
        endsAt: start.plus({ days: 6 }).endOf('day').toJSDate(),
        graceEndsAt: start.plus({ weeks: 1 }).set({ hour: 12, minute: 0, second: 0 }).toJSDate(),
        status: isCurrent ? 'OPEN' : 'CLOSED',
        closedAt: isCurrent ? null : start.plus({ weeks: 1 }).set({ hour: 12 }).toJSDate(),
      },
      update: {},
    });
    cycles.push({ cycle, start, isCurrent });
  }
  console.log(`cycles: ${cycles.length} (${WEEKS_OF_HISTORY} closed + current week open)`);

  // ----------------------------------------------- suggestions per cycle
  let ideaCursor = 0;
  let refCounter = 1;
  let suggestionCount = 0;
  const created: Array<{ id: string; status: SuggestionStatus; submitterId: string }> = [];

  for (const { cycle, start, isCurrent } of cycles) {
    for (const user of users) {
      // Two people are on leave for one week each, to demonstrate exemptions.
      const exempt =
        !isCurrent &&
        ((user.email === 'polar.trainer@novikontas.org' && cycle.isoWeek % 7 === 3) ||
          (user.email === 'finance@novikontas.org' && cycle.isoWeek % 9 === 4));

      if (exempt) {
        await prisma.cycleParticipation.upsert({
          where: { cycleId_userId: { cycleId: cycle.id, userId: user.id } },
          create: {
            cycleId: cycle.id,
            userId: user.id,
            status: 'EXEMPT',
            note: 'Annual leave',
            resolvedById: admins[0]!.id,
          },
          update: {},
        });
        continue;
      }

      const submits = chance(user.diligence);

      // The current week is still open, so non-submitters stay PENDING.
      if (!submits) {
        await prisma.cycleParticipation.upsert({
          where: { cycleId_userId: { cycleId: cycle.id, userId: user.id } },
          create: {
            cycleId: cycle.id,
            userId: user.id,
            status: isCurrent ? 'PENDING' : 'MISSED',
            fridayReminderAt: isCurrent ? null : start.plus({ days: 4, hours: 17 }).toJSDate(),
            mondayReminderAt: isCurrent ? null : start.plus({ weeks: 1, hours: 9 }).toJSDate(),
          },
          update: {},
        });
        continue;
      }

      const inGrace = !isCurrent && chance(0.12);
      const idea = IDEAS[ideaCursor % IDEAS.length]!;
      ideaCursor += 1;

      const createdAt = inGrace
        ? start.plus({ weeks: 1, hours: 10, minutes: Math.floor(rand() * 100) }).toJSDate()
        : start
            .plus({ days: Math.floor(rand() * 6), hours: 9 + Math.floor(rand() * 8) })
            .toJSDate();

      // Older weeks are further through the workflow.
      const age = WEEKS_OF_HISTORY - cycles.findIndex((c) => c.cycle.id === cycle.id);
      let status: SuggestionStatus;
      if (isCurrent) {
        status = 'SUBMITTED';
      } else if (age >= 7) {
        status = pick<SuggestionStatus>(['IMPLEMENTED', 'IMPLEMENTED', 'REJECTED', 'ACCEPTED']);
      } else if (age >= 4) {
        status = pick<SuggestionStatus>(['ACCEPTED', 'IMPLEMENTED', 'REJECTED', 'DEFERRED', 'UNDER_REVIEW']);
      } else {
        status = pick<SuggestionStatus>(['SUBMITTED', 'UNDER_REVIEW', 'ACCEPTED', 'SUBMITTED']);
      }

      const isAnonymous = chance(0.14);
      const decided = ['ACCEPTED', 'REJECTED', 'DEFERRED', 'IMPLEMENTED'].includes(status);
      const closed = ['REJECTED', 'IMPLEMENTED'].includes(status);
      const decidedAt = decided
        ? DateTime.fromJSDate(createdAt).plus({ days: 3 + Math.floor(rand() * 12) }).toJSDate()
        : null;

      const referenceCode = `SUG-${start.year}-${String(refCounter).padStart(4, '0')}`;
      refCounter += 1;

      const suggestion = await prisma.suggestion.create({
        data: {
          referenceCode,
          title: idea.title,
          body: idea.body,
          categoryId: catByKey.get(idea.cat)!.id,
          submitterId: user.id,
          isAnonymous,
          cycleId: cycle.id,
          submittedInGrace: inGrace,
          status,
          createdAt,
          updatedAt: decidedAt ?? createdAt,
          acknowledgedAt: status === 'SUBMITTED' ? null : DateTime.fromJSDate(createdAt).plus({ days: 2 }).toJSDate(),
          decidedAt,
          closedAt: closed ? decidedAt : null,
          // A handful of overdue items, so the queue's overdue filter has content.
          dueDate: DateTime.fromJSDate(createdAt).plus({ days: chance(0.2) ? 12 : 28 }).toJSDate(),
          responseBody: decided ? (RESPONSES[status] ?? null) : null,
          respondedAt: decided ? decidedAt : null,
          qmsActionRef: ['ACCEPTED', 'IMPLEMENTED'].includes(status)
            ? `QMS-${start.year}-${String(100 + suggestionCount).slice(-3)}`
            : null,
          assigneeId: decided || status === 'UNDER_REVIEW' ? pick(admins).id : null,
          assignedAt: decided || status === 'UNDER_REVIEW' ? DateTime.fromJSDate(createdAt).plus({ days: 2 }).toJSDate() : null,
        },
      });
      suggestionCount += 1;
      created.push({ id: suggestion.id, status, submitterId: user.id });

      // Status history, matching the path the suggestion actually took.
      const trail: Array<{
        from: SuggestionStatus | null;
        to: SuggestionStatus;
        at: Date;
        reason?: string | undefined;
      }> = [
        { from: null, to: 'SUBMITTED', at: createdAt, reason: 'Submitted' },
      ];
      if (status !== 'SUBMITTED') {
        trail.push({
          from: 'SUBMITTED',
          to: 'UNDER_REVIEW',
          at: DateTime.fromJSDate(createdAt).plus({ days: 2 }).toJSDate(),
        });
      }
      if (decided) {
        const target: SuggestionStatus = status === 'IMPLEMENTED' ? 'ACCEPTED' : status;
        trail.push({
          from: 'UNDER_REVIEW',
          to: target,
          at: decidedAt!,
          reason: ['REJECTED', 'DEFERRED'].includes(target) ? RESPONSES[target] : undefined,
        });
        if (status === 'IMPLEMENTED') {
          trail.push({
            from: 'ACCEPTED',
            to: 'IMPLEMENTED',
            at: DateTime.fromJSDate(decidedAt!).plus({ days: 6 }).toJSDate(),
          });
        }
      }
      for (const step of trail) {
        await prisma.statusHistory.create({
          data: {
            suggestionId: suggestion.id,
            fromStatus: step.from,
            toStatus: step.to,
            changedById: step.from === null ? user.id : pick(admins).id,
            reason: step.reason ?? null,
            changedAt: step.at,
          },
        });
      }

      await prisma.cycleParticipation.upsert({
        where: { cycleId_userId: { cycleId: cycle.id, userId: user.id } },
        create: {
          cycleId: cycle.id,
          userId: user.id,
          status: inGrace ? 'SUBMITTED_IN_GRACE' : 'SUBMITTED_ON_TIME',
          suggestionId: suggestion.id,
          fridayReminderAt: inGrace ? start.plus({ days: 4, hours: 17 }).toJSDate() : null,
          mondayReminderAt: inGrace ? start.plus({ weeks: 1, hours: 9 }).toJSDate() : null,
        },
        update: {},
      });

      // Comments and votes, weighted so the board has a clear top few.
      if (chance(0.45)) {
        await prisma.comment.create({
          data: {
            suggestionId: suggestion.id,
            authorId: pick(users).id,
            body: pick(COMMENTS),
            createdAt: DateTime.fromJSDate(createdAt).plus({ days: 1 }).toJSDate(),
          },
        });
      }
      if (chance(0.25)) {
        await prisma.comment.create({
          data: {
            suggestionId: suggestion.id,
            authorId: pick(admins).id,
            body: pick(INTERNAL_COMMENTS),
            isInternal: true,
            createdAt: DateTime.fromJSDate(createdAt).plus({ days: 2 }).toJSDate(),
          },
        });
      }

      const voters = users.filter(() => chance(0.18));
      for (const v of voters) {
        await prisma.vote.create({
          data: {
            suggestionId: suggestion.id,
            userId: v.id,
            createdAt: DateTime.fromJSDate(createdAt).plus({ hours: 6 }).toJSDate(),
          },
        }).catch(() => undefined);
      }
    }
  }

  // The trigger in raw.sql keeps vote_count accurate, but if raw.sql has not run
  // yet the counts would sit at zero — so set them explicitly here too.
  await prisma.$executeRawUnsafe(`
    UPDATE suggestions s
       SET vote_count = (SELECT count(*) FROM votes v WHERE v.suggestion_id = s.id)`);

  // ---------------------------------------------------- reminder history
  for (const { cycle, start, isCurrent } of cycles.slice(-4)) {
    if (isCurrent) continue;
    const pending = await prisma.cycleParticipation.count({
      where: { cycleId: cycle.id, status: { in: ['MISSED', 'SUBMITTED_IN_GRACE'] } },
    });
    await prisma.reminderRun.create({
      data: {
        template: 'FRIDAY_REMINDER',
        cycleId: cycle.id,
        recipientsCount: pending,
        skippedCount: 1,
        failedCount: 0,
        startedAt: start.plus({ days: 4, hours: 17 }).toJSDate(),
        finishedAt: start.plus({ days: 4, hours: 17, minutes: 2 }).toJSDate(),
      },
    });
    await prisma.reminderRun.create({
      data: {
        template: 'MONDAY_REMINDER',
        cycleId: cycle.id,
        recipientsCount: Math.max(0, pending - 2),
        skippedCount: 1,
        failedCount: 0,
        startedAt: start.plus({ weeks: 1, hours: 9 }).toJSDate(),
        finishedAt: start.plus({ weeks: 1, hours: 9, minutes: 1 }).toJSDate(),
      },
    });
  }

  const counts = {
    users: await prisma.user.count(),
    cycles: await prisma.weeklyCycle.count(),
    suggestions: await prisma.suggestion.count(),
    implemented: await prisma.suggestion.count({ where: { status: 'IMPLEMENTED' } }),
    missed: await prisma.cycleParticipation.count({ where: { status: 'MISSED' } }),
    votes: await prisma.vote.count(),
    comments: await prisma.comment.count(),
  };

  console.log('\n--- demo data ready ---');
  console.table(counts);
  console.log('\nSign in with one click on the login screen — DEMO_MODE is on.');
  console.log('Admin persona:  admin@novikontas.org  (Ilze Ozola)');
  console.log('Staff persona:  nav.instructor@novikontas.org  (Juris Kalnins)\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
