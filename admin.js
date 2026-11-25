/* ============================================================
   admin.html — Ciro's panel: requests, agenda and one-button confirmation
   One access code opens the panel. The signing key is stored encrypted
   in admin-vault.js and only decrypted in the browser with that code.
   The agenda (all requests, confirmed or not) is kept on this device.
   ============================================================ */

const BK_STORE = 'mcc_admin_bookings';
const OLD_HIST = 'mcc_admin_history';       // list of confirmations kept by the previous version
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add('hidden'), 2800);
}

let SIGN_KEY = null;      // private signing key (JWK), only in memory after login

async function copy(text, okMsg) {
  try { await navigator.clipboard.writeText(text); toast(okMsg); }
  catch { toast('Copia non riuscita: seleziona il testo a mano'); }
}

// ── dates ─────────────────────────────────────────────────────
const pad = n => String(n).padStart(2, '0');
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const dObj = ds => new Date(ds + 'T12:00:00');
const fmtLong = d => dObj(d).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fmtShort = d => dObj(d).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const fmtDayHead = d => dObj(d).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

// ── agenda storage ────────────────────────────────────────────
const ST = { pending: ['Da confermare', ''], confirmed: ['Confermata', 'ok'], cancelled: ['Annullata', 'grey'] };
const chip = s => `<span class="chip ${(ST[s] || ST.pending)[1]}">${(ST[s] || ST.pending)[0]}</span>`;
// A new request is a booking still waiting for Ciro to take charge: status stays 'pending' with isNew set,
// so it also reads as 'Da confermare' in any earlier version of the panel.
const isNewReq = b => b.status === 'pending' && !!b.isNew;
const chipFor = b => isNewReq(b) ? '<span class="chip navy">Nuova richiesta</span>' : chip(b.status);
const FILTERS = [
  ['all', 'Tutte', () => true],
  ['new', 'Nuove richieste', isNewReq],
  ['pending', 'Da confermare', b => b.status === 'pending' && !b.isNew],
  ['confirmed', 'Confermate', b => b.status === 'confirmed'],
  ['cancelled', 'Annullate', b => b.status === 'cancelled'],
];
const matchFilter = (b, f) => (FILTERS.find(x => x[0] === f) || FILTERS[0])[2](b);

function loadBookings() { try { return JSON.parse(localStorage.getItem(BK_STORE)) || []; } catch { return []; } }
function saveBookings(a) {
  try { localStorage.setItem(BK_STORE, JSON.stringify(a)); }
  catch { toast('Non riesco a salvare l’agenda su questo telefono'); }
}
const getBooking = c => loadBookings().find(b => b.c === c);
function upsertBooking(rec) {
  const a = loadBookings();
  const i = a.findIndex(b => b.c === rec.c);
  if (i >= 0) a[i] = { ...a[i], ...rec, updatedAt: Date.now() };
  else a.push({ createdAt: Date.now(), ...rec });
  saveBookings(a);
  updateBadge();
  return a.find(b => b.c === rec.c);
}
function removeBooking(c) { saveBookings(loadBookings().filter(b => b.c !== c)); updateBadge(); }

function updateBadge() {
  const t = todayISO();
  const n = loadBookings().filter(b => isNewReq(b) && b.d >= t).length;
  $('#badge').textContent = n ? String(n) : '';
}

// Confirmations kept by the earlier version become agenda entries (once)
function migrateHistory() {
  try {
    if (localStorage.getItem('mcc_admin_migrated')) return;
    const h = JSON.parse(localStorage.getItem(OLD_HIST) || '[]');
    h.forEach(x => {
      try {
        const d = JSON.parse(new TextDecoder().decode(B64U.dec(x.link.split('#/confirm/')[1].split('.')[0])));
        if (d && d.c && !getBooking(d.c)) upsertBooking({
          c: d.c, k: d.k || 'private', o: d.o || '', t: d.t, d: d.d, h: d.h || '', p: d.p || 1, u: d.u || '',
          e: d.e ?? null, n: d.n, s: d.s || '', x: '', phone: x.phone || '', email: x.email || '',
          status: 'confirmed', confirmedAt: x.at, createdAt: x.at,
        });
      } catch { /* skip a broken entry */ }
    });
    localStorage.setItem('mcc_admin_migrated', '1');
  } catch { /* ignore */ }
}

// ── views ─────────────────────────────────────────────────────
function showView(v) {
  $('#view-new').classList.toggle('hidden', v !== 'new');
  $('#view-agenda').classList.toggle('hidden', v !== 'agenda');
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  if (v === 'agenda') renderAgenda();
  window.scrollTo(0, 0);
}
$('#tabs').addEventListener('click', e => {
  const b = e.target.closest('button[data-v]');
  if (!b) return;
  if (b.dataset.v === 'new' && currentCode) startNew();      // leaving a booking behind: start a clean request
  showView(b.dataset.v);
});
$('#back-b').addEventListener('click', () => showView('agenda'));
$('#back-b2').addEventListener('click', () => showView('agenda'));
$('#new-b').addEventListener('click', () => { startNew(); showView('new'); });

// ── editor (form) ─────────────────────────────────────────────
const form = $('#cf');
const tourSel = $('#tour-sel');
tourSel.innerHTML = '<option value="">— altro / scrivi il titolo —</option>' +
  TOURS.map(t => `<option value="${t.id}">${esc(t.code)} · ${esc(t.title)}</option>`).join('');

const val = () => Object.fromEntries(new FormData(form));
const KIND_LABEL = { private: 'Tour privato', shared: 'Tour condiviso', transfer: 'Transfer' };
let currentCode = null;      // booking being edited; null = a new request

tourSel.addEventListener('change', () => {
  const t = TOURS.find(x => x.id === tourSel.value);
  if (t) { form.t.value = `${t.code} · ${t.title}`; form.k.value = 'private'; updatePrice(); }
  renderSummary();
});
function updatePrice() {
  const t = TOURS.find(x => x.id === tourSel.value);
  if (t && form.k.value === 'private' && !form.e.dataset.touched) form.e.value = priceFor(t.scale, +form.p.value) ?? '';
}
form.e.addEventListener('input', () => { form.e.dataset.touched = '1'; });
form.p.addEventListener('input', updatePrice);
form.addEventListener('input', renderSummary);
// The recommended 7:30 is for tours only: a transfer keeps the time the customer chose
form.k.addEventListener('change', () => {
  if (form.k.value === 'transfer' && form.h.value === CONFIG.defaultStart && !currentCode) form.h.value = '';
  else if (form.k.value === 'private' && !form.h.value && !currentCode) form.h.value = CONFIG.defaultStart;
  renderSummary();
});

// What must be there before the booking can be saved or confirmed
const REQUIRED = [['c', 'codice prenotazione'], ['t', 'titolo'], ['d', 'data'], ['p', 'persone'], ['u', 'punto di ritiro'], ['n', 'nome cliente']];
const missing = v => REQUIRED.filter(([k]) => !String(v[k] ?? '').trim()).map(([, l]) => l);

function renderSummary() {
  const v = val();
  const miss = missing(v);
  const any = REQUIRED.some(([k]) => String(v[k] ?? '').trim()) && (v.c || v.n || v.t);
  $('#summary').classList.toggle('hidden', !any);
  const row = (label, value, req) => {
    const empty = !String(value ?? '').trim();
    return `<li><span class="muted">${label}</span><span class="v">${empty ? (req ? '<b class="miss">⚠ manca</b>' : '—') : esc(value)}</span></li>`;
  };
  $('#summary-body').innerHTML = [
    row('Tipo', KIND_LABEL[v.k]),
    row('Codice', v.c, true),
    row('Cliente', v.n, true),
    row('WhatsApp', v.phone),
    row('Email', v.email),
    row('Tour', v.t, true),
    row('Data', v.d ? fmtShort(v.d) : '', true),
    row('Ora', v.h),
    row('Persone', v.p, true),
    row('Ritiro', v.u, true),
    row('Nave / volo', v.s),
    row('Totale', v.e ? '€' + v.e : ''),
    row('Note', v.x),
  ].join('');
  $('#miss-box').innerHTML = miss.length
    ? `<div class="warn-box">Mancano: <b>${miss.join(', ')}</b>. Compilali in “Correggi o completa i dati”.</div>`
    : (!v.phone && !v.email ? `<div class="warn-box">Non c’è né WhatsApp né email del cliente: potrai comunque copiare il messaggio.</div>` : '');
  if (miss.length) $('#edit').open = true;
}

// Booking record from the form
function recordFromForm(status) {
  const f = val();
  return {
    c: f.c.trim().toUpperCase(), k: f.k, o: f.o || '', t: f.t.trim(), d: f.d, h: f.h || '', p: +f.p || 1, u: f.u.trim(),
    e: f.e === '' ? null : +f.e, n: f.n.trim(), s: (f.s || '').trim(), x: (f.x || '').trim(),
    phone: (f.phone || '').trim(), email: (f.email || '').trim(), status,
  };
}
function fillForm(b) {
  form.reset(); delete form.e.dataset.touched;
  tourSel.value = TOURS.some(t => t.id === b.o) ? b.o : '';
  ['c', 'k', 't', 'd', 'h', 'p', 'u', 's', 'n', 'phone', 'email', 'x'].forEach(k => { form[k].value = b[k] ?? ''; });
  form.e.value = b.e ?? '';
  if (b.e != null) form.e.dataset.touched = '1';
  renderSummary();
}

// Shows/hides the buttons that depend on the booking being edited
function refreshEditorUI() {
  const b = currentCode ? getBooking(currentCode) : null;
  $('#paste-card').classList.toggle('hidden', !!b);
  $('#edit-banner').classList.toggle('hidden', !b);
  if (b) $('#edit-banner-text').innerHTML = `<b>${esc(b.c)}</b> · ${esc(b.n)} ${chipFor(b)}<div class="small muted" style="margin-top:4px">Qui puoi modificare tutto, poi salvare o confermare.</div>`;
  form.c.readOnly = !!b;
  $('#confirm').textContent = b && b.status === 'confirmed' ? '✅ Aggiorna e reinvia la conferma' : '✅ Prenotazione completata – Conferma';
  $('#save').textContent = b ? '💾 Salva le modifiche' : '💾 Salva in agenda (senza confermare)';
  $('#take-b').classList.toggle('hidden', !b || !isNewReq(b));
  $('#cancel-b').classList.toggle('hidden', !b || b.status === 'cancelled');
  $('#restore-b').classList.toggle('hidden', !b || b.status !== 'cancelled');
  $('#delete-b').classList.toggle('hidden', !b);
}

function startNew() {
  currentCode = null;
  form.reset(); delete form.e.dataset.touched; tourSel.value = '';
  $('#paste').value = '';
  $('#result').classList.add('hidden');
  $('#summary').classList.add('hidden');
  refreshEditorUI();
}
function openBooking(code) {
  const b = getBooking(code);
  if (!b) return;
  currentCode = code;
  fillForm(b);
  $('#edit').open = false;
  $('#result').classList.add('hidden');
  refreshEditorUI();
  showView('new');
}
$('#manual').addEventListener('click', () => {
  startNew();
  form.c.value = makeBookingCode();
  form.h.value = CONFIG.defaultStart;
  $('#edit').open = true;
  renderSummary();
  $('#summary').scrollIntoView({ behavior: 'smooth' });
});

// ── reading a pasted request ──────────────────────────────────
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
function parseEnglishDate(s) {
  const m = String(s).match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (!m) return '';
  const mi = MONTHS.findIndex(x => x.startsWith(m[2].toLowerCase().slice(0, 3)));
  return mi < 0 ? '' : `${m[3]}-${pad(mi + 1)}-${m[1].padStart(2, '0')}`;
}

// Reads the requests the app sends (WhatsApp or email, same lines)
function parseRequest(txt) {
  const get = label => { const m = txt.match(new RegExp('^[\\s>]*[-•*]?\\s*' + label + '\\s*:\\s*(.+)$', 'im')); return m ? m[1].trim() : ''; };
  const set = (name, v) => { if (v !== undefined && v !== null && v !== '') form[name].value = v; };
  form.reset(); delete form.e.dataset.touched; tourSel.value = '';
  set('c', get('Booking code').toUpperCase());
  set('n', get('Name'));
  set('phone', get('Mobile phone number') || get('Mobile'));
  set('email', get('Email address') || get('Email'));
  let d = get('Date'), time = get('Meeting time');
  const dt = get('Date & time');
  if (dt) d = dt;
  if (!time) { const tm = d.match(/at\s+(\d{1,2}:\d{2})/); if (tm) time = tm[1]; }   // "Date: Sun, 7 Mar 2027 at 08:00"
  const booking = get('Booking');                                                  // line of the chat message
  if (d) set('d', parseEnglishDate(d));
  if (/^\d{1,2}:\d{2}$/.test(time)) set('h', time.padStart(5, '0'));
  const people = parseInt(get('Number of people') || get('Passengers'));
  if (people) set('p', people);
  const ship = get('Ship / flight / train number') || get('Cruise company / ship name') || get('Flight/train/ship');
  set('s', ship.replace(/^-$/, ''));
  const detail = get('Pick-up details');
  const place = loc => detail ? `${loc} (${detail})` : loc;
  set('x', get('Notes'));
  if (/I need a transfer/i.test(txt)) {
    form.k.value = 'transfer';
    const from = get('From'), to = get('To');
    set('t', `Transfer · ${from} to ${to}`); set('u', from);
  } else if (/^Transfer\s*·/i.test(booking)) {
    form.k.value = 'transfer';
    set('t', booking); set('u', place(get('Location')));
  } else if (/shared tour/i.test(txt) || /\(shared\)/i.test(booking)) {
    form.k.value = 'shared';
    set('t', get('Tour') || booking); set('u', place(get('Location')));
  } else {
    form.k.value = 'private';
    const opt = get('Option chosen') || booking;
    // Prefer the longest matching code ("Opt 2 Bis" before "Opt 2")
    const best = opt ? TOURS.filter(t => opt.toLowerCase().startsWith(t.code.toLowerCase())).sort((a, b) => b.code.length - a.code.length)[0] : null;
    if (best) { tourSel.value = best.id; set('t', `${best.code} · ${best.title}`); } else set('t', opt);
    set('u', place(get('Location')));
  }
  const fare = get('Quoted fare').match(/€\s?([\d,.]+)/);
  if (fare) set('e', fare[1].replace(/[,.]/g, '')); else updatePrice();
  renderSummary();
}

// After reading a request: already in the agenda, open it; complete, save it as "da confermare"
function afterParse() {
  const v = val();
  const code = (v.c || '').trim().toUpperCase();
  const ex = code && getBooking(code);
  if (ex) { openBooking(code); toast('Era già in agenda: ' + ST[ex.status][0]); return; }
  if (v.c && v.d && v.n && v.t) {
    const rec = upsertBooking({ ...recordFromForm('pending'), isNew: true, orig: { t: v.t.trim(), n: v.n.trim(), u: v.u.trim(), s: (v.s || '').trim() } });
    currentCode = rec.c;
    refreshEditorUI();
    toast('Salvata in agenda: nuova richiesta');
  } else toast('Richiesta letta: completa i dati mancanti');
}

let pasteTimer;
$('#paste').addEventListener('input', () => {
  clearTimeout(pasteTimer);
  pasteTimer = setTimeout(() => {
    const t = $('#paste').value;
    if (t.trim()) { parseRequest(t); $('#result').classList.add('hidden'); afterParse(); }
  }, 450);
});
$('#clip').addEventListener('click', async () => {
  try {
    const t = await navigator.clipboard.readText();
    if (!t.trim()) { toast('Gli appunti sono vuoti'); return; }
    $('#paste').value = t; parseRequest(t); $('#result').classList.add('hidden'); afterParse();
  } catch { toast('Non riesco a leggere gli appunti: incolla il testo nel riquadro'); }
});

// ── save / cancel / delete ────────────────────────────────────
function validOrWarn() {
  const miss = missing(val());
  if (miss.length) { $('#edit').open = true; toast('Mancano: ' + miss.join(', ')); return false; }
  return true;
}
$('#save').addEventListener('click', () => {
  if (!validOrWarn()) return;
  const ex = getBooking(val().c.trim().toUpperCase());
  const rec = upsertBooking(ex ? recordFromForm(ex.status) : { ...recordFromForm('pending'), isNew: true });
  currentCode = rec.c;
  refreshEditorUI();
  toast(ex && ex.status === 'confirmed' ? 'Modifiche salvate (il cliente non è stato avvisato)' : ex ? 'Modifiche salvate' : 'Salvata in agenda: nuova richiesta');
});
$('#take-b').addEventListener('click', () => {
  upsertBooking({ ...recordFromForm('pending'), isNew: false });
  refreshEditorUI(); toast('Presa in carico: ora è da confermare');
});
$('#cancel-b').addEventListener('click', () => {
  if (!confirm('Segnare questa prenotazione come ANNULLATA?\n\nIl cliente non riceve nessun avviso automatico: scrivigli tu.')) return;
  upsertBooking({ ...recordFromForm('cancelled'), isNew: false });
  refreshEditorUI(); toast('Prenotazione annullata');
});
$('#restore-b').addEventListener('click', () => {
  upsertBooking({ ...recordFromForm('pending'), isNew: false });
  refreshEditorUI(); toast('Riattivata: da confermare');
});
$('#delete-b').addEventListener('click', () => {
  if (!confirm('ELIMINARE definitivamente questa prenotazione dall’agenda?')) return;
  removeBooking(currentCode);
  startNew(); showView('agenda'); toast('Eliminata dall’agenda');
});

// ── confirm ───────────────────────────────────────────────────
const digitsOf = p => (p || '').replace(/[^\d]/g, '');

async function createConfirmation() {
  if (!SIGN_KEY) { toast('Accedi di nuovo con il codice'); return; }
  if (!validOrWarn()) return;
  const f = val();
  if (!confirm(`Confermare la prenotazione ${f.c.trim().toUpperCase()} di ${f.n.trim()} (${fmtShort(f.d)})?\n\nIl cliente riceverà il link di conferma.`)) return;
  const data = {
    c: f.c.trim().toUpperCase(), k: f.k, o: f.o || undefined, t: f.t.trim(), d: f.d, h: f.h || undefined,
    p: +f.p, u: f.u.trim(), e: f.e === '' ? undefined : +f.e, n: f.n.trim(), s: (f.s || '').trim() || undefined,
  };
  // Short link: text fields travel only when they differ from what the customer sent
  const b0 = currentCode ? getBooking(currentCode) : null;
  const orig = b0 && b0.orig;
  const tourDef = TOURS.find(t => t.id === data.o);
  const defTitle = tourDef ? `${tourDef.code} · ${tourDef.title}` : null;
  const cur = { t: data.t, n: data.n, u: data.u, s: data.s || '' };
  let mask = 0;
  TEXT_FIELDS.forEach(([k, bit]) => {
    const same = k === 't' && defTitle ? cur.t === defTitle : !!orig && (orig[k] || '') === cur[k];
    if (!same) mask |= bit;
  });
  const base = CONFIG.appUrl || new URL('./', location.href).href.split('#')[0];
  // 1) short link (needs the online storage); 2) otherwise the compact link; 3) the long one for unusual values
  const shortId = await makeShortLink(data);
  let link, linkKind;
  if (shortId) { link = `${base}c/${shortId}`; linkKind = 'short'; }
  else {
    let token = await signCompact(SIGN_KEY, data, mask), path = 'c';
    if (!token) { token = await signConfirmation(SIGN_KEY, data); path = 'confirm'; }
    link = `${base}#/${path}/${token}`; linkKind = 'normal';
  }
  const balance = data.k === 'private' && data.e ? data.e - CONFIG.depositAmount : null;
  const first = data.n.split(/\s+/)[0];
  const lines = [
    `Dear ${first},`, '',
    'We are pleased to confirm your booking.', '',
    `Tour: ${data.t}`,
    `Date: ${fmtLong(data.d)}`,
    ...(data.h ? [`Meeting time: ${data.h}`] : []),
    `Guests: ${data.p}`,
    `Pick-up: ${data.u}`,
    ...(data.s ? [`Ship / flight / train: ${data.s}`] : []),
    `Booking code: ${data.c}`,
  ];
  if (data.h && data.k === 'private') lines.push('', 'The final meeting time will be confirmed a few days before the tour.');   // transfers keep the time chosen by the customer
  if (balance) lines.push('', `Thank you for the reservation fee. The balance of EUR ${balance} is to be paid in cash directly to the driver on the day of the tour.`);
  lines.push('', 'You can view your confirmed booking and your tour pass in the app:', link,
    '', 'Travelling to other ports in Italy or the Mediterranean? Discover our network of trusted local drivers: www.tourisfied.com',
    '', 'Kind regards,', CONFIG.driverName, `${CONFIG.brand} Team`, `WhatsApp ${CONFIG.phoneDisplay}`);
  const rec = upsertBooking({ ...recordFromForm('confirmed'), isNew: false, confirmedAt: Date.now(), link, linkKind, msg: lines.join('\n') });
  currentCode = rec.c;
  refreshEditorUI();
  showResult(rec);
}
$('#confirm').addEventListener('click', createConfirmation);

// Creates the short link on the server (only Ciro's signature is accepted). Returns the id, or null if it is not available.
async function makeShortLink(data) {
  if (CONFIG.shortLinks === false) return null;
  try {
    const payload = JSON.stringify({ v: 2, ts: Date.now(), data });
    const key = await crypto.subtle.importKey('jwk', SIGN_KEY, ECDSA_KEY, false, ['sign']);
    const sig = B64U.enc(await crypto.subtle.sign(ECDSA_SIG, key, utf8(payload)));
    const res = await fetch('/api/links', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ payload, sig }) });
    if (!res.ok || !(res.headers.get('content-type') || '').includes('json')) return null;
    const j = await res.json();
    return j && /^[a-z0-9]{6,16}$/.test(j.id || '') ? j.id : null;
  } catch { return null; }
}

function showResult(b) {
  $('#msg').value = b.msg;
  $('#link-note').textContent = b.linkKind === 'short' ? 'Link breve attivo.' : 'Link normale (il link breve non è ancora attivo: vedi la guida).';
  const wire = () => {
    const text = encodeURIComponent($('#msg').value);
    const d = digitsOf(b.phone);
    // With a full international number the chat opens straight away; otherwise WhatsApp asks for the contact
    $('#send-wa').href = d.length >= 8 ? `https://wa.me/${d}?text=${text}` : `https://wa.me/?text=${text}`;
    const mail = $('#send-mail');
    if (b.email) { mail.href = `mailto:${b.email}?subject=${encodeURIComponent('Booking confirmed – ' + b.c + ' – ' + b.t)}&body=${text}`; mail.classList.remove('hidden'); }
    else mail.classList.add('hidden');
  };
  wire();
  $('#msg').oninput = wire;
  $('#test-link').href = b.link;
  $('#result').classList.remove('hidden');
  $('#result').scrollIntoView({ behavior: 'smooth' });
}
$('#copy').addEventListener('click', () => copy($('#msg').value, 'Messaggio copiato'));

// ── agenda ────────────────────────────────────────────────────
const ag = { view: 'list', filter: 'all', past: false, month: new Date(new Date().getFullYear(), new Date().getMonth(), 1), sel: null };

const byDate = (a, b) => (a.d + (a.h || '')).localeCompare(b.d + (b.h || ''));

function bookingRow(b) {
  const d = dObj(b.d);
  const past = b.d < todayISO();
  return `<button type="button" class="brow ${past ? 'past' : ''} ${b.status === 'cancelled' ? 'cancelled' : ''}" data-open="${esc(b.c)}">
    <div class="bt"><b>${d.getDate()}</b><span>${d.toLocaleDateString('it-IT', { month: 'short' })}</span></div>
    <div class="binfo"><b>${esc(b.t)}</b>${esc(b.n)} · ${b.p ? esc(b.p) + ' pers.' : 'persone da verificare'}${b.h ? ' · ' + esc(b.h) : ''}<div class="small muted">${esc(b.c)}</div></div>
    ${chipFor(b)}
  </button>`;
}

function renderAgenda() {
  const all = loadBookings();
  const filters = FILTERS.map(([k, l]) => [k, l, all.filter(b => matchFilter(b, k)).length]);
  const list = all.filter(b => matchFilter(b, ag.filter)).sort(byDate);
  refreshImportUndo();
  let body = '';

  if (ag.view === 'list') {
    const t = todayISO();
    const shown = list.filter(b => ag.past || b.d >= t);
    const hiddenPast = list.length - shown.length;
    let last = '';
    body = shown.map(b => (b.d !== last ? (last = b.d, `<div class="dayh">${fmtDayHead(b.d)}</div>`) : '') + bookingRow(b)).join('');
    if (!shown.length) body = `<div class="card empty"><div class="big">🗓️</div><p class="muted">${all.length ? 'Nessuna prenotazione in questa vista.' : 'Ancora nessuna prenotazione. Incolla una richiesta nella scheda “Richiesta”.'}</p></div>`;
    body += `<label class="f" style="display:flex;gap:10px;align-items:center;font-weight:400;margin-top:14px"><input type="checkbox" id="ag-past" ${ag.past ? 'checked' : ''} style="width:auto" /> <span>Mostra anche le date passate${!ag.past && hiddenPast ? ` (${hiddenPast})` : ''}</span></label>`;
  } else {
    const y = ag.month.getFullYear(), m = ag.month.getMonth();
    const startIdx = (new Date(y, m, 1).getDay() + 6) % 7;
    const days = new Date(y, m + 1, 0).getDate();
    const t = todayISO();
    const items = ds => list.filter(b => b.d === ds && b.status !== 'cancelled' || (ag.filter === 'cancelled' && b.d === ds));
    let cells = ['L', 'M', 'M', 'G', 'V', 'S', 'D'].map(x => `<div class="wd">${x}</div>`).join('') + '<button class="empty" disabled></button>'.repeat(startIdx);
    for (let d = 1; d <= days; d++) {
      const ds = `${y}-${pad(m + 1)}-${pad(d)}`;
      const it = items(ds);
      const dots = (it.some(isNewReq) ? '<i class="dot n"></i>' : '') + (it.some(b => b.status === 'pending' && !b.isNew) ? '<i class="dot p"></i>' : '') + (it.some(b => b.status === 'confirmed') ? '<i class="dot c"></i>' : '');
      cells += `<button type="button" data-day="${ds}" class="${ds === t ? 'today' : ''} ${ds === ag.sel ? 'sel' : ''}">${d}<span class="dots">${dots}</span></button>`;
    }
    const dayList = ag.sel ? list.filter(b => b.d === ag.sel) : [];
    body = `<div class="calnav"><button type="button" data-nav="-1">‹</button><b>${ag.month.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}</b><button type="button" data-nav="1">›</button></div>
      <div class="cal">${cells}</div>
      <div class="legend"><i class="dot n" style="display:inline-block"></i>nuova <i class="dot p" style="display:inline-block"></i>da confermare <i class="dot c" style="display:inline-block"></i>confermata · <a href="#" data-nav="0" style="text-decoration:underline">oggi</a></div>
      ${ag.sel ? `<div class="dayh">${fmtDayHead(ag.sel)}</div>${dayList.length ? dayList.map(bookingRow).join('') : '<p class="small muted">Nessuna prenotazione in questo giorno.</p>'}` : '<p class="small muted" style="margin-top:10px">Tocca un giorno per vedere le prenotazioni.</p>'}`;
  }

  $('#agenda-body').innerHTML = `
    <p class="small muted" style="margin:0 0 10px">Agenda salvata in questo browser (${esc(location.host)}): <b>${all.length}</b> prenotazioni.</p>
    <div class="atabs"><button type="button" data-av="list" class="${ag.view === 'list' ? 'on' : ''}">☰ Lista</button><button type="button" data-av="cal" class="${ag.view === 'cal' ? 'on' : ''}">🗓 Calendario</button></div>
    <div class="chips">${filters.map(([k, l, n]) => `<button type="button" class="chipbtn ${ag.filter === k ? 'on' : ''}" data-f="${k}">${l} (${n})</button>`).join('')}</div>
    ${body}`;
}

$('#agenda-body').addEventListener('click', e => {
  const t = e.target.closest('[data-open],[data-av],[data-f],[data-nav],[data-day]');
  if (!t) return;
  e.preventDefault();
  if (t.dataset.open) return openBooking(t.dataset.open);
  if (t.dataset.av) ag.view = t.dataset.av;
  if (t.dataset.f) ag.filter = t.dataset.f;
  if (t.dataset.day) ag.sel = ag.sel === t.dataset.day ? null : t.dataset.day;
  if (t.dataset.nav !== undefined) {
    const n = +t.dataset.nav;
    const base = n === 0 ? new Date() : ag.month;
    ag.month = new Date(base.getFullYear(), base.getMonth() + n, 1);
    if (n === 0) ag.sel = todayISO();
  }
  renderAgenda();
});
$('#agenda-body').addEventListener('change', e => { if (e.target.id === 'ag-past') { ag.past = e.target.checked; renderAgenda(); } });

// copy of the agenda (optional safety net)
$('#exp').addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(loadBookings(), null, 1)], { type: 'application/json' }));
  a.download = `agenda-mister-cab-${todayISO()}.json`;
  a.click();
});
$('#imp').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const arr = JSON.parse(await file.text());
    if (!Array.isArray(arr)) throw new Error('format');
    if (!confirm(`Caricare ${arr.length} prenotazioni?\n\nQuelle con lo stesso codice vengono sostituite.`)) { e.target.value = ''; return; }
    arr.forEach(b => { if (b && b.c && b.d) upsertBooking(b); });
    toast('Agenda caricata'); renderAgenda();
  } catch { toast('File non valido'); }
  e.target.value = '';
});

// ── import from the spreadsheet (CSV) ─────────────────────────
// Columns of Ciro's sheet: Data, Cliente, Pax, Servizio, Tipo, Stato, Totale, Anticipo,
// Nave / Pick-up, Telefono, Email, Link SumUp, Calendario, Note
function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const first = text.split(/\r?\n/, 1)[0] || '';
  const count = ch => first.split(ch).length - 1;
  const delim = [[';', count(';')], ['\t', count('\t')], [',', count(',')]].sort((x, y) => y[1] - x[1])[0][0];
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += ch;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(c => String(c).trim() !== ''));
}
const headKey = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

function parseDateAny(s) {
  s = String(s || '').trim().replace(/^[A-Za-z\u00C0-\u00FF.]+,?\s+/, '');     // drops a weekday such as "gio "

  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/.exec(s);          // day first, as in Italy
  if (!m) return '';
  const y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
  const dt = new Date(Date.UTC(y, +m[2] - 1, +m[1]));
  return dt.getUTCMonth() === +m[2] - 1 && dt.getUTCDate() === +m[1] ? `${y}-${pad(+m[2])}-${pad(+m[1])}` : '';
}
function parseMoney(s) {
  let t = String(s || '').replace(/[^\d.,-]/g, '');
  if (!t) return null;
  if (t.includes('.') && t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (t.includes(',')) t = t.replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  const n = parseFloat(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}
function normPhone(s) {
  const raw = String(s || '').trim().replace(/^'+/, '');
  if (!raw) return '';
  const d = raw.replace(/[^\d+]/g, '');
  if (d.startsWith('+')) return d;
  if (d.startsWith('00')) return '+' + d.slice(2);
  if (/^1\d{10}$/.test(d)) return '+' + d;                                   // 1-507-271-6802
  if (/^\(?\d{3}\)?[-.]\d{3}[-.]\d{4}$/.test(raw) && /^[2-9]\d{9}$/.test(d)) return '+1' + d;   // 646-594-7873
  if (/^3\d{9}$/.test(d) && !/[-.]/.test(raw)) return '+39' + d;              // 392 248 8238 (Italian mobile)
  if (/^07\d{9}$/.test(d)) return '+44' + d.slice(1);                         // 07488 276628 (UK mobile)
  return raw;                                                                 // unclear: left as written
}
// Start time, only from clear cues: "ritrovo / incontro / pick-up / ritiro HH:MM", a time at the end of the
// pick-up column ("Hotel X, Sorrento - 8:00") and, for transfers, "Partenza HH:MM" or the first time in the text.
// Docking, arrival, train and flight times are never taken for the start time.
function guessTime(servizio, note, pickup, transferish) {
  const T = '([01]?\\d|2[0-3])[:.]([0-5]\\d)';
  const fmt = m => `${pad(+m[1])}:${m[2]}`;
  const labeled = new RegExp('(?:ritrovo|incontro|appuntamento|pick-?up|ritiro)\\D{0,10}' + T, 'i');
  for (const text of [note, servizio, pickup]) { const m = labeled.exec(String(text || '')); if (m) return fmt(m); }
  if (transferish) { const m = new RegExp('partenza\\D{0,3}' + T, 'i').exec(String(note || '')); if (m) return fmt(m); }
  const end = new RegExp('(?<!\\d)\\s[\\u2013\\u2014-]\\s*(?:ore\\s*)?' + T + '\\s*$', 'i').exec(String(pickup || '').trim());
  if (end) return fmt(end);
  if (transferish) {
    const text = String(servizio || '');
    const re = /(?<![\d:])([01]?\d|2[0-3]):([0-5]\d)(?!\d)/g;
    let m;
    while ((m = re.exec(text))) {
      const before = text.slice(Math.max(0, m.index - 10), m.index).toLowerCase();
      if (!/arriv|ritorn|treno|volo|delle/.test(before)) return fmt(m);
    }
  }
  return '';
}

function importCsvRows(rows, existing, batch) {
  const head = rows[0].map(headKey);
  const col = name => head.indexOf(name);
  const need = ['data', 'cliente'];
  if (need.some(n => col(n) < 0)) return null;
  const C = Object.fromEntries(['data', 'cliente', 'pax', 'servizio', 'tipo', 'stato', 'totale', 'anticipo', 'navepickup', 'telefono', 'email', 'linksumup', 'calendario', 'note'].map(k => [k, col(k)]));
  const get = (r, k) => (C[k] >= 0 ? String(r[C[k]] ?? '').trim() : '');
  const bySrc = new Map(existing.filter(b => b.srcKey).map(b => [b.srcKey, b]));
  const taken = new Set(existing.map(b => b.c));
  const seen = new Map();
  const out = { fresh: [], present: 0, noDate: 0, rows: rows.length - 1 };
  rows.slice(1).forEach((r, i) => {
    const d = parseDateAny(get(r, 'data'));
    const n = get(r, 'cliente');
    if (!d || !n) { out.noDate++; return; }
    const servizio = get(r, 'servizio');
    const tipo = headKey(get(r, 'tipo'));
    const k = tipo.includes('transfer') && !tipo.includes('tour') ? 'transfer' : 'private';
    const st = headKey(get(r, 'stato'));
    const status = st.startsWith('confermat') ? 'confirmed' : (st.startsWith('cancell') || st.startsWith('annull')) ? 'cancelled' : 'pending';
    // Same row, same code: importing twice never duplicates
    const base = [d, n, servizio, k].join('|').toLowerCase();
    const occ = (seen.get(base) || 0) + 1; seen.set(base, occ);
    const srcKey = base + '|' + occ;
    if (bySrc.has(srcKey)) { out.present++; return; }
    let salt = 0, code;
    do {
      let h = 2166136261; const s = srcKey + '#' + salt;
      for (let j = 0; j < s.length; j++) { h ^= s.charCodeAt(j); h = Math.imul(h, 16777619) >>> 0; }
      code = numToCode(h % 28629151); salt++;
    } while (taken.has(code));
    taken.add(code);
    const note = get(r, 'note'), adv = parseMoney(get(r, 'anticipo')), link = get(r, 'linksumup'), tel = get(r, 'telefono');
    const extra = [note, adv ? `Anticipo: ${adv} EUR` : '', link ? `Link SumUp: ${link}` : '', status === 'pending' && /verific/.test(st) ? 'Stato nel foglio: da verificare' : '', k === 'private' && tipo.includes('transfer') ? 'Tipo nel foglio: transfer + tour' : '', /[A-Za-z]/.test(tel) ? `Telefono nel foglio: ${tel.replace(/^'+/, '')}` : ''].filter(Boolean).join('\n');
    out.fresh.push({
      c: code, k, o: '', t: servizio || (k === 'transfer' ? 'Transfer' : 'Tour'), d, h: guessTime(servizio, note, get(r, 'navepickup'), tipo.includes('transfer')), p: parseInt(get(r, 'pax')) || null,
      u: get(r, 'navepickup'), e: parseMoney(get(r, 'totale')), n, s: '', x: extra,
      phone: normPhone(get(r, 'telefono')), email: get(r, 'email'), status, cal: get(r, 'calendario'),
      srcKey, imported: true, importedAt: batch, importBatch: batch, isNew: false, createdAt: Date.now() + i,
    });
  });
  return out;
}

$('#imp-csv').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const rows = parseCSV(await file.text());
    const batch = Date.now();
    const res = rows.length > 1 ? importCsvRows(rows, loadBookings(), batch) : null;
    if (!res) { toast('Non riconosco il file: servono le colonne Data e Cliente'); e.target.value = ''; return; }
    const f = res.fresh, t = todayISO();
    const cnt = fn => f.filter(fn).length;
    const dates = f.map(b => b.d).sort();
    const msg = [
      `Righe lette: ${res.rows}`,
      `Da importare: ${f.length} (${cnt(b => b.d >= t)} con data futura)`,
      `Già presenti, non toccate: ${res.present}`,
      res.noDate ? `Saltate (senza data o cliente): ${res.noDate}` : '',
      '',
      `Confermate: ${cnt(b => b.status === 'confirmed')} · Da confermare: ${cnt(b => b.status === 'pending')} · Annullate: ${cnt(b => b.status === 'cancelled')}`,
      dates.length ? `Date: dal ${fmtShort(dates[0])} al ${fmtShort(dates[dates.length - 1])}` : '',
      '',
      'Da completare dopo l’importazione:',
      `- senza numero di persone: ${cnt(b => !b.p)}`,
      `- senza punto di ritiro: ${cnt(b => !b.u)}`,
      `- senza orario riconosciuto: ${cnt(b => !b.h)}`,
      `- senza telefono né email: ${cnt(b => !b.phone && !b.email)}`,
      '', f.length ? 'Importare?' : 'Non c’è nulla di nuovo da importare.',
    ].filter((x, i, arr) => x !== '' || arr[i - 1] !== '').join('\n');
    if (!f.length) { alert(msg); e.target.value = ''; return; }
    if (!confirm(msg)) { e.target.value = ''; return; }
    const all = loadBookings().concat(f);
    saveBookings(all); updateBadge();
    toast(`Importate ${f.length} prenotazioni (si possono annullare da Strumenti)`); renderAgenda();
  } catch (err) {
    console.error(err); toast('Non riesco a leggere il file');
  }
  e.target.value = '';
});


// Undo of an import: removes the bookings of the latest import that were never edited
function lastBatch() {
  const batches = [...new Set(loadBookings().filter(b => b.importBatch).map(b => b.importBatch))];
  return batches.length ? Math.max(...batches) : null;
}
function refreshImportUndo() {
  const bt = lastBatch();
  const btn = $('#imp-undo');
  btn.classList.toggle('hidden', !bt);
  if (bt) btn.textContent = `Annulla l’ultima importazione (${loadBookings().filter(b => b.importBatch === bt).length} prenotazioni)`;
}
$('#imp-undo').addEventListener('click', () => {
  const bt = lastBatch();
  if (!bt) return;
  const mine = loadBookings().filter(b => b.importBatch === bt);
  const edited = mine.filter(b => b.updatedAt || (b.status === 'confirmed' && b.link));       // touched since the import
  const gone = new Set(mine.filter(b => !edited.includes(b)).map(b => b.c));
  const removable = [...gone];
  if (!confirm(`Annullare l’ultima importazione?\n\nVengono tolte ${removable.length} prenotazioni importate.${edited.length ? `\n${edited.length} che hai modificato o confermato restano in agenda.` : ''}`)) return;
  saveBookings(loadBookings().filter(b => !gone.has(b.c)));
  edited.forEach(b => upsertBooking({ c: b.c, importBatch: null }));
  updateBadge(); toast(`Importazione annullata: tolte ${removable.length} prenotazioni`); renderAgenda();
});

function initAgenda() {
  migrateHistory();
  updateBadge();
  refreshEditorUI();
  showView('new');
}

// ── Login with the access code ────────────────────────────────
const SESSION_KEY = 'mcc_admin_session';
const REMEMBER_DAYS = 30;

// The code is typed in any case, with or without dashes
const normalizeCode = v => String(v).toUpperCase().replace(/[^A-Z0-9]/g, '');

async function openVault(code) {
  const b = B64U.dec;
  const base = await crypto.subtle.importKey('raw', utf8(normalizeCode(code)), 'PBKDF2', false, ['deriveKey']);
  const aes = await crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: b(ADMIN_VAULT.salt), iterations: ADMIN_VAULT.iter },
    base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b(ADMIN_VAULT.iv) }, aes, b(ADMIN_VAULT.ct));   // throws if the code is wrong
  return JSON.parse(new TextDecoder().decode(plain));
}

function savedSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
    const v = JSON.parse(raw || 'null');
    if (!v || !v.jwk || Date.now() - v.t > REMEMBER_DAYS * 864e5) return null;
    return v.jwk;
  } catch { return null; }
}

function openPanel() {
  $('#gate').classList.add('hidden');
  $('#panel').classList.remove('hidden');
  // Safety check: the app must know the public half of this key
  const same = SIGN_KEY && CONFIG.confirmPublicKey && SIGN_KEY.x === CONFIG.confirmPublicKey.x && SIGN_KEY.y === CONFIG.confirmPublicKey.y;
  const warns = storageWarnings();
  if (!same) warns.unshift('Attenzione: le conferme create qui non verrebbero riconosciute dall\'app. Avvisa chi gestisce l\'app.');
  $('#key-section').innerHTML = warns.map(w => `<div class="warn-box">${w}</div>`).join('');
  $('#form-section').classList.remove('hidden');
  initAgenda();
  // Ask the browser not to clear the agenda when it frees space
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch { /* ignore */ }
}

// The agenda lives in this browser only: say so when the browser will not keep it
function storageWarnings() {
  const w = [];
  try {
    localStorage.setItem('mcc_probe', '1');
    if (localStorage.getItem('mcc_probe') !== '1') throw new Error('no storage');
    localStorage.setItem('mcc_probe', '');
  } catch {
    w.push('Questo browser non conserva i dati del sito (navigazione privata o dati bloccati): <b>l\'agenda non verrà salvata</b>. Apri il pannello in una scheda normale di Chrome.');
  }
  if (/; wv\)|FBAN|FBAV|Instagram|Line\//.test(navigator.userAgent)) {
    w.push('Stai usando il browser interno di un\'altra app (WhatsApp, Gmail, Messenger…): <b>i dati possono andare persi</b>. Apri il pannello in Chrome e salvalo nella schermata Home.');
  }
  return w;
}

let fails = 0, lockedUntil = 0;
$('#gate-form').addEventListener('submit', async e => {
  e.preventDefault();
  const msg = $('#gate-msg');
  if (Date.now() < lockedUntil) { msg.textContent = 'Troppi tentativi: riprova tra qualche secondo.'; return; }
  msg.textContent = 'Controllo…';
  try {
    SIGN_KEY = await openVault($('#pin').value);
  } catch {
    fails++;
    if (fails >= 5) { lockedUntil = Date.now() + 30000; fails = 0; msg.textContent = 'Troppi tentativi: riprova tra 30 secondi.'; }
    else msg.textContent = 'Codice non corretto.';
    $('#pin').value = '';
    return;
  }
  try {
    const store = $('#remember').checked ? localStorage : sessionStorage;
    store.setItem(SESSION_KEY, JSON.stringify({ t: Date.now(), jwk: SIGN_KEY }));
  } catch { /* ignore */ }
  msg.textContent = '';
  openPanel();
});
$('#lock').addEventListener('click', () => {
  try { sessionStorage.removeItem(SESSION_KEY); localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
  location.reload();
});

if (!window.isSecureContext || !crypto.subtle) {
  $('#gate').classList.remove('hidden');
  $('#gate-msg').textContent = 'Apri la pagina dall\'indirizzo https del sito.';
} else if ((SIGN_KEY = savedSession())) openPanel();
else { $('#gate').classList.remove('hidden'); setTimeout(() => $('#pin').focus(), 50); }
