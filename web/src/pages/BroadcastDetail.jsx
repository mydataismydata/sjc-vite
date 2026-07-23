import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, timeAgo } from '../api.js';
import {
  Spinner, Modal, ConfirmModal, Empty, CopyBox, useToast, EmailStatusBadge, Badge,
} from '../ui.jsx';

function BroadcastBadge({ status }) {
  if (status === 'sent') return <Badge tone="green">Sent</Badge>;
  if (status === 'sending') return <Badge tone="indigo">Sending</Badge>;
  return <Badge tone="amber">Draft</Badge>;
}

export default function BroadcastDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [b, setB] = useState(null);
  const [emails, setEmails] = useState([]);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [viewEmail, setViewEmail] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (quiet = false) => {
    try {
      const [d, e] = await Promise.all([
        api.get(`/api/broadcasts/${id}`),
        api.get(`/api/emails?broadcast_id=${id}`),
      ]);
      setB(d.broadcast);
      setEmails(e.emails);
    } catch (err) {
      if (!quiet) setError(err.message);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Quiet refresh while emails are moving through the queue.
  const hasActivity = emails.some((e) => ['queued', 'sending'].includes(e.status));
  useEffect(() => {
    if (!hasActivity) return;
    const t = setInterval(() => load(true), 3000);
    return () => clearInterval(t);
  }, [hasActivity, load]);

  if (error) return <div className="page"><div className="banner banner-bad">{error}</div></div>;
  if (!b) return <div className="page"><Spinner /></div>;

  const s = b.stats;

  async function act(fn, okMsg) {
    setBusy(true);
    try {
      await fn();
      if (okMsg) toast(okMsg);
      await load(true);
    } catch (err) {
      toast(err.message, 'bad');
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="row" style={{ gap: 10 }}>
            <h1 className="page-title">{b.title}</h1>
            <BroadcastBadge status={b.status} />
          </div>
          <p className="page-sub">{b.subject || <em>no subject</em>}</p>
        </div>
        <div className="head-actions">
          {b.web_version && b.status !== 'draft'
            ? <a className="btn" href={b.share_url} target="_blank" rel="noopener noreferrer">View web version ↗</a>
            : null}
          <Link className="btn" to={`/broadcasts/${b.id}/edit`}>{b.status === 'draft' ? 'Continue editing' : 'Edit'}</Link>
          <button className="btn" disabled={busy} onClick={() => act(async () => {
            const d = await api.post(`/api/broadcasts/${b.id}/duplicate`);
            navigate(`/broadcasts/${d.broadcast.id}/edit`);
          })}>Duplicate</button>
          <button className="btn btn-danger" onClick={() => setConfirm({ type: 'delete' })}>Delete</button>
        </div>
      </div>

      {b.status === 'draft' ? (
        <div className="banner banner-info">
          This broadcast hasn't been sent yet.{' '}
          <Link to={`/broadcasts/${b.id}/edit`}>Open it in the wizard</Link> to pick recipients and send.
        </div>
      ) : null}

      <div className="stat-grid">
        <div className="stat"><div className="label">Recipients</div><div className="value">{s.recipients}</div>
          <div className="sub">emailed this broadcast</div></div>
        <div className="stat tone-ok"><div className="label">Sent</div><div className="value">{s.sent}</div>
          <div className="sub">delivered / simulated</div></div>
        <div className="stat tone-warn"><div className="label">Queued</div><div className="value">{s.pending}</div>
          <div className="sub">waiting to send</div></div>
        <div className="stat tone-bad"><div className="label">Failed</div><div className="value">{s.failed}</div>
          <div className="sub">{s.failed ? 'retry from the log below' : 'none'}</div></div>
      </div>

      {b.web_version && b.status !== 'draft' ? (
        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <strong style={{ fontSize: 13.5 }}>Web version link</strong>
          <p className="small muted" style={{ margin: '2px 0 8px' }}>
            The “view in browser” link included in the email. Anyone with it can read this broadcast.
          </p>
          <CopyBox value={b.share_url} />
        </div>
      ) : null}

      <div className="card">
        <div className="card-pad spread">
          <h2 className="card-title" style={{ margin: 0 }}>Email log ({emails.length})</h2>
        </div>
        {emails.length === 0 ? (
          <Empty icon="📬" title="No emails yet">
            Once you send (or run a test), every email shows up here with its exact content and status.
          </Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>When</th><th>Type</th><th>To</th><th>Subject</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {emails.map((e) => (
                  <tr key={e.id}>
                    <td className="t-sub" style={{ whiteSpace: 'nowrap' }}>{timeAgo(e.sent_at || e.created_at)}</td>
                    <td><span className="badge badge-gray">{e.kind === 'test' ? 'test' : 'broadcast'}</span></td>
                    <td className="t-sub">{e.to_email}</td>
                    <td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.subject}</td>
                    <td>
                      <EmailStatusBadge status={e.status} />
                      {e.error ? <div className="t-sub" title={e.error}>{e.error.slice(0, 60)}</div> : null}
                    </td>
                    <td>
                      <div className="t-actions">
                        <button className="btn btn-sm" onClick={async () => {
                          try { setViewEmail((await api.get(`/api/emails/${e.id}`)).email); }
                          catch (err) { toast(err.message, 'bad'); }
                        }}>View</button>
                        {e.status === 'failed' ? (
                          <button className="btn btn-sm" disabled={busy}
                            onClick={() => act(() => api.post(`/api/emails/${e.id}/retry`), 'Retrying')}>Retry</button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {viewEmail ? (
        <Modal title={viewEmail.subject} size="lg" onClose={() => setViewEmail(null)}>
          <p className="small muted" style={{ margin: '0 0 8px' }}>
            To {viewEmail.to_email} · {viewEmail.kind === 'test' ? 'test' : 'broadcast'} · {viewEmail.status}
            {viewEmail.sent_at ? ` · ${viewEmail.sent_at} UTC` : ''}
          </p>
          <iframe className="email-frame" title="Sent email" srcDoc={viewEmail.html} />
        </Modal>
      ) : null}

      {confirm?.type === 'delete' ? (
        <ConfirmModal title="Delete broadcast?" danger busy={busy}
          message="This permanently deletes the broadcast and its web version. The email log is kept."
          confirmLabel="Delete forever" onClose={() => setConfirm(null)}
          onConfirm={() => act(async () => { await api.del(`/api/broadcasts/${b.id}`); navigate('/broadcasts'); })} />
      ) : null}
    </div>
  );
}
