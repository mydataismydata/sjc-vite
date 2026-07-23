import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Field } from '../ui.jsx';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [build, setBuild] = useState(null);

  // Unauthenticated build check, so the running build can be confirmed from
  // the login screen right after a deploy.
  useEffect(() => {
    fetch('/api/health').then((r) => r.json()).then(setBuild).catch(() => {});
  }, []);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const me = await api.post('/api/auth/login', { email, password });
      onLogin(me);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <h1 className="login-brand">Soap<span className="tick">box</span></h1>
        <p className="login-sub">Events, invitations & RSVPs</p>
        <Field label="Email">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            autoComplete="username" autoFocus required />
        </Field>
        <Field label="Password">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password" required />
        </Field>
        {error ? <div className="error-text">{error}</div> : null}
        <button className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 12 }} disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        {build?.build ? (
          <p className="login-build">v{build.version} · build {build.build}</p>
        ) : null}
      </form>
    </div>
  );
}
