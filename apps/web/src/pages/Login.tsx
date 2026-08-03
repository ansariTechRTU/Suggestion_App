import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, ShieldCheck, User } from 'lucide-react';
import { api, type DemoUser } from '../lib/api';
import { ErrorNote } from '../components/ui';

export function Login() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [showAll, setShowAll] = useState(false);
  const errorKey = params.get('error');

  // Returns 404 unless the API has DEMO_MODE=true, so the picker simply does not
  // appear in a real deployment.
  // Which sign-in methods this deployment offers.
  const config = useQuery<{
    google: boolean;
    demo: boolean;
    magicLink: boolean;
    domains: string[];
  }>({
    queryKey: ['auth-config'],
    queryFn: () => api.get('/auth/config'),
    retry: false,
  });

  const demo = useQuery<{ demo: boolean; items: DemoUser[] }>({
    queryKey: ['demo-users'],
    queryFn: () => api.get('/auth/demo-users'),
    retry: false,
  });

  const send = useMutation({
    mutationFn: (value: string) =>
      api.post<{ message: string }>('/auth/request-link', { email: value }),
  });

  const demoLogin = useMutation({
    mutationFn: (value: string) => api.post('/auth/demo-login', { email: value }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['me'] });
    },
  });

  const isDemo = demo.data?.demo === true && config.data?.demo === true;
  const hasGoogle = config.data?.google === true;
  // Google is exclusive: when it is on, nothing else is offered.
  const hasMagicLink = config.data?.magicLink === true;
  const orgDomain = config.data?.domains?.[0] ?? 'novikontas.org';
  const people = demo.data?.items ?? [];
  const admins = people.filter((p) => p.role === 'ADMIN');
  const staff = people.filter((p) => p.role === 'STAFF');
  const shortlist = showAll ? staff : staff.slice(0, 4);

  return (
    <div className="flex min-h-screen items-start justify-center px-5 py-12 sm:items-center">
      <div className="w-full max-w-[440px]">
        <div className="mb-8">
          <div className="font-display text-[11px] font-700 uppercase tracking-[0.16em] text-navy-700">
            Novikontas
          </div>
          <div className="eyebrow">{t('app.name')}</div>
        </div>

        {errorKey && (
          <div className="mb-5">
            <ErrorNote>
              {t(`login.errors.${errorKey}`, { defaultValue: t('common.error') })}
            </ErrorNote>
          </div>
        )}

        {isDemo && (
          <div className="panel mb-5 px-6 py-6">
            <div className="eyebrow">Demo</div>
            <h1 className="mt-1 text-[22px] font-700 text-navy-700">Sign in as anyone</h1>
            <p className="mt-2 text-[14px] leading-relaxed text-muted">
              This build runs in demo mode, so there is no password and no email step. Pick a person
              to see the app through their eyes.
            </p>

            <div className="mt-5">
              <div className="eyebrow mb-2">Administrators — full control</div>
              <div className="ruled border border-rule rounded-sm">
                {admins.map((p) => (
                  <PersonRow
                    key={p.email}
                    person={p}
                    pending={demoLogin.isPending}
                    onPick={() => demoLogin.mutate(p.email)}
                  />
                ))}
              </div>
            </div>

            <div className="mt-4">
              <div className="eyebrow mb-2">Staff — submit and view</div>
              <div className="ruled border border-rule rounded-sm">
                {shortlist.map((p) => (
                  <PersonRow
                    key={p.email}
                    person={p}
                    pending={demoLogin.isPending}
                    onPick={() => demoLogin.mutate(p.email)}
                  />
                ))}
              </div>
              {staff.length > 4 && (
                <button
                  onClick={() => setShowAll((v) => !v)}
                  className="mt-2 text-[13px] text-muted hover:text-navy-700"
                >
                  {showAll ? 'Show fewer' : `Show all ${staff.length} staff`}
                </button>
              )}
            </div>

            {demoLogin.error && (
              <div className="mt-4">
                <ErrorNote>Could not sign in. Has the demo data been seeded?</ErrorNote>
              </div>
            )}
          </div>
        )}

        {/* Google Workspace — the primary route once it is configured. */}
        {hasGoogle && (
          <div className="panel mb-5 px-6 py-6">
            <h2 className="text-[24px] font-700 text-navy-700">{t('login.heading')}</h2>
            <p className="mt-2 text-[14px] leading-relaxed text-muted">
              Sign in with your Novikontas Google account. Only @{orgDomain} accounts can reach this
              app.
            </p>
            <a
              href="/api/auth/google"
              className="btn-primary mt-5 flex w-full items-center justify-center gap-2.5"
            >
              <GoogleMark />
              Continue with Google
            </a>
          </div>
        )}

        {/*
          Setup hint, demo builds only. Without it the Google button is simply
          absent when the credentials are missing, which looks like a bug rather
          than a configuration step.
        */}
        {!hasGoogle && isDemo && (
          <div className="panel mb-5 border-dashed px-6 py-5">
            <div className="eyebrow">Not configured</div>
            <h2 className="mt-1 text-[17px] font-700 text-navy-700">Google Workspace sign-in</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              Add <code className="font-mono text-[12px]">GOOGLE_CLIENT_ID</code> and{' '}
              <code className="font-mono text-[12px]">GOOGLE_CLIENT_SECRET</code> to{' '}
              <code className="font-mono text-[12px]">.env</code> and restart the API — the button
              appears here automatically. Setup steps are in the README.
            </p>
          </div>
        )}

        {/*
          Magic link. Present only before Google is configured — the API closes
          the route entirely once it is, so showing the form would be a lie.
        */}
        {hasMagicLink &&
          (send.isSuccess ? (
            <div className="panel px-6 py-7">
              <span className="flex h-9 w-9 items-center justify-center bg-navy-50 text-navy-700 rounded-full">
                <Mail size={17} />
              </span>
              <h2 className="mt-4 text-[19px] font-700 text-navy-700">{t('login.sentHeading')}</h2>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">{t('login.sentLead')}</p>
              <button onClick={() => send.reset()} className="btn-ghost btn-sm mt-5">
                {t('login.again')}
              </button>
            </div>
          ) : (
            <div className="panel px-6 py-6">
              <h2
                className={`font-700 text-navy-700 ${
                  isDemo || hasGoogle ? 'text-[17px]' : 'text-[24px]'
                }`}
              >
                {isDemo
                  ? 'Or use the real sign-in'
                  : hasGoogle
                    ? 'Or use a sign-in link'
                    : t('login.heading')}
              </h2>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">
                {isDemo
                  ? 'Sends a one-time link to a Novikontas address. In demo mode the link is printed in the server log rather than emailed.'
                  : hasGoogle
                    ? `For anyone without a Google account on the domain. Sends a one-time link to an @${orgDomain} address.`
                    : t('login.lead')}
              </p>

              <form
                className="mt-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (email.trim()) send.mutate(email.trim());
                }}
              >
                <label htmlFor="email" className="eyebrow mb-1.5 block">
                  {t('login.email')}
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@novikontas.org"
                  className="field"
                />
                <button type="submit" disabled={send.isPending} className="btn-primary mt-4 w-full">
                  {send.isPending ? t('common.loading') : t('login.submit')}
                </button>
              </form>
            </div>
          ))}

        {/* Google is configured: it is the whole login screen. */}
        {hasGoogle && (
          <p className="mt-5 text-center text-[12px] leading-relaxed text-muted">
            Sign-in is handled entirely by Google. There is no separate password for this app, and
            accounts outside @{orgDomain} cannot be used.
          </p>
        )}
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

function PersonRow({
  person,
  pending,
  onPick,
}: {
  person: DemoUser;
  pending: boolean;
  onPick: () => void;
}) {
  return (
    <button
      onClick={onPick}
      disabled={pending}
      className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-navy-50/70
        disabled:opacity-50"
    >
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
          person.role === 'ADMIN' ? 'bg-navy-700 text-white' : 'bg-navy-50 text-navy-700'
        }`}
      >
        {person.role === 'ADMIN' ? <ShieldCheck size={14} /> : <User size={13} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-500">{person.fullName}</span>
        <span className="stamp block truncate">
          {person.department ?? person.division} · {person.email}
        </span>
      </span>
      <span className="stamp shrink-0">{person.locale}</span>
    </button>
  );
}
