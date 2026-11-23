/* ============================================================
   admin.html — Ciro creates signed confirmation links
   The private key is generated here and stored only in this browser.
   ============================================================ */

const KEY_STORE = 'mcc_admin_signing_key';
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
tourSel.addEventListener('change', () => {
  const t = TOURS.find(x => x.id === tourSel.value);
  if (t) { form.t.value = `${t.code} · ${t.title}`; form.k.value = 'private'; updatePrice(); }
});
form.p.addEventListener('input', updatePrice);
function updatePrice() {
  const t = TOURS.find(x => x.id === tourSel.value);
  if (t && form.k.value === 'private' && !form.e.dataset.touched) form.e.value = priceFor(t.scale, +form.p.value) ?? '';
}
form.e.addEventListener('input', () => { form.e.dataset.touched = '1'; });
form.c.value = makeBookingCode();

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
function parseEnglishDate(s) {
  const m = String(s).match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (!m) return '';
  const mi = MONTHS.findIndex(x => x.startsWith(m[2].toLowerCase().slice(0, 3)));
  return mi < 0 ? '' : `${m[3]}-${String(mi + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

// Reads the WhatsApp messages the app sends (Confirmation Form format)
$('#parse').addEventListener('click', () => {
  const txt = $('#paste').value;
  if (!txt.trim()) { toast('Incolla prima il messaggio'); return; }
  const get = label => { const m = txt.match(new RegExp('^\\s*-?\\s*' + label + '\\s*:\\s*(.+)$', 'im')); return m ? m[1].trim() : ''; };
  const code = get('Booking code'); if (code) form.c.value = code.toUpperCase();
  const name = get('Name'); if (name) form.n.value = name;
  const phone = get('Mobile phone number') || get('Mobile'); if (phone) form.phone.value = phone;
  let d = get('Date'); let time = get('Meeting time');
  const dt = get('Date & time');
  if (dt) { d = dt; const tm = dt.match(/at\s+(\d{1,2}:\d{2})/); if (tm) time = tm[1]; }
  if (d) form.d.value = parseEnglishDate(d);
  if (/^\d{1,2}:\d{2}$/.test(time)) form.h.value = time.padStart(5, '0');
  const people = get('Number of people') || get('Passengers'); if (parseInt(people)) form.p.value = parseInt(people);
  const opt = get('Option chosen');
  // Prefer the longest matching code ("Opt 2 Bis" before "Opt 2")
  const best = opt ? TOURS.filter(t => opt.toLowerCase().startsWith(t.code.toLowerCase())).sort((a, b) => b.code.length - a.code.length)[0] : null;
  if (/I need a transfer/i.test(txt)) {
    form.k.value = 'transfer'; tourSel.value = '';
    const from = get('From'), to = get('To');
    form.t.value = `Transfer · ${from} → ${to}`; form.u.value = from;
  } else if (/shared tour/i.test(txt)) {
    form.k.value = 'shared'; tourSel.value = '';
    form.t.value = get('Tour'); form.u.value = get('Location');
  } else {
    form.k.value = 'private';
    if (best) { tourSel.value = best.id; form.t.value = `${best.code} · ${best.title}`; }
    form.u.value = get('Location');
  }
  const fare = get('Quoted fare').match(/€\s?([\d,.]+)/);
  delete form.e.dataset.touched;
  if (fare) form.e.value = fare[1].replace(/[,.]/g, ''); else updatePrice();
  toast('Dati compilati: controllali');
});

const fmtLong = d => new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

form.addEventListener('submit', async e => {
  e.preventDefault();
  const k = loadKey();
  if (!k) { toast('Crea prima la chiave'); return; }
  const f = Object.fromEntries(new FormData(form));
  const data = {
    c: f.c.trim().toUpperCase(), k: f.k, o: f.o || undefined, t: f.t.trim(), d: f.d, h: f.h || undefined,
    p: +f.p, u: f.u.trim(), e: f.e === '' ? undefined : +f.e, n: f.n.trim(),
  };
  const token = await signConfirmation(k.privateJwk, data);
  const base = CONFIG.appUrl || new URL('index.html', location.href).href.split('#')[0];
  const link = `${base}#/confirm/${token}`;
  const balance = data.k === 'private' && data.e ? data.e - CONFIG.depositAmount : null;
  const first = data.n.split(/\s+/)[0];
  const lines = [
    `Ciao ${first}! ✅ Your booking is confirmed.`, '',
    data.t,
    `📅 ${fmtLong(data.d)}${data.h ? ' at ' + data.h : ''}`,
    `👥 ${data.p} guest${data.p > 1 ? 's' : ''} · 📍 ${data.u}`,
    `🔖 Booking code: ${data.c}`,
  ];
  if (balance) lines.push('', `Thank you for the reservation fee. The balance of €${balance} is paid in cash (euros) directly to the driver on the day.`);
  lines.push('', 'Open this link to see your confirmed booking and your tour pass in the app:', link,
    '', `A presto, ${CONFIG.driverName} – ${CONFIG.brand} Team`);
  const msg = lines.join('\n');
  $('#msg').value = msg;
  const digits = (f.phone || '').replace(/[^\d]/g, '');
  const sendWa = () => { $('#send-wa').href = `https://wa.me/${digits}?text=${encodeURIComponent($('#msg').value)}`; };
  sendWa();
  $('#msg').oninput = sendWa;
  $('#test-link').href = link;
  $('#result').classList.remove('hidden');
  $('#result').scrollIntoView({ behavior: 'smooth' });
});
$('#copy').addEventListener('click', () => copy($('#msg').value, 'Messaggio copiato'));

renderKey();
