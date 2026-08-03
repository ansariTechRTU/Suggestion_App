import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api, type CycleView, type Suggestion } from '../lib/api';
import { categoryName, shortDate } from '../lib/format';
import { WatchStrip } from '../components/WatchStrip';
import { Empty, PageHead, Spinner, StatusBadge } from '../components/ui';

export function MyLog() {
  const { t, i18n } = useTranslation();

  const cycle = useQuery<CycleView>({
    queryKey: ['cycle'],
    queryFn: () => api.get<CycleView>('/suggestions/cycle/current'),
  });
  const mine = useQuery<{ items: Suggestion[] }>({
    queryKey: ['mine'],
    queryFn: () => api.get('/suggestions/mine'),
  });

  return (
    <>
      {cycle.data && <WatchStrip cycle={cycle.data} />}
      <PageHead title={t('mine.heading')} lead={t('mine.lead')} />

      {mine.isLoading ? (
        <Spinner label={t('common.loading')} />
      ) : !mine.data?.items.length ? (
        <Empty
          action={
            <Link to="/suggestions/new" className="btn-primary btn-sm">
              {t('mine.emptyCta')}
            </Link>
          }
        >
          {t('mine.empty')}
        </Empty>
      ) : (
        /* Logbook rows: a hairline rule between entries, no cards. */
        <div className="panel ruled overflow-hidden">
          {mine.data.items.map((s) => (
            <Link
              key={s.id}
              to={`/suggestions/${s.referenceCode}`}
              className="flex flex-wrap items-baseline gap-x-4 gap-y-2 px-5 py-4 hover:bg-navy-50/60"
            >
              <span className="stamp w-[104px] shrink-0">{s.referenceCode}</span>
              <span className="min-w-[220px] flex-1 text-[15px] font-500 leading-snug">
                {s.title}
              </span>
              <span className="text-[13px] text-muted">
                {categoryName(s.category, i18n.resolvedLanguage ?? 'en')}
              </span>
              {s.cycle && (
                <span className="stamp">
                  W{String(s.cycle.isoWeek).padStart(2, '0')}
                </span>
              )}
              <span className="stamp hidden sm:inline">{shortDate(s.createdAt)}</span>
              <StatusBadge status={s.status} />
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
