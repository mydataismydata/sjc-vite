import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

let cachedTags = null;

// One-click insertion of merge tags ({{event_date}}, {{venue_name}}, …) into
// a subject or body field at the caret position.
export default function TagButtons({ onInsert, compact }) {
  const [tags, setTags] = useState(cachedTags || []);
  useEffect(() => {
    if (cachedTags) return;
    api.get('/api/merge-tags').then((d) => { cachedTags = d.tags; setTags(d.tags); }).catch(() => {});
  }, []);
  const shown = compact
    ? tags.filter((t) => ['first_name', 'event_title', 'event_date', 'event_time', 'venue_name', 'host_name', 'rsvp_deadline'].includes(t.tag))
    : tags;
  if (shown.length === 0) return null;
  return (
    <div className="chip-row" style={{ marginTop: 6 }}>
      {shown.map((t) => (
        <button
          key={t.tag}
          type="button"
          className="tag-btn"
          title={`${t.label} — e.g. ${t.sample}`}
          onClick={() => onInsert(`{{${t.tag}}}`)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
