// Thin API client. Every request carries the CSRF header the server demands;
// 401s bubble up to the auth provider which returns the user to the login
// screen.

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

let unauthorizedHandler = null;
export function onUnauthorized(fn) {
  unauthorizedHandler = fn;
}

async function request(method, url, body) {
  const options = {
    method,
    headers: { 'x-requested-with': 'sjc-vite' },
    credentials: 'same-origin',
  };
  if (body !== undefined) {
    options.headers['content-type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(url, options);
  } catch {
    throw new ApiError('Could not reach the server. Is it running?', 0);
  }
  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  const data = isJson ? await res.json().catch(() => null) : await res.text();
  if (res.status === 401 && !url.includes('/auth/')) unauthorizedHandler?.();
  if (!res.ok) {
    throw new ApiError((isJson && data?.error) || `Request failed (${res.status})`, res.status);
  }
  return data;
}

export const api = {
  get: (url) => request('GET', url),
  post: (url, body = {}) => request('POST', url, body),
  put: (url, body = {}) => request('PUT', url, body),
  del: (url) => request('DELETE', url),
};

// --- client-side date/time formatting (mirrors the server's) ---------------

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

export function formatWhen(ev) {
  const date = formatDate(ev.date);
  const t1 = formatTime(ev.start_time);
  const t2 = formatTime(ev.end_time);
  const time = t1 && t2 ? `${t1} – ${t2}` : t1;
  const tz = ev.timezone_note ? ` (${ev.timezone_note})` : '';
  if (date && time) return `${date} · ${time}${tz}`;
  return date ? `${date}${tz}` : 'Date TBD';
}

export function timeAgo(sqlTs) {
  if (!sqlTs) return '';
  const then = new Date(sqlTs.replace(' ', 'T') + 'Z').getTime();
  if (Number.isNaN(then)) return sqlTs;
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return sqlTs.slice(0, 10);
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function downloadUrl(path) {
  return path; // same-origin; cookies ride along automatically
}
