// Outbound email via the SMTP2GO HTTP API, plus account quota lookup.
//
// When no API key is configured (neither the SMTP2GO_API_KEY environment
// variable nor the per-organization setting), the app runs in SIMULATION
// mode: messages are rendered and logged exactly as they would be sent, and
// marked "simulated". This makes the whole system testable end-to-end before
// any email provider is wired up.
import { config } from './env.js';
import { getSetting } from './db.js';

const API_BASE = 'https://api.smtp2go.com/v3';

export function orgApiKey(db) {
  return getSetting(db, 'smtp2go_api_key', '') || config.smtp2goApiKey || '';
}

export function orgSender(db, orgName) {
  const email = getSetting(db, 'sender_email', '');
  const name = getSetting(db, 'sender_name', '') || orgName;
  return { email, name };
}

export function senderHeader(sender) {
  // "Display Name <email>" with quotes stripped from the name to keep the
  // header well-formed.
  const cleanName = String(sender.name || '').replace(/["<>]/g, '').trim();
  return cleanName ? `${cleanName} <${sender.email}>` : sender.email;
}

async function apiPost(path, apiKey, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Smtp2go-Api-Key': apiKey,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON error body */ }
  return { status: res.status, data };
}

export async function sendEmail({ apiKey, sender, replyTo, toName, toEmail, subject, html, text, headers = [] }) {
  if (!apiKey) {
    return { ok: true, simulated: true, id: null };
  }
  if (!sender?.email) {
    return { ok: false, error: 'Sender email is not configured (Settings → Sending).' };
  }
  const to = toName ? `${String(toName).replace(/["<>]/g, '').trim()} <${toEmail}>` : toEmail;
  const payload = {
    sender: senderHeader(sender),
    to: [to],
    subject,
    html_body: html,
    text_body: text,
  };
  if (replyTo) payload.custom_headers = [{ header: 'Reply-To', value: replyTo }];
  if (headers.length) payload.custom_headers = [...(payload.custom_headers || []), ...headers];
  try {
    const { status, data } = await apiPost('/email/send', apiKey, payload);
    if (status === 200 && data?.data?.succeeded >= 1) {
      return { ok: true, simulated: false, id: data.data.email_id || '' };
    }
    const detail = data?.data?.failures?.join('; ')
      || data?.data?.error
      || data?.error
      || `SMTP2GO responded with HTTP ${status}`;
    return { ok: false, error: String(detail).slice(0, 500) };
  } catch (err) {
    return { ok: false, error: `Could not reach SMTP2GO: ${err.message}`.slice(0, 500) };
  }
}

// Monthly cycle usage from SMTP2GO (how many emails the plan allows, how many
// were used, how many remain). Cached briefly to avoid hammering the API.
const quotaCache = new Map(); // apiKey -> { at, value }

export async function getQuota(apiKey) {
  if (!apiKey) return { configured: false };
  const cached = quotaCache.get(apiKey);
  if (cached && Date.now() - cached.at < 5 * 60 * 1000) return cached.value;
  try {
    const { status, data } = await apiPost('/stats/email_cycle', apiKey, {});
    const d = data?.data || {};
    if (status !== 200) {
      const value = { configured: true, error: d.error || data?.error || `HTTP ${status}` };
      quotaCache.set(apiKey, { at: Date.now(), value });
      return value;
    }
    const used = Number(d.cycle_used ?? d.used ?? 0);
    const max = Number(d.cycle_max ?? d.allowed ?? 0);
    const remaining = Number(d.cycle_remaining ?? d.remaining ?? (max ? max - used : 0));
    const value = {
      configured: true,
      used,
      max,
      remaining,
      cycle_start: d.cycle_start || '',
      cycle_end: d.cycle_end || '',
    };
    quotaCache.set(apiKey, { at: Date.now(), value });
    return value;
  } catch (err) {
    return { configured: true, error: `Could not reach SMTP2GO: ${err.message}` };
  }
}
