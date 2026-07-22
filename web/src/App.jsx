import React, { createContext, useContext, useEffect, useState } from 'react';
import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { api, onUnauthorized } from './api.js';
import { ToastProvider, Spinner } from './ui.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import EventsList from './pages/EventsList.jsx';
import EventDetail from './pages/EventDetail.jsx';
import EventWizard from './pages/EventWizard.jsx';
import Contacts from './pages/Contacts.jsx';
import Groups from './pages/Groups.jsx';
import Venues from './pages/Venues.jsx';
import Templates from './pages/Templates.jsx';
import Settings from './pages/Settings.jsx';

const AuthContext = createContext(null);
export function useAuth() {
  return useContext(AuthContext);
}

const NAV = [
  { to: '/', label: 'Dashboard', icon: '⌂', end: true },
  { to: '/events', label: 'Events', icon: '🎟' },
  { to: '/contacts', label: 'Contacts', icon: '👤' },
  { to: '/groups', label: 'Groups', icon: '👥' },
  { to: '/venues', label: 'Venues', icon: '📍' },
  { to: '/templates', label: 'Templates', icon: '📝' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
];

function Layout({ children }) {
  const { user, org, logout } = useAuth();
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="side-brand">SJC<span className="tick">•</span>Vite</div>
        <div className="side-org" title={org.name}>{org.name}</div>
        <nav className="side-nav">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}>
              <span className="nav-ico">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="side-footer">
          <div className="who" title={user.email}>{user.name}</div>
          <button onClick={logout}>Sign out</button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}

export default function App() {
  const [state, setState] = useState({ loading: true, user: null, org: null, app: null });

  async function refresh() {
    try {
      const me = await api.get('/api/auth/me');
      setState({ loading: false, user: me.user, org: me.org, app: me.app });
    } catch {
      setState({ loading: false, user: null, org: null, app: null });
    }
  }

  useEffect(() => {
    onUnauthorized(() => setState((s) => (s.user ? { ...s, user: null, org: null } : s)));
    refresh();
  }, []);

  if (state.loading) {
    return <div style={{ paddingTop: '30vh' }}><Spinner /></div>;
  }

  if (!state.user) {
    return (
      <ToastProvider>
        <Login onLogin={(me) => setState({ loading: false, user: me.user, org: me.org, app: me.app || null })} />
      </ToastProvider>
    );
  }

  const auth = {
    user: state.user,
    org: state.org,
    app: state.app,
    refresh,
    logout: async () => {
      try { await api.post('/api/auth/logout'); } catch { /* session may already be gone */ }
      setState({ loading: false, user: null, org: null, app: null });
    },
  };

  return (
    <AuthContext.Provider value={auth}>
      <ToastProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/events" element={<EventsList />} />
            <Route path="/events/new" element={<EventWizard />} />
            <Route path="/events/:id" element={<EventDetail />} />
            <Route path="/events/:id/edit" element={<EventWizard />} />
            <Route path="/contacts" element={<Contacts />} />
            <Route path="/groups" element={<Groups />} />
            <Route path="/venues" element={<Venues />} />
            <Route path="/templates" element={<Templates />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </ToastProvider>
    </AuthContext.Provider>
  );
}
