import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Spinner, Modal, ConfirmModal, Empty, Field, useToast } from '../ui.jsx';

function VenueModal({ venue, onClose, onSaved }) {
  const toast = useToast();
  const editing = Boolean(venue?.id);
  const [form, setForm] = useState({
    name: venue?.name || '', address: venue?.address || '',
    phone: venue?.phone || '', map_url: venue?.map_url || '',
  });
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      if (editing) await api.put(`/api/venues/${venue.id}`, form);
      else await api.post('/api/venues', form);
      toast('Venue saved');
      onSaved();
    } catch (err) {
      toast(err.message, 'bad');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={editing ? `Edit ${venue.name}` : 'New venue'} onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={busy || !form.name.trim()}>
            {busy ? 'Saving…' : 'Save venue'}
          </button>
        </>
      }>
      <Field label="Venue name *">
        <input value={form.name} maxLength={200} autoFocus
          onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </Field>
      <Field label="Address">
        <input value={form.address} maxLength={400} placeholder="12 River Rd, Springfield"
          onChange={(e) => setForm({ ...form, address: e.target.value })} />
      </Field>
      <div className="field-row">
        <Field label="Phone">
          <input value={form.phone} maxLength={50} placeholder="(555) 123-4567"
            onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
        <Field label="Map link" hint="Google Maps / directions URL.">
          <input value={form.map_url} maxLength={2000} placeholder="https://maps.google.com/…"
            onChange={(e) => setForm({ ...form, map_url: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

export default function Venues() {
  const toast = useToast();
  const [venues, setVenues] = useState(null);
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setVenues((await api.get('/api/venues')).venues);
  }
  useEffect(() => { load().catch((e) => toast(e.message, 'bad')); }, []);

  if (!venues) return <div className="page"><Spinner /></div>;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Venues</h1>
          <p className="page-sub">Reusable locations you can drop into any event from the wizard.</p>
        </div>
        <div className="head-actions">
          <a className="btn" href="/api/export/venues.csv">Export CSV</a>
          <button className="btn btn-primary" onClick={() => setModal({ type: 'new' })}>+ New venue</button>
        </div>
      </div>

      {venues.length === 0 ? (
        <div className="card">
          <Empty icon="📍" title="No venues yet"
            action={<button className="btn btn-primary" onClick={() => setModal({ type: 'new' })}>Add a venue</button>}>
            Save the places you host at — name, address, phone, and a map link — then pick them in the event wizard.
          </Empty>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Name</th><th>Address</th><th>Phone</th><th>Map</th><th></th></tr></thead>
              <tbody>
                {venues.map((v) => (
                  <tr key={v.id}>
                    <td className="t-main">{v.name}</td>
                    <td className="t-sub">{v.address || '—'}</td>
                    <td className="t-sub">{v.phone || '—'}</td>
                    <td>{v.map_url
                      ? <a href={v.map_url} target="_blank" rel="noreferrer">Map ↗</a>
                      : <span className="t-sub">—</span>}</td>
                    <td>
                      <div className="t-actions">
                        <button className="btn btn-sm" onClick={() => setModal({ type: 'edit', venue: v })}>Edit</button>
                        <button className="btn btn-sm btn-ghost" onClick={() => setModal({ type: 'delete', venue: v })}>🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal?.type === 'new' || modal?.type === 'edit' ? (
        <VenueModal venue={modal.venue} onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }} />
      ) : null}

      {modal?.type === 'delete' ? (
        <ConfirmModal title="Delete venue?" danger busy={busy}
          message={`Delete "${modal.venue.name}"? Events that already use it keep their saved location.`}
          confirmLabel="Delete" onClose={() => setModal(null)}
          onConfirm={async () => {
            setBusy(true);
            try {
              await api.del(`/api/venues/${modal.venue.id}`);
              toast('Venue deleted');
              setModal(null);
              await load();
            } catch (err) { toast(err.message, 'bad'); }
            finally { setBusy(false); }
          }} />
      ) : null}
    </div>
  );
}
