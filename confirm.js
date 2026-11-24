/* ============================================================
   Booking confirmation links (shared by the app and admin.html)

   Ciro confirms a booking by sending the customer a link:
     index.html#/confirm/<payload>.<signature>
   payload   = booking details (JSON, base64url)
   signature = ECDSA P-256 signature of the payload, made with the
               private key that lives ONLY on Ciro's device (admin.html).
   The app verifies it with CONFIG.confirmPublicKey, so a customer
   cannot create or edit a confirmation by themselves.
   ============================================================ */

const B64U = {
  enc(bytes) {
    let s = '';
    new Uint8Array(bytes).forEach(b => { s += String.fromCharCode(b); });
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  dec(str) {
    let s = String(str).replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    return Uint8Array.from(atob(s), c => c.charCodeAt(0));
  },
};

const ECDSA_KEY = { name: 'ECDSA', namedCurve: 'P-256' };
const ECDSA_SIG = { name: 'ECDSA', hash: 'SHA-256' };
const utf8 = s => new TextEncoder().encode(s);

// Booking codes avoid look-alike characters (0/O, 1/I/L)
function makeBookingCode() {
  const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const r = crypto.getRandomValues(new Uint8Array(5));
  return 'MC-' + Array.from(r, n => abc[n % abc.length]).join('');
}

async function signConfirmation(privateJwk, data) {
  const key = await crypto.subtle.importKey('jwk', privateJwk, ECDSA_KEY, false, ['sign']);
  const payload = B64U.enc(utf8(JSON.stringify({ v: 1, ...data })));
  const sig = await crypto.subtle.sign(ECDSA_SIG, key, utf8(payload));
  return payload + '.' + B64U.enc(sig);
}

// → { ok: true, data } or { ok: false, reason: 'not-setup' | 'invalid' }
async function verifyConfirmation(token, publicJwk) {
  if (!publicJwk) return { ok: false, reason: 'not-setup' };
  try {
    const [payload, sig] = String(token).split('.');
    if (!payload || !sig) return { ok: false, reason: 'invalid' };
    const key = await crypto.subtle.importKey('jwk', publicJwk, ECDSA_KEY, false, ['verify']);
    const ok = await crypto.subtle.verify(ECDSA_SIG, key, B64U.dec(sig), utf8(payload));
    if (!ok) return { ok: false, reason: 'invalid' };
    return { ok: true, data: JSON.parse(new TextDecoder().decode(B64U.dec(payload))) };
  } catch {
    return { ok: false, reason: 'invalid' };
  }
}


/* ============================================================
   Compact links (v2): index.html#/c/<payload>.<signature>
   Instead of JSON, the payload is a few bytes: kind, booking code, date,
   time, guests, price, tour number, plus optional text (title, name,
   pick-up, ship/flight/train) ONLY when it differs from what the customer
   asked for. The signature (ECDSA, 64 bytes) covers every byte.
   ============================================================ */

// Fixed order: new tours are only ever appended, so old links keep working
const TOUR_IDS = ['opt1', 'opt2', 'opt2b', 'opt3', 'opt3b', 'opt4', 'opt5', 'opt6', 'opt7', 'opt8', 'opt8b'];
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const KINDS = ['private', 'shared', 'transfer'];
const TEXT_FIELDS = [['t', 1], ['n', 2], ['u', 4], ['s', 8]];       // title, name, pick-up, ship/flight/train
const EPOCH_DAYS = Date.UTC(2024, 0, 1) / 864e5;
const pad2 = n => String(n).padStart(2, '0');

function codeToNum(code) {
  const m = /^MC-([ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5})$/.exec(String(code));
  if (!m) return null;
  let n = 0;
  for (const ch of m[1]) n = n * 31 + CODE_ALPHABET.indexOf(ch);
  return n;
}
function numToCode(n) {
  let s = '';
  for (let i = 0; i < 5; i++) { s = CODE_ALPHABET[n % 31] + s; n = Math.floor(n / 31); }
  return 'MC-' + s;
}
const dateToDays = ds => { const [y, m, d] = ds.split('-').map(Number); return Date.UTC(y, m - 1, d) / 864e5 - EPOCH_DAYS; };
const daysToDate = n => { const dt = new Date((n + EPOCH_DAYS) * 864e5); return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`; };

// → bytes, or null when something does not fit (the caller then uses the long format)
function packBooking(d, mask) {
  const num = codeToNum(d.c);
  const days = d.d ? dateToDays(d.d) : NaN;
  const kind = KINDS.indexOf(d.k);
  if (num == null || kind < 0 || !Number.isInteger(days) || days < 0 || days > 65535 || !(d.p >= 1 && d.p <= 255)) return null;
  let minutes = 0xFFFF;
  if (d.h && /^\d{1,2}:\d{2}$/.test(d.h)) { const [h, m] = d.h.split(':').map(Number); minutes = h * 60 + m; }
  const price = d.e != null && d.e > 0 && d.e < 65535 ? Math.round(d.e) : 0;
  const tourIdx = d.o ? TOUR_IDS.indexOf(d.o) : -1;
  const text = utf8(TEXT_FIELDS.filter(([, bit]) => mask & bit).map(([k]) => String(d[k] || '').replace(/\n/g, ' ')).join('\n'));
  const out = new Uint8Array(14 + text.length);
  out[0] = 0x20 | kind;
  out[1] = Math.floor(num / 16777216) % 256; out[2] = Math.floor(num / 65536) % 256; out[3] = Math.floor(num / 256) % 256; out[4] = num % 256;
  out[5] = days >> 8; out[6] = days & 255;
  out[7] = minutes >> 8; out[8] = minutes & 255;
  out[9] = d.p;
  out[10] = price >> 8; out[11] = price & 255;
  out[12] = tourIdx < 0 ? 255 : tourIdx;
  out[13] = mask;
  out.set(text, 14);
  return out;
}

function unpackBooking(b) {
  if (b.length < 14 || (b[0] >> 4) !== 2) return null;
  const kind = KINDS[b[0] & 15];
  if (!kind) return null;
  const out = {
    c: numToCode(((b[1] * 256 + b[2]) * 256 + b[3]) * 256 + b[4]), k: kind,
    d: daysToDate(b[5] * 256 + b[6]), p: b[9],
  };
  const mins = b[7] * 256 + b[8];
  if (mins !== 0xFFFF) out.h = pad2(Math.floor(mins / 60)) + ':' + pad2(mins % 60);
  const price = b[10] * 256 + b[11];
  if (price) out.e = price;
  if (b[12] !== 255 && TOUR_IDS[b[12]]) out.o = TOUR_IDS[b[12]];
  const parts = new TextDecoder().decode(b.slice(14)).split('\n');
  let i = 0;
  TEXT_FIELDS.forEach(([k, bit]) => { if (b[13] & bit) out[k] = parts[i++] ?? ''; });
  if (!out.t && out.o) { const t = TOURS.find(x => x.id === out.o); if (t) out.t = `${t.code} · ${t.title}`; }
  return out;
}

async function signCompact(privateJwk, d, mask) {
  const bytes = packBooking(d, mask);
  if (!bytes) return null;
  const key = await crypto.subtle.importKey('jwk', privateJwk, ECDSA_KEY, false, ['sign']);
  const sig = await crypto.subtle.sign(ECDSA_SIG, key, bytes);
  return B64U.enc(bytes) + '.' + B64U.enc(sig);
}

// → { ok: true, data } or { ok: false, reason: 'not-setup' | 'invalid' }
async function verifyCompact(token, publicJwk) {
  if (!publicJwk) return { ok: false, reason: 'not-setup' };
  try {
    const [payload, sig] = String(token).split('.');
    if (!payload || !sig) return { ok: false, reason: 'invalid' };
    const bytes = B64U.dec(payload);
    const key = await crypto.subtle.importKey('jwk', publicJwk, ECDSA_KEY, false, ['verify']);
    if (!(await crypto.subtle.verify(ECDSA_SIG, key, B64U.dec(sig), bytes))) return { ok: false, reason: 'invalid' };
    const data = unpackBooking(bytes);
    return data ? { ok: true, data } : { ok: false, reason: 'invalid' };
  } catch {
    return { ok: false, reason: 'invalid' };
  }
}
