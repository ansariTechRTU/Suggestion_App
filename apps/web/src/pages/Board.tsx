import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUp, Search } from 'lucide-react';
import { api, type Category, type Suggestion } from '../lib/api';
import { categoryName, shortDate } from '../lib/format';
import { Empty, PageHead, Spinner, StatusBadge } from '../components/ui';

export function Board() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [sort, setSort] = useState<'recent' | 'votes'>('recent');

  const categories = useQuery<{ items: Category[] }>({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories'),
  });

  const params = new URLSearchParams({ sort });
  if (term) params.set('q', term);
  if (categoryId) params.set('categoryId', categoryId);

  const board = useQuery<{ items: Suggestion[]; nextCursor: string | null; disabled?: boolean }>({
    queryKey: ['board', term, categoryId, sort],
    queryFn: () => api.get(`/suggestions/board?${params.toString()}`),
  });

  const vote = useMutation({
    mutationFn: (code: string) => api.post(`/suggestions/${code}/vote`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['board'] }),
  });

  return (
    <>
      <PageHead title={t('board.heading')} lead={t('board.lead')} />

      <form
        className="mb-5 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setTerm(q.trim());
        }}
      >
        <div className="relative min-w-[200px] flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('board.search')}
            className="field pl-9"
          />
        </div>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="field w-auto"
        >
          <option value="">{t('board.allCategories')}</option>
          {categories.data?.items.map((c) => (
            <option key={c.id} value={c.id}>
              {categoryName(c, i18n.resolvedLanguage ?? 'en')}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as 'recent' | 'votes')}
          className="field w-auto"
        >
          <option value="recent">{t('board.sortRecent')}</option>
          <option value="votes">{t('board.sortVotes')}</option>
        </select>
      </form>

      {board.isLoading ? (
        <Spinner label={t('common.loading')} />
      ) : board.data?.disabled ? (
        <Empty>{t('board.disabled')}</Empty>
      ) : !board.data?.items.length ? (
        <Empty>{t('board.empty')}</Empty>
      ) : (
        <div className="panel ruled overflow-hidden">
          {board.data.items.map((s) => (
            <div key={s.id} className="flex gap-4 px-5 py-4 hover:bg-navy-50/40">
              <button
                onClick={() => vote.mutate(s.referenceCode)}
                aria-label={t('detail.vote')}
                className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center border rounded-sm ${
                  s.hasVoted
                    ? 'border-starboard/30 bg-starboard-50 text-starboard'
                    : 'border-rule bg-white text-muted hover:border-navy-100 hover:text-navy-700'
                }`}
              >
                <ArrowUp size={13} />
                <span className="font-mono text-[12px] leading-none">{s.voteCount}</span>
              </button>

              <div className="min-w-0 flex-1">
                <Link to={`/suggestions/${s.referenceCode}`} className="block">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="stamp">{s.referenceCode}</span>
                    <StatusBadge status={s.status} />
                  </div>
                  <h3 className="mt-1 text-[15px] font-600 leading-snug">{s.title}</h3>
                  <div className="mt-1 flex flex-wrap gap-x-3 text-[13px] text-muted">
                    <span>{categoryName(s.category, i18n.resolvedLanguage ?? 'en')}</span>
                    <span>
                      {s.submitter.fullName ?? t('detail.anonymous')}
                    </span>
                    <span className="stamp">{shortDate(s.createdAt)}</span>
                  </div>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
