import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Flame, Info } from 'lucide-react';
import { api, ApiError, type LeaderboardResponse } from '../lib/api';
import { Empty, ErrorNote, PageHead, Spinner } from '../components/ui';

type Period = 'quarter' | 'year' | 'all';

export function Ranks() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<Period>('quarter');
  const [showHow, setShowHow] = useState(false);

  const q = useQuery<LeaderboardResponse>({
    queryKey: ['ranks', period],
    queryFn: () => api.get(`/leaderboard?period=${period}`),
    retry: false,
  });

  if (q.error instanceof ApiError && q.error.status === 403) {
    return (
      <>
        <PageHead title={t('ranks.heading')} />
        <Empty>{t('ranks.closed')}</Empty>
      </>
    );
  }

  return (
    <>
      <PageHead
        title={t('ranks.heading')}
        lead={t('ranks.lead')}
        action={
          <div className="flex gap-1">
            {(['quarter', 'year', 'all'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`btn-sm rounded-sm font-display font-600 ${
                  period === p ? 'bg-navy-700 text-white' : 'border border-rule bg-white text-muted'
                }`}
              >
                {t(`ranks.period.${p}`)}
              </button>
            ))}
          </div>
        }
      />

      {q.error && <ErrorNote>{(q.error as ApiError).message}</ErrorNote>}

      {q.data?.me && (
        <div className="panel mb-5 flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <div className="eyebrow">{t('ranks.heading')}</div>
            <div className="mt-0.5 font-display text-[17px] font-600 text-navy-700">
              {t('ranks.you', { rank: q.data.me.rank, of: q.data.me.of })}
            </div>
          </div>
          <button
            onClick={() => setShowHow((v) => !v)}
            className="flex items-center gap-1.5 text-[13px] text-muted hover:text-navy-700"
          >
            <Info size={14} /> {t('ranks.how')}
          </button>
        </div>
      )}

      {showHow && q.data && (
        <div className="panel mb-5 px-5 py-4">
          <div className="eyebrow">{t('ranks.how')}</div>
          <ul className="mt-2 space-y-1 text-[14px]">
            {Object.entries(q.data.points).map(([k, v]) => (
              <li key={k} className="flex justify-between border-b border-rule py-1 last:border-0">
                <span className="text-muted">{k.replace(/([A-Z])/g, ' $1').toLowerCase()}</span>
                <span className="font-mono">{v > 0 ? `+${v}` : v}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {q.data?.visibility.namesHidden && (
        <p className="mb-3 text-[13px] text-muted">{t('ranks.hiddenNames')}</p>
      )}
      {q.data?.visibility.missesHidden && (
        <p className="mb-3 text-[13px] text-muted">{t('ranks.hiddenMisses')}</p>
      )}

      {q.isLoading ? (
        <Spinner label={t('common.loading')} />
      ) : !q.data?.items.length ? (
        <Empty>—</Empty>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-[14px]">
            <thead>
              <tr className="border-b border-rule">
                <Th className="w-12">{t('ranks.columns.rank')}</Th>
                <Th>{t('ranks.columns.name')}</Th>
                <Th right>{t('ranks.columns.submitted')}</Th>
                <Th right>{t('ranks.columns.missed')}</Th>
                <Th right>{t('ranks.columns.accepted')}</Th>
                <Th right>{t('ranks.columns.implemented')}</Th>
                <Th right>{t('ranks.columns.rate')}</Th>
                <Th right>{t('ranks.columns.streak')}</Th>
                <Th right>{t('ranks.columns.score')}</Th>
              </tr>
            </thead>
            <tbody>
              {q.data.items.map((r) => (
                <tr
                  key={`${r.rank}-${r.userId ?? r.fullName ?? Math.random()}`}
                  className={`border-b border-rule last:border-0 ${
                    r.isMe ? 'bg-navy-50/70' : ''
                  }`}
                >
                  <td className="px-4 py-2.5 font-mono text-[13px] text-muted">{r.rank}</td>
                  <td className="px-4 py-2.5">
                    <span className={r.isMe ? 'font-600 text-navy-700' : 'font-500'}>
                      {r.fullName ?? t('ranks.anon')}
                    </span>
                    {r.department && <span className="stamp ml-2">{r.department}</span>}
                  </td>
                  <Td right>{r.submitted}</Td>
                  <Td right tone={r.missed && r.missed > 0 ? 'port' : undefined}>
                    {r.missed ?? '—'}
                  </Td>
                  <Td right>{r.accepted}</Td>
                  <Td right tone={r.implemented > 0 ? 'starboard' : undefined}>
                    {r.implemented}
                  </Td>
                  <Td right>{r.acceptanceRate}%</Td>
                  <td className="px-4 py-2.5 text-right font-mono text-[13px]">
                    {r.currentStreak > 2 ? (
                      <span className="inline-flex items-center gap-1 text-amber">
                        <Flame size={12} />
                        {r.currentStreak}
                      </span>
                    ) : (
                      r.currentStreak
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right font-display font-700 text-navy-700">
                    {r.score}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Th({
  children,
  right,
  className = '',
}: {
  children: string;
  right?: boolean;
  className?: string;
}) {
  return (
    <th
      className={`px-4 py-2.5 font-display text-[10px] font-700 uppercase tracking-[0.12em]
        text-muted ${right ? 'text-right' : 'text-left'} ${className}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  right,
  tone,
}: {
  children: React.ReactNode;
  right?: boolean;
  tone?: 'port' | 'starboard';
}) {
  const color = tone === 'port' ? 'text-port' : tone === 'starboard' ? 'text-starboard' : '';
  return (
    <td className={`px-4 py-2.5 font-mono text-[13px] ${right ? 'text-right' : ''} ${color}`}>
      {children}
    </td>
  );
}
