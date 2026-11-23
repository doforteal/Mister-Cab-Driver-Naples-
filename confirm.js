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
