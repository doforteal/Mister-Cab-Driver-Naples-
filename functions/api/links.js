// POST /api/links  { payload, sig }  ->  { id }
// Only Ciro can create or update a link: the request must carry his signature.
import { json, verifySignature, cleanData, newId } from '../_shared.js';

const TWO_YEARS = 60 * 60 * 24 * 730;

export async function onRequestPost({ request, env }) {
  if (!env.LINKS) return json({ error: 'not-configured' }, 503);        // the KV storage is not connected yet
  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad-request' }, 400); }
  const { payload, sig } = body || {};
  if (typeof payload !== 'string' || typeof sig !== 'string' || payload.length > 4000) return json({ error: 'bad-request' }, 400);
  if (!(await verifySignature(payload, sig))) return json({ error: 'forbidden' }, 403);

  let msg;
  try { msg = JSON.parse(payload); } catch { return json({ error: 'bad-request' }, 400); }
  if (!msg || Math.abs(Date.now() - Number(msg.ts)) > 10 * 60 * 1000) return json({ error: 'expired' }, 400);   // stops old requests from being replayed
  const data = cleanData(msg.data);
  if (!data) return json({ error: 'invalid-data' }, 400);

  // One stable link per booking: confirming again after a change updates the same link
  let id = await env.LINKS.get('b:' + data.c);
  if (!id) id = newId();
  await env.LINKS.put('l:' + id, JSON.stringify(data), { expirationTtl: TWO_YEARS });
  await env.LINKS.put('b:' + data.c, id, { expirationTtl: TWO_YEARS });
  return json({ id });
}
