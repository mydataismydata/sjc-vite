import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { Field } from '../ui.jsx';

// Choose who gets invited: pick whole groups, tick individual contacts, and
// add brand-new people inline. Reports the selection upward on every change.
export default function RecipientPicker({ value, onChange, alreadyInvited = new Set() }) {
  const [contacts, setContacts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [q, setQ] = useState('');
  const sel = value; // { contact_ids: [], group_ids: [], new_contacts: [] }

  useEffect(() => {
    api.get('/api/contacts').then((d) => setContacts(d.contacts)).catch(() => {});
    api.get('/api/groups').then((d) => setGroups(d.groups)).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return contacts;
    return contacts.filter((c) =>
      c.name.toLowerCase().includes(needle) || (c.email || '').toLowerCase().includes(needle));
  }, [contacts, q]);

  const groupMemberIds = useMemo(() => {
    const set = new Set();
    for (const c of contacts) {
      for (const gid of c.group_ids || []) {
        if (sel.group_ids.includes(gid)) set.add(c.id);
      }
    }
    return set;
  }, [contacts, sel.group_ids]);

  const effectiveCount = useMemo(() => {
    const ids = new Set(sel.contact_ids);
    for (const id of groupMemberIds) ids.add(id);
    return ids.size + sel.new_contacts.filter((n) => n.name.trim()).length;
  }, [sel, groupMemberIds]);

  function toggleContact(id) {
    const has = sel.contact_ids.includes(id);
    onChange({ ...sel, contact_ids: has ? sel.contact_ids.filter((x) => x !== id) : [...sel.contact_ids, id] });
  }
  function toggleGroup(id) {
    const has = sel.group_ids.includes(id);
    onChange({ ...sel, group_ids: has ? sel.group_ids.filter((x) => x !== id) : [...sel.group_ids, id] });
  }
  function setNew(i, patch) {
    const next = sel.new_contacts.map((n, j) => (j === i ? { ...n, ...patch } : n));
    onChange({ ...sel, new_contacts: next });
  }
  function addNewRow() {
    onChange({ ...sel, new_contacts: [...sel.new_contacts, { name: '', email: '' }] });
  }
  function removeNewRow(i) {
    onChange({ ...sel, new_contacts: sel.new_contacts.filter((_, j) => j !== i) });
  }

  return (
    <div>
      {groups.length > 0 ? (
        <Field label="Invite whole groups">
          <div className="chip-row">
            {groups.map((g) => {
              const active = sel.group_ids.includes(g.id);
              return (
                <button key={g.id} type="button"
                  className="chip"
                  style={active ? { background: 'var(--accent-soft)', color: '#3730a3', fontWeight: 600 } : {}}
                  onClick={() => toggleGroup(g.id)}>
                  {active ? '✓ ' : ''}{g.name} ({g.member_count})
                </button>
              );
            })}
          </div>
        </Field>
      ) : null}

      <Field label="Pick individual contacts">
        <input className="search-input" placeholder="Search contacts…" value={q}
          onChange={(e) => setQ(e.target.value)} />
      </Field>
      <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 9 }}>
        {filtered.length === 0 ? (
          <p className="muted" style={{ padding: '14px 16px' }}>
            {contacts.length === 0 ? 'No contacts yet — add new people below, or import contacts first.' : 'No matches.'}
          </p>
        ) : (
          <table className="table">
            <tbody>
              {filtered.map((c) => {
                const viaGroup = groupMemberIds.has(c.id);
                const invited = alreadyInvited.has((c.email || '').toLowerCase()) && c.email;
                return (
                  <tr key={c.id}>
                    <td style={{ width: 30 }}>
                      <input type="checkbox"
                        checked={sel.contact_ids.includes(c.id) || viaGroup}
                        disabled={viaGroup}
                        onChange={() => toggleContact(c.id)} />
                    </td>
                    <td>
                      <span className="t-main">{c.name}</span>
                      {c.unsubscribed_at ? <span className="badge badge-amber" style={{ marginLeft: 8 }}>Unsubscribed</span> : null}
                      {invited ? <span className="badge badge-gray" style={{ marginLeft: 8 }}>Already invited</span> : null}
                      <div className="t-sub">{c.email || <em>no email — can't receive invitations</em>}</div>
                    </td>
                    <td className="t-sub" style={{ textAlign: 'right' }}>
                      {viaGroup ? 'via group' : ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <Field label="Add new people" hint="They'll also be saved to your contact list.">
        {sel.new_contacts.map((n, i) => (
          <div key={i} className="row" style={{ marginBottom: 8 }}>
            <input style={{ flex: 1 }} placeholder="Name" value={n.name}
              onChange={(e) => setNew(i, { name: e.target.value })} />
            <input style={{ flex: 1.2 }} placeholder="email@example.com" type="email" value={n.email}
              onChange={(e) => setNew(i, { email: e.target.value })} />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeNewRow(i)}>✕</button>
          </div>
        ))}
        <button type="button" className="btn btn-sm" onClick={addNewRow}>+ Add a person</button>
      </Field>

      <div className="banner banner-info" style={{ marginBottom: 0 }}>
        {effectiveCount === 0 ? 'No guests selected yet — you can also skip this and share the event link instead.'
          : `${effectiveCount} guest${effectiveCount === 1 ? '' : 's'} selected.`}
      </div>
    </div>
  );
}
