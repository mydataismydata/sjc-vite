// Placeholder ("merge tag") support for invitation text. Tags look like
// {{event_date}} and are replaced per-recipient at send time.
import { formatDate, formatTimeRange, firstName } from './format.js';

export const TAG_DEFS = [
  { tag: 'first_name', label: 'Guest first name', sample: 'Alex' },
  { tag: 'recipient_name', label: 'Guest full name', sample: 'Alex Rivera' },
  { tag: 'event_title', label: 'Event title', sample: 'Summer Gala' },
  { tag: 'event_date', label: 'Event date', sample: 'Saturday, August 15, 2026' },
  { tag: 'event_time', label: 'Event time', sample: '6:00 PM – 9:00 PM' },
  { tag: 'venue_name', label: 'Venue name', sample: 'Riverside Hall' },
  { tag: 'venue_address', label: 'Venue address', sample: '12 River Rd, Springfield' },
  { tag: 'host_name', label: 'Host name', sample: 'The Events Committee' },
  { tag: 'rsvp_deadline', label: 'RSVP deadline', sample: 'Friday, August 7, 2026' },
  { tag: 'event_description', label: 'Event description', sample: 'An evening of music and dinner.' },
  { tag: 'org_name', label: 'Organization name', sample: 'Community Club' },
  { tag: 'event_link', label: 'Event page link', sample: 'https://example.org/o/club/e/x2m4pw93qk' },
  { tag: 'rsvp_link', label: 'Personal RSVP link', sample: 'https://example.org/o/club/i/AbC123' },
  { tag: 'accept_link', label: 'Accept link', sample: 'https://example.org/o/club/i/AbC123/accept' },
  { tag: 'decline_link', label: 'Decline link', sample: 'https://example.org/o/club/i/AbC123/decline' },
];

// Build the tag -> value map for one recipient of one event.
export function buildTagContext({ org, event, inviteName, links = {} }) {
  const name = String(inviteName || '').trim();
  return {
    first_name: firstName(name) || 'there',
    recipient_name: name || 'there',
    event_title: event.title || '',
    event_date: formatDate(event.date) || 'Date to be announced',
    event_time: formatTimeRange(event.start_time, event.end_time) || '',
    venue_name: event.venue_name || '',
    venue_address: event.venue_address || '',
    host_name: event.host_name || org.name || '',
    rsvp_deadline: formatDate(event.rsvp_deadline) || '',
    event_description: event.description || '',
    org_name: org.name || '',
    event_link: links.event || '',
    rsvp_link: links.rsvp || '',
    accept_link: links.accept || '',
    decline_link: links.decline || '',
  };
}

// Replace {{ tag }} occurrences in plain text. Unknown tags become ''.
export function renderTags(text, ctx) {
  return String(text || '').replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_m, tag) => {
    const key = tag.toLowerCase();
    return Object.hasOwn(ctx, key) ? String(ctx[key]) : '';
  });
}

export function sampleContext(org) {
  const ctx = {};
  for (const def of TAG_DEFS) ctx[def.tag] = def.sample;
  if (org?.name) ctx.org_name = org.name;
  return ctx;
}
