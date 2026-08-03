import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { ErrorNote } from '../components/ui';

export function Login() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const errorKey = params.get('error');

  const config = useQuery<{ domains: string[] }>({
    queryKey: ['auth-config'],
    queryFn: () => api.get('/auth/config'),
    retry: false,
  });

  const domains = config.data?.domains ?? [];
  const restricted = domains.length > 0;

  return (
    <div className="flex min-h-screen items-start justify-center px-5 py-12 sm:items-center">
      <div className="w-full max-w-[440px]">
        <div className="mb-8">
          <img src="/logo-horizontal.png" alt="Novikontas Academy" className="h-9 w-auto" />
          <div className="eyebrow mt-2">{t('app.name')}</div>
        </div>

        {errorKey && (
          <div className="mb-5">
            <ErrorNote>
              {t(`login.errors.${errorKey}`, { defaultValue: t('common.error') })}
            </ErrorNote>
          </div>
        )}

        <div className="panel px-6 py-6">
          <h2 className="text-[24px] font-700 text-navy-700">{t('login.heading')}</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-muted">
            {restricted
              ? `Sign in with your Google account. Only ${domains.map((d) => `@${d}`).join(', ')} accounts can reach this app.`
              : t('login.lead')}
          </p>
          <a
            href="/api/auth/google"
            className="btn-primary mt-5 flex w-full items-center justify-center gap-2.5"
          >
            <GoogleMark />
            Continue with Google
          </a>
        </div>

        <p className="mt-5 text-center text-[12px] leading-relaxed text-muted">
          {restricted
            ? `Sign-in is handled entirely by Google. There is no separate password for this app, and accounts outside ${domains.map((d) => `@${d}`).join(', ')} cannot be used.`
            : 'Sign-in is handled entirely by Google. There is no separate password for this app.'}
        </p>
      </div>
    </div>
  );
}

/** Google's four-colour mark, inline so the button needs no network request. */
function GoogleMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8a12 12 0 1 1 7.9-21l5.7-5.7A20 20 0 1 0 24 44a20 20 0 0 0 19.6-23.5z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8A12 12 0 0 1 24 12c3.1 0 5.9 1.2 7.9 3.1l5.7-5.7A20 20 0 0 0 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A11.9 11.9 0 0 1 12.7 28l-6.5 5A20 20 0 0 0 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2A19.6 19.6 0 0 0 44 24c0-1.2-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}
