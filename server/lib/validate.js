// Request validation helpers. Every validator either returns a normalized
// value or throws ApiError(400), which the central error handler turns into
// a JSON response.

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function wrap(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export const v = {
  str(value, { label = 'value', min = 0, max = 10000, required = true } = {}) {
    if (value === undefined || value === null) value = '';
    if (typeof value !== 'string') throw new ApiError(400, `${label} must be text`);
    value = value.trim();
    if (required && value.length < Math.max(min, 1)) throw new ApiError(400, `${label} is required`);
    if (value.length < min) throw new ApiError(400, `${label} must be at least ${min} characters`);
    if (value.length > max) throw new ApiError(400, `${label} must be at most ${max} characters`);
    return value;
  },
  optStr(value, opts = {}) {
    return v.str(value, { ...opts, required: false });
  },
  email(value, { label = 'email', required = true } = {}) {
    const s = v.str(value, { label, required, max: 254 }).toLowerCase();
    if (!s && !required) return '';
    if (!EMAIL_RE.test(s)) throw new ApiError(400, `${label} is not a valid email address`);
    return s;
  },
  optEmail(value, opts = {}) {
    return v.email(value, { ...opts, required: false });
  },
  date(value, { label = 'date', required = true } = {}) {
    const s = v.str(value, { label, required, max: 10 });
    if (!s && !required) return '';
    if (!DATE_RE.test(s) || Number.isNaN(Date.parse(s + 'T00:00:00'))) {
      throw new ApiError(400, `${label} must be a valid date (YYYY-MM-DD)`);
    }
    return s;
  },
  time(value, { label = 'time', required = false } = {}) {
    const s = v.str(value, { label, required, max: 5 });
    if (!s && !required) return '';
    if (!TIME_RE.test(s)) throw new ApiError(400, `${label} must be a valid time (HH:MM, 24h)`);
    return s;
  },
  int(value, { label = 'number', min = -1e9, max = 1e9, required = true, fallback = null } = {}) {
    if (value === undefined || value === null || value === '') {
      if (required) throw new ApiError(400, `${label} is required`);
      return fallback;
    }
    const n = Number(value);
    if (!Number.isInteger(n)) throw new ApiError(400, `${label} must be a whole number`);
    if (n < min || n > max) throw new ApiError(400, `${label} must be between ${min} and ${max}`);
    return n;
  },
  bool(value, fallback = false) {
    if (value === undefined || value === null) return fallback;
    return value === true || value === 1 || value === '1' || value === 'true' || value === 'on';
  },
  oneOf(value, allowed, { label = 'value', fallback = undefined } = {}) {
    if ((value === undefined || value === null || value === '') && fallback !== undefined) return fallback;
    if (!allowed.includes(value)) throw new ApiError(400, `${label} must be one of: ${allowed.join(', ')}`);
    return value;
  },
  url(value, { label = 'URL', required = false } = {}) {
    const s = v.str(value, { label, required, max: 2000 });
    if (!s && !required) return '';
    if (!/^https?:\/\/[^\s]+$/i.test(s)) throw new ApiError(400, `${label} must be a valid link starting with http:// or https://`);
    return s;
  },
  hexColor(value, { label = 'color', fallback = null } = {}) {
    if (value === undefined || value === null || value === '') return fallback;
    const s = String(value).trim();
    if (!HEX_RE.test(s)) throw new ApiError(400, `${label} must be a hex color like #4a90d9`);
    return s.toLowerCase();
  },
  intArray(value, { label = 'list', maxLength = 10000 } = {}) {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) throw new ApiError(400, `${label} must be an array`);
    if (value.length > maxLength) throw new ApiError(400, `${label} is too long`);
    return value.map((x) => {
      const n = Number(x);
      if (!Number.isInteger(n) || n < 0) throw new ApiError(400, `${label} must contain ids`);
      return n;
    });
  },
};

export function isValidEmail(value) {
  return typeof value === 'string' && EMAIL_RE.test(value.trim());
}
