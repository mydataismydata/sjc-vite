import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, timeAgo } from '../api.js';
import { useAuth } from '../App.jsx';
import { Spinner, Empty, ResponseBadge, StatusBadge } from '../ui.jsx';

function QuotaValue({ quota }) {
  if (!quota) return '—';
  if (!quota.configured) return 'Simulation';
  if (quota.error) return 'Unavailable';
  return `${quota.remaining ?? '—'}`;
}

export default function Dashboard() {
  const { user, org } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/api/dashboard').then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="page"><div className="banner banner-bad">{error}</div></div>;
  if (!data) return <div className="page"><Spinner /></div>;

  const { counts, upcoming, recent, quota, month_emails } = data;
  const firstName = (user.name || '').split(' ')[0];
  const gettingStarted = counts.events === 0;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Welcome back, {firstName}</h1>
          <p className="page-sub">Here's what's happening at {org.name}.</p>
        </div>
        <div className="head-actions">
          <Link className="btn btn-primary" to="/events/new">+ New event</Link>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat">
          <div className="label">Upcoming events</div>
          <div className="value">{counts.upcoming}</div>
          <div className="sub">{counts.drafts} draft{counts.drafts === 1 ? '' : 's'}</div>
        </div>
        <div className="stat">
          <div className="label">Contacts</div>
          <div className="value">{counts.contacts}</div>
          <div className="sub">{counts.groups} group{counts.groups === 1 ? '' : 's'}</div>
        </div>
        <div className="stat">
          <div className="label">Emails this month</div>
          <div className="value">{month_emails}</div>
          <div className="sub">{quota?.configured ? 'via SMTP2GO' : 'simulation mode'}</div>
        </div>
        <div className="stat">
          <div className="label">Email quota left</div>
          <div className="value"><QuotaValue quota={quota} /></div>
          <div className="sub">
            {quota?.configured && !quota.error
              ? `${quota.used} of ${quota.max} used this cycle`
              : quota?.configured ? quota.error : 'no SMTP2GO key yet'}
          </div>
        </div>
      </div>

      {gettingStarted ? (
        <div className="card card-pad">
          <h2 className="card-title">Get started</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Three steps and your first invitations are out the door:
          </p>
          <ol style={{ margin: '0 0 14px', paddingLeft: 20, lineHeight: 2 }}>
            <li><Link to="/contacts">Add or import your contacts</Link> — paste a CSV straight from a spreadsheet.</li>
            <li><Link to="/groups">Organize them into groups</Link> (optional, but handy for recurring audiences).</li>
            <li><Link to="/events/new">Create your first event</Link> — the wizard walks you through details, design, and sending.</li>
          </ol>
          <Link className="btn btn-primary" to="/events/new">Create your first event</Link>
        </div>
      ) : null}

      <div className="grid2" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="card-pad">
            <div className="spread">
              <h2 className="card-title" style={{ margin: 0 }}>Upcoming events</h2>
              <Link className="small" to="/events">All events →</Link>
            </div>
          </div>
          {upcoming.length === 0 ? (
            <Empty icon="🗓" title="Nothing scheduled">Events with future dates appear here.</Empty>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <tbody>
                  {upcoming.map((ev) => (
                    <tr key={ev.id}>
                      <td>
                        <Link to={`/events/${ev.id}`} className="t-main">{ev.title}</Link>
                        <div className="t-sub">{ev.when}{ev.venue_name ? ` · ${ev.venue_name}` : ''}</div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <StatusBadge status={ev.status} />
                        <div className="t-sub" style={{ marginTop: 3 }}>
                          {ev.stats.accepted} yes · {ev.stats.declined} no · {ev.stats.awaiting} waiting
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-pad"><h2 className="card-title" style={{ margin: 0 }}>Recent responses</h2></div>
          {recent.length === 0 ? (
            <Empty icon="💌" title="No responses yet">RSVPs land here the moment guests click.</Empty>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <tbody>
                  {recent.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <span className="t-main">{r.name}</span>
                        {r.party_size > 1 ? <span className="muted"> +{r.party_size - 1}</span> : null}
                        <div className="t-sub">
                          <Link to={`/events/${r.event_id}`}>{r.event_title}</Link> · {timeAgo(r.responded_at)}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}><ResponseBadge response={r.response} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
