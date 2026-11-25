// GET /api/links/<id>  ->  { data }   (the booking behind a short link)
import { json } from '../../_shared.js';

export async function onRequestGet({ params, env }) {
  if (!env.LINKS) return json({ error: 'not-configured' }, 503);
  const id = String(params.id || '');
  if (!/^[a-z0-9]{6,16}$/.test(id)) return json({ error: 'not-found' }, 404);
  const raw = await env.LINKS.get('l:' + id);
  if (!raw) return json({ error: 'not-found' }, 404);
  return json({ data: JSON.parse(raw) });
}
