import React, { useEffect, useState } from 'react';
import { api, timeAgo } from '../api.js';
import { useAuth } from '../App.jsx';
import { Spinner, Modal, Field, useToast, Badge } from '../ui.jsx';

function SendingCard({ data, isAdmin, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    sender_name: data.settings.sender_name,
    sender_email: data.settings.sender_email,
    reply_to: data.settings.reply_to,
    smtp2go_api_key: undefined,
  });
  const [quota, setQuota] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/api/quota').then(setQuota).catch(() => {});
  }, []);

  async function save() {
    setBusy(true);
    try {
      const payload = { sender_name: form.sender_name, sender_email: form.sender_email, reply_to: form.reply_to };
      if (form.smtp2go_api_key !== undefined) payload.smtp2go_api_key = form.smtp2go_api_key;
      await api.put('/api/settings', payload);
      toast('Sending settings saved');
      onSaved();
    } catch (err) {
      toast(err.message, 'bad');
    } finally {
      setBusy(false);
    }
  }

  const simulation = quota && quota.mode === 'simulation';

  return (
    <div className="card card-pad">
      <h2 className="card-title">Email sending</h2>

      {quota ? (
        simulation ? (
          <div className="banner banner-warn">
            <strong>Simulation mode.</strong> No SMTP2GO API key is configured, so emails are rendered
            and logged (viewable in each event's email log) but not delivered. Add a key below or set
            <code> SMTP2GO_API_KEY</code> on the server to go live.
          </div>
        ) : (
          <div className="banner banner-ok">
            <strong>Live sending via SMTP2GO.</strong>{' '}
            {quota.error
              ? `Quota lookup failed: ${quota.error}`
              : `${quota.used} of ${quota.max} emails used this cycle — ${quota.remaining} remaining` +
                (quota.cycle_end ? ` (cycle ends ${quota.cycle_end.slice(0, 10)})` : '')}
            {' '}· {quota.month_emails} sent by this organization this month.
          </div>
        )
      ) : null}

      <div className="field-row">
        <Field label="Sender name" hint="The “from” name guests see.">
          <input value={form.sender_name} maxLength={200} disabled={!isAdmin}
            onChange={(e) => setForm({ ...form, sender_name: e.target.value })} />
        </Field>
        <Field label="Sender email" hint="Must belong to a domain verified in SMTP2GO.">
          <input type="email" value={form.sender_email} maxLength={254} disabled={!isAdmin}
            onChange={(e) => setForm({ ...form, sender_email: e.target.value })} />
        </Field>
      </div>
      <div className="field-row">
        <Field label="Reply-to (optional)">
          <input type="email" value={form.reply_to} maxLength={254} disabled={!isAdmin}
            onChange={(e) => setForm({ ...form, reply_to: e.target.value })} />
        </Field>
        <Field label="SMTP2GO API key"
          hint={data.settings.smtp2go_key_set
            ? 'A key is saved for this organization. Enter a new one to replace it, or save an empty field to remove it.'
            : data.env.smtp2go_key_present
              ? 'Using the server-wide key. A key entered here overrides it for this organization.'
              : 'Starts with “api-”. Created in the SMTP2GO dashboard under Settings → API Keys.'}>
          <input type="password" placeholder={data.settings.smtp2go_key_set ? '••••••••••••' : 'api-…'}
            disabled={!isAdmin}
            onChange={(e) => setForm({ ...form, smtp2go_api_key: e.target.value })} />
        </Field>
      </div>
      {isAdmin ? (
        <button className="btn btn-primary" onClick={save} disabled={busy}>
          {busy ? 'Saving…' : 'Save sending settings'}
        </button>
      ) : <p className="small muted">Only administrators can change sending settings.</p>}
    </div>
  );
}

function UsersCard() {
  const toast = useToast();
  const { user: me } = useAuth();
  const [users, setUsers] = useState(null);
  const [modal, setModal] = useState(null); // {type:'new'} | {type:'password', value, name}
  const [form, setForm] = useState({ name: '', email: '', role: 'member' });
  const [busy, setBusy] = useState(false);

  async function load() {
    setUsers((await api.get('/api/users')).users);
  }
  useEffect(() => { load().catch(() => setUsers([])); }, []);

  if (!users) return <div className="card card-pad"><Spinner /></div>;

  return (
    <div className="card">
      <div className="card-pad spread">
        <h2 className="card-title" style={{ margin: 0 }}>Team members</h2>
        <button className="btn btn-sm btn-primary" onClick={() => {
          setForm({ name: '', email: '', role: 'member' });
          setModal({ type: 'new' });
        }}>+ Add user</button>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Last sign-in</th><th></th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td><span className="t-main">{u.name}</span>{u.id === me.id ? <span className="muted"> (you)</span> : null}
                  {!u.active ? <Badge tone="gray">Deactivated</Badge> : null}</td>
                <td className="t-sub">{u.email}</td>
                <td>{u.role === 'admin' ? <Badge tone="indigo">Admin</Badge> : <Badge>Member</Badge>}</td>
                <td className="t-sub">{u.last_login_at ? timeAgo(u.last_login_at) : 'never'}</td>
                <td>
                  <div className="t-actions">
                    {u.id !== me.id ? (
                      <>
                        <button className="btn btn-sm" disabled={busy} onClick={async () => {
                          try {
                            await api.put(`/api/users/${u.id}`, { role: u.role === 'admin' ? 'member' : 'admin' });
                            toast('Role updated'); load();
                          } catch (err) { toast(err.message, 'bad'); }
                        }}>{u.role === 'admin' ? 'Make member' : 'Make admin'}</button>
                        <button className="btn btn-sm" disabled={busy} onClick={async () => {
                          try {
                            const d = await api.post(`/api/users/${u.id}/reset-password`);
                            setModal({ type: 'password', value: d.temp_password, name: u.name });
                          } catch (err) { toast(err.message, 'bad'); }
                        }}>Reset password</button>
                        <button className="btn btn-sm btn-ghost" disabled={busy} onClick={async () => {
                          try {
                            await api.put(`/api/users/${u.id}`, { active: !u.active });
                            toast(u.active ? 'User deactivated' : 'User reactivated'); load();
                          } catch (err) { toast(err.message, 'bad'); }
                        }}>{u.active ? 'Deactivate' : 'Reactivate'}</button>
                      </>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal?.type === 'new' ? (
        <Modal title="Add a team member" onClose={() => setModal(null)}
          footer={
            <>
              <button className="btn" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={busy || !form.name.trim() || !form.email.trim()}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const d = await api.post('/api/users', form);
                    setModal({ type: 'password', value: d.temp_password, name: form.name });
                    load();
                  } catch (err) { toast(err.message, 'bad'); }
                  finally { setBusy(false); }
                }}>Create user</button>
            </>
          }>
          <Field label="Name *"><input value={form.name} autoFocus
            onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Email *"><input type="email" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Role">
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="member">Member — full access except settings & users</option>
              <option value="admin">Admin — everything</option>
            </select>
          </Field>
        </Modal>
      ) : null}

      {modal?.type === 'password' ? (
        <Modal title={`Temporary password for ${modal.name}`} onClose={() => setModal(null)}
          footer={<button className="btn btn-primary" onClick={() => setModal(null)}>Done</button>}>
          <p style={{ marginTop: 0 }}>Share this with them securely — it is shown only once:</p>
          <div className="password-reveal">{modal.value}</div>
          <button className="btn btn-sm mt" onClick={async () => {
            try { await navigator.clipboard.writeText(modal.value); toast('Copied'); }
            catch { toast('Could not copy', 'bad'); }
          }}>Copy to clipboard</button>
        </Modal>
      ) : null}
    </div>
  );
}

function AccountCard() {
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div className="card card-pad">
      <h2 className="card-title">Your account</h2>
      <div className="field-row">
        <Field label="Current password">
          <input type="password" value={current} autoComplete="current-password"
            onChange={(e) => setCurrent(e.target.value)} />
        </Field>
        <Field label="New password" hint="At least 10 characters.">
          <input type="password" value={next} autoComplete="new-password"
            onChange={(e) => setNext(e.target.value)} />
        </Field>
      </div>
      <button className="btn" disabled={busy || next.length < 10 || !current}
        onClick={async () => {
          setBusy(true);
          try {
            await api.post('/api/account/password', { current, next });
            toast('Password changed');
            setCurrent(''); setNext('');
          } catch (err) { toast(err.message, 'bad'); }
          finally { setBusy(false); }
        }}>Change password</button>
    </div>
  );
}

export default function Settings() {
  const toast = useToast();
  const { user, org, refresh } = useAuth();
  const isAdmin = user.role === 'admin';
  const [data, setData] = useState(null);
  const [orgName, setOrgName] = useState(org.name);
  const [busy, setBusy] = useState(false);

  async function load() {
    const d = await api.get('/api/settings');
    setData(d);
    setOrgName(d.org.name);
  }
  useEffect(() => { load().catch((e) => toast(e.message, 'bad')); }, []);

  if (!data) return <div className="page"><Spinner /></div>;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-sub">Organization “{data.org.name}” · sign-in slug <code>{data.org.slug}</code></p>
        </div>
      </div>

      <div className="card card-pad">
        <h2 className="card-title">Organization</h2>
        <div className="field-row">
          <Field label="Display name" hint="Shown to guests on event pages and in email footers.">
            <input value={orgName} maxLength={200} disabled={!isAdmin}
              onChange={(e) => setOrgName(e.target.value)} />
          </Field>
          <Field label="Server address" hint="Set BASE_URL in .env — links in emails are built from it.">
            <input value={data.env.base_url} disabled />
          </Field>
        </div>
        {isAdmin ? (
          <button className="btn btn-primary" disabled={busy || !orgName.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                await api.put('/api/settings', { org_name: orgName });
                toast('Organization updated');
                await refresh();
                await load();
              } catch (err) { toast(err.message, 'bad'); }
              finally { setBusy(false); }
            }}>Save</button>
        ) : null}
      </div>

      <SendingCard data={data} isAdmin={isAdmin} onSaved={load} />

      {isAdmin ? <UsersCard /> : null}

      <AccountCard />

      <div className="card card-pad">
        <h2 className="card-title">Export your data</h2>
        <p className="small muted" style={{ marginTop: 0 }}>
          Everything is yours, always. CSVs open in any spreadsheet; the JSON backup contains all
          records. For a byte-perfect backup of every organization, copy the server's <code>data/</code> directory.
        </p>
        <div className="row">
          <a className="btn" href="/api/export/contacts.csv">Contacts CSV</a>
          <a className="btn" href="/api/export/groups.csv">Groups CSV</a>
          <a className="btn" href="/api/export/venues.csv">Venues CSV</a>
          <a className="btn" href="/api/export/events.csv">Events CSV</a>
          <a className="btn" href="/api/export/broadcasts.csv">Broadcasts CSV</a>
          <a className="btn" href="/api/export/emails.csv">Email log CSV</a>
          <a className="btn" href="/api/export/backup.json">Full JSON backup</a>
        </div>
      </div>
    </div>
  );
}
