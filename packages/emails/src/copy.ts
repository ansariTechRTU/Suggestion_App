import type { Locale } from '@nk/shared';

type Dict = {
  loginSubject: string;
  loginHeading: string;
  loginBody: string;
  loginCta: string;
  loginExpiry: string;
  fridaySubject: (week: string) => string;
  fridayHeading: string;
  fridayBody: string;
  fridayCta: string;
  mondaySubject: (week: string) => string;
  mondayHeading: string;
  mondayBody: (deadline: string) => string;
  mondayCta: string;
  recentlyImplemented: string;
  statImplemented: string;
  statAccepted: string;
  statThisYear: string;
  statusSubject: (code: string) => string;
  statusHeading: string;
  statusBody: (code: string, status: string) => string;
  responseHeading: string;
  responseBody: (code: string) => string;
  assignedSubject: (code: string) => string;
  assignedHeading: string;
  assignedBody: (code: string) => string;
  viewCta: string;
  unsubscribe: string;
  ignoreIfNotYou: string;
};

const en: Dict = {
  loginSubject: 'Your sign-in link',
  loginHeading: 'Sign in',
  loginBody: 'Use the link below to sign in. It works once and only from this email.',
  loginCta: 'Sign in',
  loginExpiry: 'The link expires in 15 minutes.',
  fridaySubject: (w) => `Your suggestion for week ${w}`,
  fridayHeading: 'You have not logged a suggestion this week',
  fridayBody:
    'One suggestion a week, and this week is still open until Sunday night. It does not need to be large — a small fix that saves someone ten minutes counts.',
  fridayCta: 'Write this week\u2019s suggestion',
  mondaySubject: (w) => `Last chance for week ${w}`,
  mondayHeading: 'Week closes today at noon',
  mondayBody: (d) =>
    `Week ${d} is in its grace window. Log a suggestion before noon today and the week counts as complete.`,
  mondayCta: 'Log it now',
  recentlyImplemented: 'Recently put into practice',
  statImplemented: 'implemented',
  statAccepted: 'accepted',
  statThisYear: 'this year',
  statusSubject: (c) => `${c} — status updated`,
  statusHeading: 'Your suggestion moved forward',
  statusBody: (c, s) => `${c} is now <strong>${s}</strong>.`,
  responseHeading: 'You have a response',
  responseBody: (c) => `An administrator has responded to ${c}.`,
  assignedSubject: (c) => `${c} assigned to you`,
  assignedHeading: 'A suggestion is now yours',
  assignedBody: (c) => `${c} has been assigned to you to take forward.`,
  viewCta: 'Open suggestion',
  unsubscribe: 'Stop weekly reminders',
  ignoreIfNotYou: 'If you did not request this, you can ignore this email.',
};

const lv: Dict = {
  ...en,
  loginSubject: 'Jūsu pieteikšanās saite',
  loginHeading: 'Pieteikties',
  loginBody:
    'Izmantojiet zemāk esošo saiti, lai pieteiktos. Tā darbojas vienu reizi un tikai no šī e-pasta.',
  loginCta: 'Pieteikties',
  loginExpiry: 'Saite ir derīga 15 minūtes.',
  fridaySubject: (w) => `Jūsu ierosinājums ${w}. nedēļai`,
  fridayHeading: 'Šonedēļ vēl nav reģistrēts ierosinājums',
  fridayBody:
    'Viens ierosinājums nedēļā, un šī nedēļa ir atvērta līdz svētdienas vakaram. Tam nav jābūt lielam — arī neliels uzlabojums ir vērtīgs.',
  fridayCta: 'Rakstīt šīs nedēļas ierosinājumu',
  mondaySubject: (w) => `Pēdējā iespēja ${w}. nedēļai`,
  mondayHeading: 'Nedēļa noslēdzas šodien pusdienlaikā',
  mondayBody: (d) =>
    `${d}. nedēļa ir pagarinājuma logā. Reģistrējiet ierosinājumu līdz pusdienlaikam, un nedēļa tiks ieskaitīta.`,
  mondayCta: 'Reģistrēt tagad',
  recentlyImplemented: 'Nesen ieviests',
  statImplemented: 'ieviesti',
  statAccepted: 'apstiprināti',
  statThisYear: 'šogad',
  viewCta: 'Atvērt ierosinājumu',
  unsubscribe: 'Atteikties no iknedēļas atgādinājumiem',
  ignoreIfNotYou: 'Ja jūs to nepieprasījāt, ignorējiet šo e-pastu.',
};

const ru: Dict = {
  ...en,
  loginSubject: 'Ссылка для входа',
  loginHeading: 'Вход',
  loginBody:
    'Используйте ссылку ниже, чтобы войти. Она работает один раз и только с этого адреса.',
  loginCta: 'Войти',
  loginExpiry: 'Ссылка действует 15 минут.',
  fridaySubject: (w) => `Ваше предложение за неделю ${w}`,
  fridayHeading: 'На этой неделе предложение ещё не отправлено',
  fridayBody:
    'Одно предложение в неделю, и эта неделя открыта до вечера воскресенья. Оно не должно быть крупным — небольшое улучшение тоже важно.',
  fridayCta: 'Написать предложение',
  mondaySubject: (w) => `Последняя возможность за неделю ${w}`,
  mondayHeading: 'Неделя закрывается сегодня в полдень',
  mondayBody: (d) =>
    `Неделя ${d} находится в дополнительном окне. Отправьте предложение до полудня, и неделя будет зачтена.`,
  mondayCta: 'Отправить сейчас',
  recentlyImplemented: 'Недавно внедрено',
  statImplemented: 'внедрено',
  statAccepted: 'принято',
  statThisYear: 'за год',
  viewCta: 'Открыть предложение',
  unsubscribe: 'Отключить напоминания',
  ignoreIfNotYou: 'Если вы этого не запрашивали, просто проигнорируйте письмо.',
};

/** LT and KA fall back to EN until translations are supplied. */
export const COPY: Record<Locale, Dict> = { EN: en, LV: lv, RU: ru, LT: en, KA: en };
