import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api, type Suggestion } from '../../lib/api';
import { categoryName, shortDate } from '../../lib/format';
import { Empty, PageHead, Spinner, StatusBadge } from '../../components/ui';

type Filter = 'all' | 'unassigned' | 'overdue';

export function AdminQueue() {
  const { t, i18n } = useTranslation();
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');

  const params = new URLSearchParams({ sort: 'recent', limit: '50' });
  if (filter === 'unassigned') params.set('unassigned', 'true');
  if (filter === 'overdue') params.set('overdue', 'true');
  if (q) params.set('q', q);

  const queue = useQuery<{ items: Suggestion[] }>({
    queryKey: ['queue', filter, q],
    queryFn: () => api.get(`/admin/suggestions?${params.toString()}`),
  });

  return (
    <>
      <PageHead
        title={t('admin.queue')}
        lead={t('admin.queueLead', { days: 20 })}
        action={
          <div className="flex gap-1">
            {(['all', 'unassigned', 'overdue'] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`btn-sm rounded-sm font-display font-600 ${
                  filter === f ? 'bg-navy-700 text-white' : 'border border-rule bg-white text-muted'
                }`}
              >
                {t(`admin.filters.${f}`)}
              </button>
            ))}
          </div>
        }
      />

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t('board.search')}
        className="field mb-5 max-w-sm"
      />

      {queue.isLoading ? (
        <Spinner label={t('common.loading')} />
      ) : !queue.data?.items.length ? (
        <Empty>—</Empty>
      ) : (
        <div className="panel ruled overflow-hidden">
          {queue.data.items.map((s) => {
            const overdue = s.dueDate && new Date(s.dueDate) < new Date();
            return (
              <Link
                key={s.id}
                to={`/suggestions/${s.referenceCode}`}
                className="flex flex-wrap items-baseline gap-x-4 gap-y-2 px-5 py-4 hover:bg-navy-50/60"
              >
                <span className="stamp w-[104px] shrink-0">{s.referenceCode}</span>
                <span className="min-w-[200px] flex-1 text-[15px] font-500 leading-snug">
                  {s.title}
                </span>
                <span className="text-[13px] text-muted">
                  {categoryName(s.category, i18n.resolvedLanguage ?? 'en')}
                </span>
                <span className="text-[13px] text-muted">
                  {s.assignee?.fullName ?? '—'}
                </span>
                {s.dueDate && (
                  <span className={`stamp ${overdue ? 'text-port' : ''}`}>
                    {shortDate(s.dueDate)}
                  </span>
                )}
                <StatusBadge status={s.status} />
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
