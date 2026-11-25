// Shared helpers of the short confirmation links (Cloudflare Pages Functions).
//
// How it works: when Ciro confirms a booking, the admin page signs the booking with
// his private key and sends it to POST /api/links. This code checks the signature with
// the PUBLIC key below, stores the booking under a short random id and returns the id.
// The customer opens /c/<id> and the app reads the booking from GET /api/links/<id>.
// Nobody but Ciro can create or change a link, and no secret is stored on the server.

// Must be identical to CONFIG.confirmPublicKey in config.js
export const PUBLIC_KEY = {"kty":"EC","crv":"P-256","x":"GoN5vh8PQj6Y0s4ZAAxqcfUILkhlkdjd9S5wGhNG8R0","y":"44GAJrRAynzZtswDe_m48W8igJ8llFmNzYe23JrynwU"};

const TOUR_IDS = ['opt1', 'opt2', 'opt2b', 'opt3', 'opt3b', 'opt4', 'opt5', 'opt6', 'opt7', 'opt8', 'opt8b'];
const ID_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

export const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});

function fromB64u(str) {
  let s = String(str).replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}

// True only if `sig` is Ciro's signature of exactly `payload`
export async function verifySignature(payload, sig) {
  try {
    const key = await crypto.subtle.importKey('jwk', PUBLIC_KEY, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    return await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, fromB64u(sig), new TextEncoder().encode(payload));
  } catch {
    return false;
  }
}

// Keeps only the fields of a booking, with sane sizes; null if it is not a valid booking
export function cleanData(d) {
  if (!d || typeof d !== 'object') return null;
  const s = (v, n = 200) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
  const out = {
    c: s(d.c, 12).toUpperCase(), k: s(d.k, 12), o: s(d.o, 12), t: s(d.t), d: s(d.d, 10), h: s(d.h, 5),
    p: Math.round(Number(d.p)), u: s(d.u, 300), n: s(d.n), s: s(d.s),
  };
  if (d.e !== null && d.e !== undefined && d.e !== '') {
    const e = Number(d.e);
    if (!Number.isFinite(e) || e < 0 || e > 100000) return null;
    out.e = e;
  }
  if (!/^MC-[A-Z0-9]{5}$/.test(out.c) || !['private', 'shared', 'transfer'].includes(out.k)) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(out.d) || (out.h && !/^\d{2}:\d{2}$/.test(out.h))) return null;
  if (!(out.p >= 1 && out.p <= 255) || !out.t || !out.n) return null;
  if (out.o && !TOUR_IDS.includes(out.o)) out.o = '';
  return out;
}

// 10 random characters (about 50 bits): impossible to guess
export function newId() {
  const r = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(r, n => ID_ALPHABET[n % ID_ALPHABET.length]).join('');
}
