import { useEffect, useState } from 'react';
import { Navigate, NavLink, Outlet, Route, Routes } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { UsersPage } from './pages/UsersPage';
import { TicketsPage } from './pages/TicketsPage';
import { TicketDetailPage } from './pages/TicketDetailPage';
import { ConversationsPage } from './pages/ConversationsPage';
import { ConversationDetailPage } from './pages/ConversationDetailPage';
import { PropertiesPage } from './pages/PropertiesPage';
import { PropertyEditPage } from './pages/PropertyEditPage';

function AdminShell() {
  return (
    <div className="app-shell">
      <nav className="app-nav">
        <div style={{ padding: '0 0.75rem 1rem', fontWeight: 700, fontSize: '1rem' }}>簡屋 · 管理</div>
        <NavLink end to="/" className={({ isActive }) => (isActive ? 'active' : '')}>
          總覽
        </NavLink>
        <NavLink to="/users" className={({ isActive }) => (isActive ? 'active' : '')}>
          用戶
        </NavLink>
        <NavLink to="/properties" className={({ isActive }) => (isActive ? 'active' : '')}>
          租盤
        </NavLink>
        <NavLink to="/tickets" className={({ isActive }) => (isActive ? 'active' : '')}>
          客服工單
        </NavLink>
        <NavLink to="/chats" className={({ isActive }) => (isActive ? 'active' : '')}>
          對話監管
        </NavLink>
        <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
          <button type="button" className="btn" onClick={() => void supabase.auth.signOut()}>
            登出
          </button>
        </div>
      </nav>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_ev, s) => {
      setSession(s);
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setIsAdmin(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from('app_admins')
        .select('user_id')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (!cancelled) setIsAdmin(!!data);
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  if (loading) {
    return (
      <div className="login-box">
        <p className="muted">載入中…</p>
      </div>
    );
  }

  if (!session) {
    return <LoginPage onSession={() => void supabase.auth.getSession().then(({ data: { session: s } }) => setSession(s))} />;
  }

  if (isAdmin === null) {
    return (
      <div className="login-box">
        <p className="muted">檢查權限…</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="login-box">
        <h1>無權限</h1>
        <p className="muted">此帳號未列入 app_admins。請聯絡技術人員在資料庫加入你的 user_id。</p>
        <button type="button" className="btn btn-primary" onClick={() => void supabase.auth.signOut()}>
          登出
        </button>
      </div>
    );
  }

  return (
    <Routes>
      <Route element={<AdminShell />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/properties" element={<PropertiesPage />} />
        <Route path="/properties/:id" element={<PropertyEditPage />} />
        <Route path="/tickets" element={<TicketsPage />} />
        <Route path="/tickets/:id" element={<TicketDetailPage />} />
        <Route path="/chats" element={<ConversationsPage />} />
        <Route path="/chats/:id" element={<ConversationDetailPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
