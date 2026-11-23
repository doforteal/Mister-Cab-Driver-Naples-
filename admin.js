/* ============================================================
   admin.html — Ciro confirms a booking with one button (signed link)
   The private key is generated here and stored only in this browser.
   ============================================================ */

const KEY_STORE = 'mcc_admin_signing_key';
const HIST_STORE = 'mcc_admin_history';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add('hidden'), 2600);
}

function loadKey() {
  try { return JSON.parse(localStorage.getItem(KEY_STORE)) || null; } catch { return null; }
}
function storeKey(k) {
  try { localStorage.setItem(KEY_STORE, JSON.stringify(k)); return true; } catch { toast('Impossibile salvare la chiave in questo browser'); return false; }
}
const publicPart = jwk => ({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y });
const sameKey = (a, b) => !!a && !!b && a.x === b.x && a.y === b.y && a.crv === b.crv;

// ── key section ───────────────────────────────────────────────
function renderKey() {
  const k = loadKey();
  const sec = $('#key-section');
  if (!window.isSecureContext || !crypto.subtle) {
    sec.innerHTML = `<div class="warn-box">Apri questa pagina dall'indirizzo https del sito: senza https il telefono non permette di firmare i link.</div>`;
    return;
  }
  if (!k) {
    sec.innerHTML = `
      <h2 class="sec" style="margin-top:6px">Primo avvio</h2>
      <div class="card">
        <p class="small">Crea la <b>chiave di conferma</b>. Resta solo su questo telefono e serve a firmare i link che mandi ai clienti, così nessuno può confermarsi da solo.</p>
        <button class="btn" id="gen" style="margin-top:12px">Crea la chiave</button>
        <label class="btn ghost" style="margin-top:10px">Ho già una chiave (backup)<input type="file" id="imp" accept="application/json,.json" hidden /></label>
      </div>`;
    $('#gen').addEventListener('click', generateKey);
    $('#imp').addEventListener('change', importKey);
    $('#form-section').classList.add('hidden');
    return;
  }
  const pub = JSON.stringify(publicPart(k.privateJwk));
  const active = sameKey(CONFIG.confirmPublicKey, k.privateJwk);
  sec.innerHTML = active
    ? `<div class="ok-box">✅ Chiave attiva: i link che crei qui vengono accettati dall'app.</div>
       <details style="margin-top:10px"><summary class="small muted">Gestisci chiave</summary>${keyTools(pub)}</details>`
    : `<h2 class="sec" style="margin-top:6px">Attiva la chiave</h2>
       <div class="card">
         <div class="warn-box" style="margin-top:0">L'app non conosce ancora questa chiave: i link non funzioneranno finché non la attivi.</div>
         <p class="small" style="margin-top:10px">Copia la <b>chiave pubblica</b> qui sotto (non è segreta) e incollala in <code>config.js</code> alla voce <code>confirmPublicKey</code>, poi ripubblica il sito. Oppure mandala a Claude.</p>
         ${keyTools(pub)}
       </div>`;
  $('#copy-pub').addEventListener('click', () => copy(pub, 'Chiave pubblica copiata'));
  $('#backup').addEventListener('click', backupKey);
  $('#form-section').classList.remove('hidden');
}

function keyTools(pub) {
  return `
    <pre class="key">${esc(pub)}</pre>
    <button class="btn navy" id="copy-pub" type="button" style="margin-top:10px">Copia chiave pubblica</button>
    <button class="btn ghost" id="backup" type="button">Scarica backup della chiave segreta</button>
    <p class="note">Tieni il backup in un posto sicuro e non mandarlo a nessuno: serve solo per usare la stessa chiave su un altro telefono.</p>`;
}

async function generateKey() {
  const pair = await crypto.subtle.generateKey(ECDSA_KEY, true, ['sign', 'verify']);
  const privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  if (storeKey({ privateJwk, created: new Date().toISOString() })) { renderKey(); toast('Chiave creata'); }
}

async function importKey(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const k = JSON.parse(await file.text());
    if (!k.privateJwk || !k.privateJwk.d) throw new Error('no key');
    await crypto.subtle.importKey('jwk', k.privateJwk, ECDSA_KEY, false, ['sign']);
    if (storeKey(k)) { renderKey(); toast('Chiave importata'); }
  } catch {
    toast('File non valido');
  }
}

function backupKey() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([localStorage.getItem(KEY_STORE)], { type: 'application/json' }));
  a.download = 'mistercab-chiave-conferme-SEGRETA.json';
  a.click();
}

async function copy(text, okMsg) {
  try { await navigator.clipboard.writeText(text); toast(okMsg); }
  catch { toast('Copia non riuscita: seleziona il testo a mano'); }
}

// ── form ──────────────────────────────────────────────────────
const form = $('#cf');
const tourSel = $('#tour-sel');
tourSel.innerHTML = '<option value="">— altro / scrivi il titolo —</option>' +
  TOURS.map(t => `<option value="${t.id}">${esc(t.code)} · ${esc(t.title)}</option>`).join('');

const val = () => Object.fromEntries(new FormData(form));
const KIND_LABEL = { private: 'Tour privato', shared: 'Tour condiviso', transfer: 'Transfer' };
const fmtLong = d => new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fmtShort = d => new Date(d + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

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

// What must be there before the booking can be confirmed
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
  $('#confirm').disabled = false;
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
function parseEnglishDate(s) {
  const m = String(s).match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (!m) return '';
  const mi = MONTHS.findIndex(x => x.startsWith(m[2].toLowerCase().slice(0, 3)));
  return mi < 0 ? '' : `${m[3]}-${String(mi + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
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
  const place = (loc) => [loc, detail].filter(Boolean).join(' – ');
  set('x', get('Notes'));
  if (/I need a transfer/i.test(txt)) {
    form.k.value = 'transfer';
    const from = get('From'), to = get('To');
    set('t', `Transfer · ${from} → ${to}`); set('u', from);
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

let pasteTimer;
$('#paste').addEventListener('input', () => {
  clearTimeout(pasteTimer);
  pasteTimer = setTimeout(() => { if ($('#paste').value.trim()) { parseRequest($('#paste').value); $('#result').classList.add('hidden'); } }, 350);
});
$('#clip').addEventListener('click', async () => {
  try {
    const t = await navigator.clipboard.readText();
    if (!t.trim()) { toast('Gli appunti sono vuoti'); return; }
    $('#paste').value = t; parseRequest(t); $('#result').classList.add('hidden');
    toast('Richiesta letta: controlla il riepilogo');
  } catch { toast('Non riesco a leggere gli appunti: incolla il testo nel riquadro'); }
});

// ── confirm ───────────────────────────────────────────────────
const digitsOf = p => (p || '').replace(/[^\d]/g, '');

async function createConfirmation() {
  const k = loadKey();
  if (!k) { toast('Crea prima la chiave'); return; }
  const f = val();
  const miss = missing(f);
  if (miss.length) { $('#edit').open = true; toast('Mancano: ' + miss.join(', ')); return; }
  if (!confirm(`Confermare la prenotazione ${f.c.trim().toUpperCase()} di ${f.n.trim()} (${fmtShort(f.d)})?\n\nIl cliente riceverà il link di conferma.`)) return;
  const data = {
    c: f.c.trim().toUpperCase(), k: f.k, o: f.o || undefined, t: f.t.trim(), d: f.d, h: f.h || undefined,
    p: +f.p, u: f.u.trim(), e: f.e === '' ? undefined : +f.e, n: f.n.trim(), s: (f.s || '').trim() || undefined,
  };
  const token = await signConfirmation(k.privateJwk, data);
  const base = CONFIG.appUrl || new URL('index.html', location.href).href.split('#')[0];
  const link = `${base}#/confirm/${token}`;
  const balance = data.k === 'private' && data.e ? data.e - CONFIG.depositAmount : null;
  const lines = [
    `Ciao ${data.n.split(/\s+/)[0]}! ✅ Your booking is confirmed.`, '',
    data.t,
    `📅 ${fmtLong(data.d)}${data.h ? ' at ' + data.h : ''}`,
    `👥 ${data.p} guest${data.p > 1 ? 's' : ''} · 📍 ${data.u}`,
    `🔖 Booking code: ${data.c}`,
  ];
  if (balance) lines.push('', `Thank you for the reservation fee. The balance of €${balance} is paid in cash (euros) directly to the driver on the day.`);
  lines.push('', 'Open this link to see your confirmed booking and your tour pass in the app:', link,
    '', 'Visiting other ports in Italy or the Mediterranean? Discover TOURISFIED, our network of trusted local drivers: www.tourisfied.com',
    '', `A presto, ${CONFIG.driverName} – ${CONFIG.brand} Team`);
  const entry = { c: data.c, n: data.n, t: data.t, d: data.d, phone: f.phone || '', email: f.email || '', link, msg: lines.join('\n'), at: Date.now() };
  saveHistory(entry);
  showResult(entry);
}

function showResult(e) {
  $('#msg').value = e.msg;
  const wire = () => {
    const text = encodeURIComponent($('#msg').value);
    const d = digitsOf(e.phone);
    // With a full international number the chat opens straight away; otherwise WhatsApp asks for the contact
    $('#send-wa').href = d.length >= 8 ? `https://wa.me/${d}?text=${text}` : `https://wa.me/?text=${text}`;
    const mail = $('#send-mail');
    if (e.email) { mail.href = `mailto:${e.email}?subject=${encodeURIComponent('Booking confirmed – ' + e.c + ' – ' + e.t)}&body=${text}`; mail.classList.remove('hidden'); }
    else mail.classList.add('hidden');
  };
  wire();
  $('#msg').oninput = wire;
  $('#test-link').href = e.link;
  $('#result').classList.remove('hidden');
  $('#result').scrollIntoView({ behavior: 'smooth' });
}

function loadHistory() { try { return JSON.parse(localStorage.getItem(HIST_STORE)) || []; } catch { return []; } }
function saveHistory(entry) {
  const h = loadHistory().filter(x => x.c !== entry.c);
  h.unshift(entry);
  try { localStorage.setItem(HIST_STORE, JSON.stringify(h.slice(0, 15))); } catch { /* ignore */ }
  renderHistory();
}
function renderHistory() {
  const h = loadHistory();
  $('#hist-section').classList.toggle('hidden', !h.length);
  $('#hist').innerHTML = h.map((x, i) => `<li><span><b>${esc(x.n)}</b><br><span class="muted small">${esc(x.c)} · ${esc(x.t)} · ${fmtShort(x.d)}</span></span><button data-i="${i}" type="button">Reinvia</button></li>`).join('');
  document.querySelectorAll('#hist button').forEach(b => b.addEventListener('click', () => showResult(loadHistory()[+b.dataset.i])));
}

$('#confirm').addEventListener('click', createConfirmation);
$('#copy').addEventListener('click', () => copy($('#msg').value, 'Messaggio copiato'));

renderKey();
renderHistory();
