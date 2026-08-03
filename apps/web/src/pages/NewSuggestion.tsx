import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, type Category, type CycleView } from '../lib/api';
import { categoryName } from '../lib/format';
import { WatchStrip } from '../components/WatchStrip';
import { ErrorNote, PageHead, Spinner } from '../components/ui';

export function NewSuggestion() {
  const { t, i18n } = useTranslation();
  const nav = useNavigate();
  const qc = useQueryClient();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);

  const cycle = useQuery<CycleView>({
    queryKey: ['cycle'],
    queryFn: () => api.get<CycleView>('/suggestions/cycle/current'),
  });
  const categories = useQuery<{ items: Category[] }>({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories'),
  });

  const create = useMutation({
    mutationFn: () =>
      api.post<{ referenceCode: string }>('/suggestions', {
        title,
        body,
        categoryId,
        isAnonymous,
      }),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ['cycle'] });
      void qc.invalidateQueries({ queryKey: ['mine'] });
      nav(`/suggestions/${res.referenceCode}`);
    },
  });

  if (cycle.isLoading || categories.isLoading) return <Spinner label={t('common.loading')} />;

  const alreadyLogged =
    cycle.data?.quotaEnabled &&
    (cycle.data.myStatus === 'SUBMITTED_ON_TIME' || cycle.data.myStatus === 'SUBMITTED_IN_GRACE');

  const err = create.error instanceof ApiError ? create.error : null;
  const anonymityOn = true;

  return (
    <>
      {cycle.data && <WatchStrip cycle={cycle.data} />}

      <PageHead eyebrow={t('watch.week')} title={t('form.heading')} lead={t('form.lead')} />

      {alreadyLogged && cycle.data?.mySubmission ? (
        <div className="panel px-6 py-7">
          <p className="text-[15px]">{t('form.quotaReached')}</p>
          <Link
            to={`/suggestions/${cycle.data.mySubmission.referenceCode}`}
            className="btn-ghost btn-sm mt-4"
          >
            {t('form.viewExisting')}
          </Link>
        </div>
      ) : (
        <form
          className="panel px-6 py-6"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          {err && (
            <div className="mb-5">
              <ErrorNote>{err.message}</ErrorNote>
            </div>
          )}

          <label htmlFor="title" className="eyebrow mb-1.5 block">
            {t('form.title')}
          </label>
          <input
            id="title"
            required
            minLength={8}
            maxLength={140}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('form.titlePlaceholder')}
            className="field"
          />
          {err?.details?.title && <p className="mt-1 text-[13px] text-port">{err.details.title}</p>}

          <label htmlFor="category" className="eyebrow mb-1.5 mt-5 block">
            {t('form.category')}
          </label>
          <select
            id="category"
            required
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="field"
          >
            <option value="">{t('form.categoryPlaceholder')}</option>
            {categories.data?.items.map((c) => (
              <option key={c.id} value={c.id}>
                {categoryName(c, i18n.resolvedLanguage ?? 'en')}
              </option>
            ))}
          </select>

          <label htmlFor="body" className="eyebrow mb-1.5 mt-5 block">
            {t('form.body')}
          </label>
          <textarea
            id="body"
            required
            minLength={40}
            maxLength={4000}
            rows={8}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t('form.bodyPlaceholder')}
            className="field resize-y leading-relaxed"
          />
          <div className="mt-1 flex justify-between">
            <span className="text-[13px] text-port">{err?.details?.body}</span>
            <span className="stamp">{t('form.chars', { count: body.length })}</span>
          </div>

          {anonymityOn && (
            <div className="mt-5 border-t border-rule pt-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[var(--color-navy-700)]"
                />
                <span>
                  <span className="block text-[15px] font-500">{t('form.anonymous')}</span>
                  <span className="mt-0.5 block text-[13px] leading-relaxed text-muted">
                    {t('form.anonymousHint')}
                  </span>
                </span>
              </label>
            </div>
          )}

          <button type="submit" disabled={create.isPending} className="btn-primary mt-6">
            {create.isPending ? t('form.submitting') : t('form.submit')}
          </button>
        </form>
      )}
    </>
  );
}
