import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, ApiError, type Me } from './lib/api';
import { Layout } from './components/Layout';
import { Spinner } from './components/ui';
import { Login } from './pages/Login';
import { NewSuggestion } from './pages/NewSuggestion';
import { MyLog } from './pages/MyLog';
import { SuggestionDetail } from './pages/SuggestionDetail';
import { Board } from './pages/Board';
import { Ranks } from './pages/Ranks';
import { Settings } from './pages/Settings';
import { AdminQueue } from './pages/admin/AdminQueue';
import { AdminControls } from './pages/admin/AdminControls';

export function App() {
  const { i18n } = useTranslation();

  const me = useQuery<Me>({
    queryKey: ['me'],
    queryFn: () => api.get<Me>('/me'),
    retry: false,
  });

  // The account's stored locale wins on first load; the header switcher can
  // still override it for the session.
  useEffect(() => {
    if (me.data && !localStorage.getItem('nk_lang')) {
      void i18n.changeLanguage(me.data.user.locale.toLowerCase());
    }
  }, [me.data, i18n]);

  if (me.isLoading) return <Spinner label="Loading" />;

  const unauthenticated = me.error instanceof ApiError && me.error.status === 401;
  if (unauthenticated || !me.data) {
    /**
     * Remember where they were heading before the redirect to /login.
     *
     * The Friday reminder links straight to /suggestions/new. Signing in used to
     * land everyone on /suggestions/mine, so the one thing the email asked for
     * was the one thing the person then had to go and find. Stashing the path
     * here and consuming it after sign-in keeps the intent intact — including
     * through Google, which returns via a full page load and would lose any
     * in-memory state.
     */
    const here = window.location.pathname;
    if (here !== '/login' && here !== '/') sessionStorage.setItem('nk_after_login', here);

    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  const isAdmin = me.data.user.role === 'ADMIN';
  const pending = sessionStorage.getItem('nk_after_login');
  if (pending) {
    sessionStorage.removeItem('nk_after_login');
    // Admins never submit, so send them to the queue whatever the link said.
    const target = isAdmin && pending.startsWith('/suggestions/new') ? '/admin/queue' : pending;
    if (target !== window.location.pathname) return <Navigate to={target} replace />;
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={<Navigate to={isAdmin ? '/admin/queue' : '/suggestions/mine'} replace />}
      />
      <Route element={<Layout me={me.data} />}>
        <Route
          index
          element={<Navigate to={isAdmin ? '/admin/queue' : '/suggestions/mine'} replace />}
        />
        {!isAdmin && <Route path="/suggestions/new" element={<NewSuggestion />} />}
        <Route path="/suggestions/mine" element={<MyLog />} />
        <Route path="/suggestions/:code" element={<SuggestionDetail me={me.data} />} />
        <Route path="/board" element={<Board />} />
        <Route path="/ranks" element={<Ranks />} />
        <Route path="/settings" element={<Settings me={me.data} />} />
        {isAdmin && <Route path="/admin/queue" element={<AdminQueue />} />}
        {isAdmin && <Route path="/admin/controls" element={<AdminControls />} />}
        <Route
          path="*"
          element={<Navigate to={isAdmin ? '/admin/queue' : '/suggestions/mine'} replace />}
        />
      </Route>
    </Routes>
  );
}
