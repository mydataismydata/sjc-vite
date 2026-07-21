// Human-friendly formatting for dates and times. Event dates/times are
// stored exactly as entered (wall-clock strings), so formatting is pure
// string work — no timezone conversion happens anywhere.

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

export function formatDate(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${DAYS[dt.getUTCDay()]}, ${MONTHS[m - 1]} ${d}, ${y}`;
}

export function formatDateShort(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return `${MONTHS[m - 1].slice(0, 3)} ${d}, ${y}`;
}

export function formatTime(hhmm) {
  if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return '';
  let [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return m === 0 ? `${h}:00 ${suffix}` : `${h}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function formatTimeRange(start, end) {
  const a = formatTime(start);
  const b = formatTime(end);
  if (a && b) return `${a} – ${b}`;
  return a || '';
}

export function formatWhen(event) {
  const date = formatDate(event.date);
  const time = formatTimeRange(event.start_time, event.end_time);
  const tz = event.timezone_note ? ` (${event.timezone_note})` : '';
  if (date && time) return `${date} · ${time}${tz}`;
  return date ? `${date}${tz}` : 'Date to be announced';
}

export function firstName(fullName) {
  const s = String(fullName || '').trim();
  if (!s) return '';
  return s.split(/\s+/)[0];
}
