import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUp, Eye, Lock } from 'lucide-react';
import { ALLOWED_TRANSITIONS, REASON_REQUIRED_FOR, type SuggestionStatus } from '@nk/shared';
import { api, ApiError, type Me, type Suggestion } from '../lib/api';
import { categoryName, dateTime, shortDate, statusLabel } from '../lib/format';
import { ErrorNote, PageHead, Spinner, StatusBadge } from '../components/ui';

export function SuggestionDetail({ me }: { me: Me }) {
  const { code = '' } = useParams();
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [comment, setComment] = useState('');
  const [internal, setInternal] = useState(false);

  const q = useQuery<Suggestion>({
    queryKey: ['suggestion', code],
    queryFn: () => api.get<Suggestion>(`/suggestions/${code}`),
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['suggestion', code] });
    void qc.invalidateQueries({ queryKey: ['mine'] });
    void qc.invalidateQueries({ queryKey: ['queue'] });
  };

  const vote = useMutation({
    mutationFn: () => api.post(`/suggestions/${code}/vote`),
    onSuccess: refresh,
  });

  const addComment = useMutation({
    mutationFn: () => api.post(`/suggestions/${code}/comments`, { body: comment, isInternal: internal }),
    onSuccess: () => {
      setComment('');
      setInternal(false);
      refresh();
    },
  });

  const withdraw = useMutation({
    mutationFn: () => api.del(`/suggestions/${code}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['cycle'] });
      nav('/suggestions/mine');
    },
  });

  if (q.isLoading) return <Spinner label={t('common.loading')} />;
  if (q.error) return <ErrorNote>{(q.error as ApiError).message}</ErrorNote>;
  const s = q.data!;
  const isAdmin = me.user.role === 'ADMIN';

  return (
    <>
      <PageHead
        eyebrow={`${t('detail.reference')} ${s.referenceCode}`}
        title={s.title}
        action={<StatusBadge status={s.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
        <div className="space-y-6">
          <div className="panel px-5 py-5">
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{s.body}</p>

            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-rule pt-4">
              <span className="stamp">
                {categoryName(s.category, i18n.resolvedLanguage ?? 'en')}
              </span>
              <span className="stamp">{shortDate(s.createdAt)}</span>
              {s.cycle && <span className="stamp">W{String(s.cycle.isoWeek).padStart(2, '0')}</span>}
              {s.submittedInGrace && <span className="stamp text-amber">{t('watch.monday')}</span>}
              <span className="ml-auto flex items-center gap-3">
                {s.hasVoted !== undefined && (
                  <button
                    onClick={() => vote.mutate()}
                    className={`btn-sm flex items-center gap-1.5 border rounded-sm ${
                      s.hasVoted
                        ? 'border-starboard/30 bg-starboard-50 text-starboard'
                        : 'border-rule bg-white text-muted hover:text-navy-700'
                    }`}
                  >
                    <ArrowUp size={13} />
                    {s.voteCount}
                  </button>
                )}
              </span>
            </div>

            {s.isOwn && s.status === 'SUBMITTED' && (
              <button
                onClick={() => {
                  if (confirm(t('mine.withdrawConfirm'))) withdraw.mutate();
                }}
                className="mt-4 text-[13px] text-port hover:underline"
              >
                {t('mine.withdraw')}
              </button>
            )}
          </div>

          {/* The official response. Given its own panel because it is the point. */}
          <div className="panel px-5 py-5">
            <div className="eyebrow">{t('detail.response')}</div>
            {s.responseBody ? (
              <>
                <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed">
                  {s.responseBody}
                </p>
                {s.respondedAt && <div className="stamp mt-3">{dateTime(s.respondedAt)}</div>}
              </>
            ) : (
              <p className="mt-2 text-[14px] text-muted">{t('detail.noResponse')}</p>
            )}
          </div>

          {isAdmin && <AdminPanel s={s} onDone={refresh} />}

          <div className="panel px-5 py-5">
            <div className="eyebrow">{t('detail.comments')}</div>
            <div className="mt-3 space-y-3">
              {s.comments.length === 0 && <p className="text-[14px] text-muted">—</p>}
              {s.comments.map((c) => (
                <div
                  key={c.id}
                  className={`border-l-2 pl-3 ${c.isInternal ? 'border-amber' : 'border-rule'}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-500">{c.author?.fullName ?? '—'}</span>
                    <span className="stamp">{dateTime(c.createdAt)}</span>
                    {c.isInternal && (
                      <span className="stamp flex items-center gap-1 text-amber">
                        <Lock size={10} /> internal
                      </span>
                    )}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-[14px] leading-relaxed">{c.body}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 border-t border-rule pt-4">
              <textarea
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t('detail.commentPlaceholder')}
                className="field"
              />
              <div className="mt-2 flex items-center justify-between gap-3">
                {isAdmin ? (
                  <label className="flex items-center gap-2 text-[13px] text-muted">
                    <input
                      type="checkbox"
                      checked={internal}
                      onChange={(e) => setInternal(e.target.checked)}
                      className="h-3.5 w-3.5 accent-[var(--color-amber)]"
                    />
                    {t('detail.internal')}
                  </label>
                ) : (
                  <span />
                )}
                <button
                  onClick={() => addComment.mutate()}
                  disabled={comment.trim().length < 2 || addComment.isPending}
                  className="btn-ghost btn-sm"
                >
                  {t('detail.addComment')}
                </button>
              </div>
            </div>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="panel px-5 py-5">
            <div className="eyebrow">{t('detail.submittedBy')}</div>
            <div className="mt-1.5 text-[14px]">
              {s.isAnonymous && !s.submitter.fullName ? (
                <span className="text-muted">{t('detail.anonymous')}</span>
              ) : (
                <>
                  <div className="font-500">{s.submitter.fullName}</div>
                  <div className="stamp">{s.submitter.division}</div>
                </>
              )}
            </div>
            {isAdmin && s.isAnonymous && !s.submitter.fullName && <Reveal code={s.referenceCode} />}

            {s.assignee && (
              <>
                <div className="eyebrow mt-4">{t('detail.assignedTo')}</div>
                <div className="mt-1 text-[14px] font-500">{s.assignee.fullName}</div>
              </>
            )}
            {s.dueDate && (
              <>
                <div className="eyebrow mt-4">{t('detail.due')}</div>
                <div className="mt-1 font-mono text-[13px]">{shortDate(s.dueDate)}</div>
              </>
            )}
            {isAdmin && s.qmsActionRef && (
              <>
                <div className="eyebrow mt-4">ISO 9001</div>
                <div className="mt-1 font-mono text-[13px]">{s.qmsActionRef}</div>
              </>
            )}
          </div>

          {/* Status history, drawn as a vertical log rather than a list. */}
          <div className="panel px-5 py-5">
            <div className="eyebrow">{t('detail.timeline')}</div>
            <ol className="mt-3 space-y-4">
              {s.statusHistory.map((h) => (
                <li key={h.id} className="relative border-l border-rule pl-4">
                  <span
                    aria-hidden
                    className="absolute -left-[4px] top-1.5 h-[7px] w-[7px] bg-navy-700 rounded-full"
                  />
                  <div className="font-display text-[12px] font-600 uppercase tracking-[0.08em] text-navy-700">
                    {statusLabel(h.toStatus)}
                  </div>
                  <div className="stamp">{dateTime(h.changedAt)}</div>
                  {h.changedBy && <div className="text-[13px] text-muted">{h.changedBy.fullName}</div>}
                  {h.reason && (
                    <p className="mt-1 text-[13px] leading-relaxed text-ink">{h.reason}</p>
                  )}
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </>
  );
}

/** Revealing an anonymous submitter is a deliberate, audited action. */
function Reveal({ code }: { code: string }) {
  const { t } = useTranslation();
  const [shown, setShown] = useState<{ fullName: string; email: string } | null>(null);
  const m = useMutation({
    mutationFn: () => api.post<{ submitter: { fullName: string; email: string } }>(
      `/admin/suggestions/${code}/reveal`,
    ),
    onSuccess: (r) => setShown(r.submitter),
  });

  if (shown) {
    return (
      <div className="mt-3 border border-amber/30 bg-amber-50 px-3 py-2 text-[13px] rounded-sm">
        <div className="font-500">{shown.fullName}</div>
        <div className="stamp">{shown.email}</div>
      </div>
    );
  }
  return (
    <button
      onClick={() => {
        if (confirm(t('detail.revealWarn'))) m.mutate();
      }}
      className="mt-3 flex items-center gap-1.5 text-[13px] text-muted hover:text-navy-700"
    >
      <Eye size={13} /> {t('detail.reveal')}
    </button>
  );
}

/** Admin controls, inline on the detail page — deciding and reading go together. */
function AdminPanel({ s, onDone }: { s: Suggestion; onDone: () => void }) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [qms, setQms] = useState(s.qmsActionRef ?? '');
  const [response, setResponse] = useState(s.responseBody ?? '');
  const [assigneeId, setAssigneeId] = useState(s.assignee?.id ?? '');

  const people = useQuery<{ items: Array<{ id: string; fullName: string; isActive: boolean }> }>({
    queryKey: ['admin-users'],
    queryFn: () => api.get('/admin/users'),
  });

  const setStatus = useMutation({
    mutationFn: (to: SuggestionStatus) =>
      api.patch(`/admin/suggestions/${s.referenceCode}/status`, {
        toStatus: to,
        reason: reason || undefined,
        qmsActionRef: qms || undefined,
      }),
    onSuccess: () => {
      setReason('');
      onDone();
    },
  });

  const saveResponse = useMutation({
    mutationFn: () =>
      api.post(`/admin/suggestions/${s.referenceCode}/response`, { responseBody: response }),
    onSuccess: onDone,
  });

  const saveAssignee = useMutation({
    mutationFn: () =>
      api.patch(`/admin/suggestions/${s.referenceCode}/assign`, {
        assigneeId: assigneeId || null,
      }),
    onSuccess: onDone,
  });

  const next = ALLOWED_TRANSITIONS[s.status as SuggestionStatus] ?? [];
  const err = setStatus.error instanceof ApiError ? setStatus.error : null;

  return (
    <div className="panel border-navy-100 px-5 py-5">
      <div className="eyebrow text-navy-700">{t('admin.changeStatus')}</div>

      {err && (
        <div className="mt-3">
          <ErrorNote>{err.message}</ErrorNote>
        </div>
      )}

      {next.length === 0 ? (
        <p className="mt-2 text-[14px] text-muted">This suggestion is closed.</p>
      ) : (
        <>
          <textarea
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('admin.reason')}
            className="field mt-3"
          />
          <p className="mt-1 text-[12px] text-muted">{t('admin.reasonRequired')}</p>

          {next.includes('IMPLEMENTED') || next.includes('ACCEPTED') ? (
            <input
              value={qms}
              onChange={(e) => setQms(e.target.value)}
              placeholder={t('admin.qms')}
              className="field mt-3 font-mono text-[13px]"
            />
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2">
            {next.map((to) => {
              const needsReason = REASON_REQUIRED_FOR.includes(to);
              return (
                <button
                  key={to}
                  onClick={() => setStatus.mutate(to)}
                  disabled={setStatus.isPending || (needsReason && reason.trim().length === 0)}
                  className="btn-ghost btn-sm"
                >
                  {statusLabel(to)}
                </button>
              );
            })}
          </div>
        </>
      )}

      <div className="mt-5 grid gap-4 border-t border-rule pt-4 sm:grid-cols-2">
        <div>
          <label className="eyebrow mb-1.5 block">{t('admin.assign')}</label>
          <select
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            className="field"
          >
            <option value="">—</option>
            {people.data?.items
              .filter((p) => p.isActive)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName}
                </option>
              ))}
          </select>
          <button onClick={() => saveAssignee.mutate()} className="btn-ghost btn-sm mt-2">
            {t('common.save')}
          </button>
        </div>
      </div>

      <div className="mt-5 border-t border-rule pt-4">
        <label className="eyebrow mb-1.5 block">{t('admin.respond')}</label>
        <textarea
          rows={4}
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          className="field"
        />
        <button
          onClick={() => saveResponse.mutate()}
          disabled={response.trim().length < 10 || saveResponse.isPending}
          className="btn-primary btn-sm mt-2"
        >
          {t('common.save')}
        </button>
      </div>
    </div>
  );
}
