import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LogOut } from 'lucide-react';
import { api, type Me } from '../lib/api';
import { setLanguage } from '../lib/i18n';

const LANGS = [
  { code: 'en', label: 'EN' },
  { code: 'lv', label: 'LV' },
  { code: 'ru', label: 'RU' },
];

function Tab({ to, children }: { to: string; children: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `relative py-3 font-display text-[13px] font-600 tracking-tight transition-colors ${
          isActive ? 'text-navy-700' : 'text-muted hover:text-ink'
        } after:absolute after:inset-x-0 after:-bottom-px after:h-[2px] ${
          isActive ? 'after:bg-navy-700' : 'after:bg-transparent'
        }`
      }
    >
      {children}
    </NavLink>
  );
}

export function Layout({ me }: { me: Me }) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();

  /**
   * Sign out with a full page load rather than a client-side route change.
   *
   * Clearing the query cache and calling navigate() left the app racing its own
   * refetch of /me, and any component still holding stale session data could win
   * that race and keep the user on the page. A hard navigation throws away every
   * bit of in-memory state, which is exactly what signing out should mean.
   *
   * onSettled, not onSuccess: if the request fails — the session had already
   * expired server-side, say — staying signed in is the wrong outcome. The
   * cookie is httpOnly, so the server has already had its chance to clear it;
   * reloading sends the user to /login either way.
   */
  const logout = useMutation({
    mutationFn: () => api.post('/auth/logout'),
    onSettled: () => {
      qc.clear();
      window.location.assign('/login');
    },
  });

  const isAdmin = me.user.role === 'ADMIN';
  const ranksOpen = isAdmin || me.settings['leaderboard.visibleToStaff'] === true;
  const boardOpen = me.settings['board.enabled'] === true;

  return (
    <div className="min-h-screen">
      <header className="border-b border-rule bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 pt-4">
          <div className="flex items-center gap-3">
            <img src="/logo-mark.png" alt="" className="h-8 w-auto" />
            <div>
              <div className="font-display text-[11px] font-700 uppercase tracking-[0.16em] text-navy-700">
                {t('app.org')}
              </div>
              <div className="eyebrow">{t('app.name')}</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex gap-1" role="group" aria-label="Language">
              {LANGS.map((l) => (
                <button
                  key={l.code}
                  onClick={() => setLanguage(l.code)}
                  className={`px-1.5 py-0.5 font-mono text-[11px] rounded-sm ${
                    i18n.resolvedLanguage === l.code
                      ? 'bg-navy-50 text-navy-700'
                      : 'text-muted hover:text-ink'
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
            <div className="hidden text-right sm:block">
              <div className="text-[13px] font-500 leading-tight">{me.user.fullName}</div>
              <div className="stamp">{me.user.department ?? me.user.division}</div>
            </div>
            <button
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
              className="flex items-center gap-1.5 text-[13px] text-muted hover:text-port
                disabled:opacity-50"
              aria-label={t('nav.signOut')}
              title={t('nav.signOut')}
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">{t('nav.signOut')}</span>
            </button>
          </div>
        </div>

        <nav className="mx-auto flex max-w-5xl gap-5 overflow-x-auto px-5">
          {/*
            Two different apps behind one login.

            Staff get four tabs and nothing else — submit, their own history,
            where they stand, and their settings. Admins get the review side and
            no submit tab at all: they judge the queue, so filing into it would
            put them on both sides of the same decision.
          */}
          {!isAdmin && <Tab to="/suggestions/new">{t('nav.new')}</Tab>}
          {!isAdmin && <Tab to="/suggestions/mine">{t('nav.mine')}</Tab>}
          {!isAdmin && ranksOpen && <Tab to="/ranks">{t('nav.ranks')}</Tab>}
          {isAdmin && <Tab to="/admin/queue">{t('nav.queue')}</Tab>}
          {isAdmin && <Tab to="/admin/controls">{t('nav.admin')}</Tab>}
          {isAdmin && boardOpen && <Tab to="/board">{t('nav.board')}</Tab>}
          {isAdmin && <Tab to="/ranks">{t('nav.ranks')}</Tab>}
          <Tab to="/settings">{t('nav.settings')}</Tab>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-8">
        <Outlet />
      </main>

      <footer className="mx-auto max-w-5xl px-5 pb-10">
        <div className="border-t border-rule pt-4 text-[12px] text-muted">
          One suggestion a week. Every one gets an answer.
        </div>
      </footer>
    </div>
  );
}
