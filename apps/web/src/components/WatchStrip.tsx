import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Check } from 'lucide-react';
import type { CycleView } from '../lib/api';
import { until } from '../lib/format';

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/**
 * The signature element: one week as a strip of day ticks, with the Friday
 * reminder and Monday grace deadline marked where they actually fall. Staff on a
 * watch rotation read a week like this already — the deadline structure is the
 * information, so it is drawn rather than described.
 */
export function WatchStrip({ cycle }: { cycle: CycleView }) {
  const { t } = useTranslation();
  const logged = cycle.myStatus === 'SUBMITTED_ON_TIME' || cycle.myStatus === 'SUBMITTED_IN_GRACE';
  const exempt = cycle.myStatus === 'EXEMPT';

  // Monday = 0 … Sunday = 6, in the reader's own week.
  const todayIdx = (new Date().getDay() + 6) % 7;

  return (
    <div className="panel mb-6 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 pt-4">
        <div>
          <div className="eyebrow">{t('watch.eyebrow')}</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-[15px] font-500 text-navy-700">{cycle.label}</span>
            <span className="text-[13px] text-muted">
              {logged || exempt ? t('watch.openUntil') : t('watch.closesIn', { time: until(cycle.endsAt) })}
            </span>
          </div>
        </div>

        {exempt ? (
          <span className="stamp">{t('watch.exempt')}</span>
        ) : logged && cycle.mySubmission ? (
          <Link
            to={`/suggestions/${cycle.mySubmission.referenceCode}`}
            className="group flex items-center gap-2 text-right"
          >
            <span className="flex h-6 w-6 items-center justify-center bg-starboard text-white rounded-full">
              <Check size={13} strokeWidth={3} />
            </span>
            <span>
              <span className="block font-display text-[13px] font-600 text-starboard">
                {t('watch.logged')}
              </span>
              <span className="stamp group-hover:text-navy-700">
                {cycle.mySubmission.referenceCode}
              </span>
            </span>
          </Link>
        ) : (
          <Link to="/suggestions/new" className="btn-primary btn-sm">
            {t('form.submit')}
          </Link>
        )}
      </div>

      {/* Day ticks. Amber marks Friday's reminder, navy marks Sunday's deadline. */}
      <div className="mt-4 flex items-end gap-1 px-5">
        {DAYS.map((d, i) => {
          const isFri = i === 4;
          const isSun = i === 6;
          const past = i < todayIdx;
          const isToday = i === todayIdx;
          return (
            <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
              <span
                className={`font-mono text-[10px] ${
                  isToday ? 'font-500 text-navy-700' : 'text-muted/70'
                }`}
              >
                {d}
              </span>
              <span
                aria-hidden
                className={`h-[3px] w-full rounded-full ${
                  logged || exempt
                    ? 'bg-starboard/35'
                    : isSun
                      ? 'bg-navy-700'
                      : isFri
                        ? 'bg-amber'
                        : past
                          ? 'bg-navy-100'
                          : 'bg-rule'
                }`}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex justify-between px-5 pb-4">
        <span className="stamp flex items-center gap-1.5">
          <span aria-hidden className="h-2 w-2 bg-amber rounded-full" />
          {t('watch.friday')}
        </span>
        <span className="stamp flex items-center gap-1.5">
          <span aria-hidden className="h-2 w-2 bg-navy-700 rounded-full" />
          {t('watch.close')}
        </span>
      </div>

      {/* The Monday rescue. Only shown while it is genuinely actionable. */}
      {cycle.graceOpen && cycle.graceCycle && (
        <div className="flex flex-wrap items-center gap-3 border-t border-amber/30 bg-amber-50 px-5 py-3">
          <AlertTriangle size={16} className="text-amber" />
          <div className="flex-1">
            <div className="font-display text-[13px] font-600 text-amber">
              {t('watch.graceHeading', { week: cycle.graceCycle.label })}
            </div>
            <div className="text-[13px] text-muted">
              {t('watch.graceLead')}{' '}
              <span className="font-mono">
                {t('watch.graceLeft', { time: until(cycle.graceCycle.graceEndsAt) })}
              </span>
            </div>
          </div>
          <Link to="/suggestions/new" className="btn-ghost btn-sm">
            {t('watch.monday')}
          </Link>
        </div>
      )}
    </div>
  );
}
