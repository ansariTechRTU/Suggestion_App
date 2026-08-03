import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Play } from 'lucide-react';
import { api } from '../../lib/api';
import { dateTime } from '../../lib/format';
import { PageHead, Spinner, Stat, Toggle } from '../../components/ui';

interface Dashboard {
  stats: {
    implementedThisYear: number;
    acceptedThisYear: number;
    openCount: number;
    overdueCount: number;
  };
  byStatus: Array<{ status: string; count: number }>;
  cycles: Array<{
    id: string;
    isoYear: number;
    isoWeek: number;
    status: string;
    suggestions: number;
    onTime: number;
    inGrace: number;
    missed: number;
    pending: number;
    exempt: number;
  }>;
  lastRuns: Array<{
    id: string;
    template: string;
    recipientsCount: number;
    skippedCount: number;
    failedCount: number;
    startedAt: string;
  }>;
}

const JOBS = [
  { name: 'reminder.friday', label: 'Friday reminder' },
  { name: 'reminder.monday', label: 'Monday reminder' },
  { name: 'cycle.open', label: 'Open this week' },
  { name: 'cycle.close', label: 'Close last week' },
];

const TOGGLES: Array<{ key: string; label: string; hint: string }> = [
  { key: 'quota.enabled', label: 'Weekly quota', hint: 'One suggestion per person per week.' },
  {
    key: 'leaderboard.visibleToStaff',
    label: 'Rank list open to staff',
    hint: 'Off means administrators only.',
  },
  {
    key: 'leaderboard.showNamesToStaff',
    label: 'Show names on the rank list',
    hint: 'Off replaces colleagues with “Colleague”. Staff always see their own row.',
  },
  {
    key: 'leaderboard.showMissesToStaff',
    label: 'Show missed weeks to staff',
    hint: 'Recommended off at launch. Publishing individual miss counts is what makes a board punitive.',
  },
  { key: 'board.enabled', label: 'Board open', hint: 'Staff can read all suggestions.' },
  { key: 'board.votingEnabled', label: 'Voting', hint: 'Staff can support suggestions.' },
  {
    key: 'anonymity.enabled',
    label: 'Anonymous submissions',
    hint: 'Identity is still recorded and any reveal is audited.',
  },
];

export function AdminControls() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [ran, setRan] = useState<string | null>(null);

  const dash = useQuery<Dashboard>({
    queryKey: ['admin-dashboard'],
    queryFn: () => api.get('/admin/dashboard'),
  });
  const settings = useQuery<Record<string, boolean | number | string>>({
    queryKey: ['admin-settings'],
    queryFn: () => api.get('/admin/settings'),
  });

  const patch = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.patch('/admin/settings', body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-settings'] });
      void qc.invalidateQueries({ queryKey: ['me'] });
    },
  });

  const runJob = useMutation({
    mutationFn: (name: string) => api.post(`/admin/jobs/${name}/run`),
    onSuccess: (_r, name) => {
      setRan(name);
      void qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
      setTimeout(() => setRan(null), 2500);
    },
  });

  if (dash.isLoading || settings.isLoading) return <Spinner label={t('common.loading')} />;

  return (
    <>
      <PageHead eyebrow={t('admin.dashboard')} title={t('admin.settingsHeading')} />

      <div className="panel mb-6 flex flex-wrap gap-x-10 gap-y-5 px-5 py-5">
        <Stat value={dash.data!.stats.openCount} label="open" />
        <Stat value={dash.data!.stats.acceptedThisYear} label="accepted this year" />
        <Stat value={dash.data!.stats.implementedThisYear} label="implemented this year" />
        <Stat
          value={
            <span className={dash.data!.stats.overdueCount > 0 ? 'text-port' : undefined}>
              {dash.data!.stats.overdueCount}
            </span>
          }
          label="overdue"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="panel px-5 py-5">
          <div className="eyebrow">{t('admin.settingsHeading')}</div>
          <div className="mt-1 divide-y divide-[var(--color-rule)]">
            {TOGGLES.map((tg) => (
              <Toggle
                key={tg.key}
                checked={settings.data?.[tg.key] === true}
                onChange={(v) => patch.mutate({ [tg.key]: v })}
                label={tg.label}
                hint={tg.hint}
              />
            ))}
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3 border-t border-rule pt-4">
            {[
              { key: 'reminder.fridayHour', label: 'Fri hour' },
              { key: 'reminder.mondayHour', label: 'Mon hour' },
              { key: 'cycle.graceEndHour', label: 'Grace ends' },
            ].map((f) => (
              <label key={f.key} className="block">
                <span className="eyebrow mb-1 block">{f.label}</span>
                <input
                  type="number"
                  min={0}
                  max={23}
                  defaultValue={Number(settings.data?.[f.key] ?? 0)}
                  onBlur={(e) => patch.mutate({ [f.key]: Number(e.target.value) })}
                  className="field font-mono"
                />
              </label>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-muted">
            Hour changes take effect at the next scheduler restart.
          </p>
        </div>

        <div className="space-y-6">
          <div className="panel px-5 py-5">
            <div className="eyebrow">{t('admin.runJob')}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {JOBS.map((j) => (
                <button
                  key={j.name}
                  onClick={() => runJob.mutate(j.name)}
                  disabled={runJob.isPending}
                  className="btn-ghost btn-sm"
                >
                  <Play size={12} />
                  {j.label}
                  {ran === j.name && <span className="text-starboard">✓</span>}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[12px] text-muted">
              With MAIL_DRY_RUN on, reminders print to the API console instead of sending.
            </p>

            <div className="mt-4 border-t border-rule pt-3">
              <div className="eyebrow mb-2">Last runs</div>
              {dash.data!.lastRuns.length === 0 && <p className="text-[13px] text-muted">—</p>}
              {dash.data!.lastRuns.map((r) => (
                <div key={r.id} className="flex justify-between py-1 text-[13px]">
                  <span className="stamp">{r.template}</span>
                  <span className="font-mono text-[12px] text-muted">
                    {r.recipientsCount} sent · {r.skippedCount} skipped · {r.failedCount} failed ·{' '}
                    {dateTime(r.startedAt)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="panel px-5 py-5">
            <div className="eyebrow">{t('admin.cycles')}</div>
            <table className="mt-3 w-full text-[13px]">
              <thead>
                <tr className="border-b border-rule text-left">
                  <th className="eyebrow py-1.5">Week</th>
                  <th className="eyebrow py-1.5 text-right">{t('admin.onTime')}</th>
                  <th className="eyebrow py-1.5 text-right">{t('admin.inGrace')}</th>
                  <th className="eyebrow py-1.5 text-right">{t('admin.missed')}</th>
                  <th className="eyebrow py-1.5 text-right">{t('admin.pending')}</th>
                </tr>
              </thead>
              <tbody>
                {dash.data!.cycles.map((c) => (
                  <tr key={c.id} className="border-b border-rule last:border-0">
                    <td className="py-1.5 font-mono">
                      {c.isoYear}-W{String(c.isoWeek).padStart(2, '0')}
                      {c.status !== 'CLOSED' && (
                        <span className="stamp ml-2 text-amber">{c.status.toLowerCase()}</span>
                      )}
                    </td>
                    <td className="py-1.5 text-right font-mono">{c.onTime}</td>
                    <td className="py-1.5 text-right font-mono text-amber">{c.inGrace}</td>
                    <td className="py-1.5 text-right font-mono text-port">{c.missed}</td>
                    <td className="py-1.5 text-right font-mono text-muted">{c.pending}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
