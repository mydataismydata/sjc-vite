// Random identifiers and crypto helpers.
import crypto from 'node:crypto';

const BASE62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
// Slug alphabet avoids ambiguous characters (0/O, 1/l/I) since these appear in URLs people may retype.
const SLUG_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

function fromAlphabet(alphabet, length) {
  let out = '';
  while (out.length < length) {
    const bytes = crypto.randomBytes(length * 2);
    for (const b of bytes) {
      // Rejection sampling keeps the distribution uniform.
      if (b < Math.floor(256 / alphabet.length) * alphabet.length) {
        out += alphabet[b % alphabet.length];
        if (out.length === length) break;
      }
    }
  }
  return out;
}

export function randomToken(length = 24) {
  return fromAlphabet(BASE62, length);
}

export function randomSlug(length = 10) {
  return fromAlphabet(SLUG_ALPHABET, length);
}

export function sha256hex(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

export function hmacHex(secret, value) {
  return crypto.createHmac('sha256', secret).update(String(value)).digest('hex');
}

// Constant-time string comparison that tolerates unequal lengths.
export function safeEqual(a, b) {
  const da = crypto.createHash('sha256').update(String(a)).digest();
  const db = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(da, db);
}
