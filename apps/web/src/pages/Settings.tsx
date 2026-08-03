import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type Me } from '../lib/api';
import { setLanguage } from '../lib/i18n';
import { PageHead, Toggle } from '../components/ui';

const LANGS = [
  { code: 'EN', label: 'English' },
  { code: 'LV', label: 'Latviešu' },
  { code: 'RU', label: 'Русский' },
];

export function Settings({ me }: { me: Me }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: (patch: Record<string, unknown>) => api.patch('/me/preferences', patch),
    onSuccess: () => {
      setSaved(true);
      void qc.invalidateQueries({ queryKey: ['me'] });
      setTimeout(() => setSaved(false), 2000);
    },
  });

  return (
    <>
      <PageHead title={t('settings.heading')} />

      {params.get('unsubscribed') === '1' && (
        <div className="panel mb-5 border-amber/30 bg-amber-50 px-5 py-3 text-[14px] text-amber">
          {t('settings.unsubscribed')}
        </div>
      )}

      <div className="panel max-w-xl px-5 py-5">
        <div className="eyebrow">{t('settings.language')}</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => {
                setLanguage(l.code.toLowerCase());
                save.mutate({ locale: l.code });
              }}
              className={`btn-sm rounded-sm font-display font-600 ${
                me.user.locale === l.code
                  ? 'bg-navy-700 text-white'
                  : 'border border-rule bg-white text-muted'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>

        <div className="mt-6 border-t border-rule pt-2">
          <Toggle
            checked={me.user.remindersEnabled}
            onChange={(v) => save.mutate({ remindersEnabled: v })}
            label={t('settings.reminders')}
            hint={t('settings.remindersHint')}
          />
          <Toggle
            checked={me.user.statusUpdatesEnabled}
            onChange={(v) => save.mutate({ statusUpdatesEnabled: v })}
            label={t('settings.statusUpdates')}
            hint={t('settings.statusUpdatesHint')}
          />
        </div>

        {saved && <p className="mt-3 text-[13px] text-starboard">{t('settings.saved')}</p>}

        <div className="mt-6 border-t border-rule pt-4">
          <div className="eyebrow">Account</div>
          <div className="mt-1.5 text-[14px]">{me.user.fullName}</div>
          <div className="stamp">{me.user.email}</div>
        </div>
      </div>
    </>
  );
}
