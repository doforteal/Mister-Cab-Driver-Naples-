/* ============================================================
   Mister Cab — app logic (single-page, hash routing)
   Customer profile and trips are stored on this device (localStorage).
   ============================================================ */

const STORE_KEY = 'mcc_state_v1';
const $ = (s, el = document) => el.querySelector(s);
const view = $('#view');

// ── helpers ───────────────────────────────────────────────────
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const eur = n => (n == null ? 'on request' : '€' + Number(n).toLocaleString('en-US'));
const uid = (p = '') => p + Math.random().toString(36).slice(2, 8).toUpperCase();
const todayISO = () => new Date().toISOString().slice(0, 10);
const parseDate = d => new Date(d + 'T12:00:00');
const fmtDate = (d, opts = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) => d ? parseDate(d).toLocaleDateString('en-GB', opts) : '';
const waLink = text => `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(text)}`;
const mailLink = (subj, body) => `mailto:${CONFIG.email}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`;

// Full pick-up text of a trip: the chosen point plus hotel / address / terminal details
const pickupText = t => t.pickupDetail ? `${t.pickup} (${t.pickupDetail})` : (t.pickup || '');

// Customer reference added to every message sent to Ciro (name, mobile, email)
function customerRef() {
  const p = S.profile || {};
  return ['- Name: ' + p.name, '- Mobile phone number: ' + p.phone, '- Email address: ' + p.email].join('\n');
}
// Short free-form message to Ciro (chat buttons), always with the customer's details
function chatLink(topic, bookingLines = []) {
  return waLink([`Hello ${CONFIG.driverName}, ${topic}`, '', ...bookingLines, customerRef(),
    '', `Sent from the ${CONFIG.brand} app`].join('\n'));
}

// Booking requests go to Ciro by WhatsApp or by email (CONFIG.email).
// Both always carry the booking code and say they come from the app.
const APP_TAG = '[Mister Cab App]';
function sendRequest(channel, { kindLabel, code, title, date, msg }) {
  const body = `${msg}\n\nSent from the ${CONFIG.brand} app`;
  const subject = `${APP_TAG} ${kindLabel} ${code} – ${title} – ${fmtDate(date)}`;
  window.open(channel === 'email' ? mailLink(subject, body) : waLink(body), '_blank', 'noopener');
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add('hidden'), 2600);
}

function openSheet(html) {
  $('#sheet-body').innerHTML = html;
  $('#sheet').classList.remove('hidden');
}
function closeSheet() { $('#sheet').classList.add('hidden'); $('#sheet-body').innerHTML = ''; }
document.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeSheet(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });

// ── state ─────────────────────────────────────────────────────
function load() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || null; } catch { return null; }
}
let S = load() || { profile: null, trips: [] };
// Statuses: 'pending' (until Ciro's confirmation link is opened), 'confirmed', 'cancelled'
S.trips.forEach(t => {
  if (t.status !== 'confirmed' && t.status !== 'cancelled') t.status = 'pending';
  if (!t.code) t.code = makeBookingCode();
});
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ profile: S.profile, trips: S.trips })); } catch { toast('Could not save on this device'); }
}

const tourById = id => TOURS.find(t => t.id === id);
// A trip is "past" when cancelled or once its date has gone by
const isPastTrip = t => t.status === 'cancelled' || t.date < todayISO();
const PENDING_CONFIRM_KEY = 'mcc_pending_confirm';

// The QR code carries the whole booking as plain text, so any scanner
// (phone camera) shows what it is about. Plain ASCII keeps every reader happy.
const asciiText = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[\u00B7\u2013\u2014\u2192]/g, '-').replace(/\u20AC/g, 'EUR').replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"')
  .replace(/[^\x20-\x7E\n]/g, '');

function bookingQrText(t) {
  const balance = t.kind === 'private' && t.price ? t.price - CONFIG.depositAmount : null;
  const L = [
    CONFIG.brand.toUpperCase(),
    `BOOKING ${t.code} - ${t.status === 'confirmed' ? 'CONFIRMED' : 'PENDING'}`, '',
    `Tour: ${t.title}`,
    `Date: ${fmtDate(t.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`,
    `Meeting time: ${t.time || '-'}`,
    `Guests: ${t.people}`,
    `Pick-up: ${pickupText(t) || '-'}`,
  ];
  if (t.ship) L.push(`Ship / flight / train: ${t.ship}`);
  L.push(`Customer: ${t.name || S.profile.name}`, `Phone: ${S.profile.phone}`);
  if (t.price) L.push(t.kind === 'private' ? `Total: EUR ${t.price} per vehicle` : `Total: EUR ${t.price}`);
  if (balance) L.push(`Deposit EUR ${CONFIG.depositAmount} paid, balance EUR ${balance} in cash to the driver`);
  if (t.notes) L.push(`Notes: ${String(t.notes).slice(0, 120)}`);
  L.push('', `Driver: ${CONFIG.driverName} ${CONFIG.phoneDisplay}`);
  return asciiText(L.join('\n'));
}

function qrImg(text, target = 280) {
  if (typeof qrcode === 'undefined') return `<div class="code-box">${esc(text)}</div>`;
  const q = qrcode(0, 'L');
  q.addData(text);
  q.make();
  const cell = Math.max(2, Math.floor(target / (q.getModuleCount() + 8)));   // as large as the screen allows
  return q.createImgTag(cell, cell * 4, 'QR code with the booking details');
}

// ── router ────────────────────────────────────────────────────
const routes = {
  home: renderHome,
  explore: renderExplore,
  tour: renderTour,
  book: renderBook,
  transfer: renderTransfer,
  trips: renderTrips,
  trip: renderTrip,
  confirm: renderConfirm,
  c: renderConfirmCompact,
  account: renderAccount,
};

function router() {
  closeSheet();
  if (!S.profile) {
    // Keep a confirmation link opened before sign-up, and apply it right after
    const m = location.hash.match(/^#\/((?:confirm|c)\/.+)$/);
    if (m) { try { sessionStorage.setItem(PENDING_CONFIRM_KEY, m[1]); } catch { /* ignore */ } }
    renderWelcome();
    return;
  }
  document.body.classList.remove('onboarding');
  const [name = 'home', arg] = location.hash.replace(/^#\/?/, '').split('/');
  const fn = routes[name] || renderHome;
  const tab = { tour: 'explore', book: 'explore', transfer: 'explore', trip: 'trips' }[name] || name;
  document.querySelectorAll('.tabbar a').forEach(a => a.classList.toggle('on', a.dataset.tab === tab));
  fn(arg);
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', router);

// ── onboarding ────────────────────────────────────────────────
function renderWelcome() {
  document.body.classList.add('onboarding');
  view.innerHTML = `
  <section class="welcome">
    <img class="logo" src="icons/logo.png" alt="" />
    <h1>Welcome to<br>${esc(CONFIG.brand)}</h1>
    <p>Your private driver in Naples. Book private and shared tours and transfers, and keep every trip in your pocket.</p>
    <ul class="ticks" style="margin-top:16px">
      <li>Private day tours from the Port of Naples</li>
      <li>Shared tours: join a group and pay less</li>
      <li>Transfers: port, airport, station, hotel</li>
      <li>Your confirmation, tour pass and chat with your driver</li>
    </ul>
    <form class="card" id="join">
      <label class="f">Full name<input name="name" required autocomplete="name" /></label>
      <label class="f">Email<input name="email" type="email" required autocomplete="email" /></label>
      <label class="f">Mobile / WhatsApp<input name="phone" type="tel" required autocomplete="tel" placeholder="+1 555 123 4567" /></label>
      <button class="btn" style="margin-top:18px">Get started</button>
      <p class="fine">Your details stay on this phone and are only sent to us when you book.</p>
    </form>
  </section>`;
  $('#join').addEventListener('submit', e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    S.profile = { name: f.name.trim(), email: f.email.trim(), phone: f.phone.trim(), joined: todayISO() };
    save();
    let pending = null;
    try { pending = sessionStorage.getItem(PENDING_CONFIRM_KEY); sessionStorage.removeItem(PENDING_CONFIRM_KEY); } catch { /* ignore */ }
    location.hash = pending ? '#/' + pending : '#/home';
    router();
  });
}

// ── shared bits ───────────────────────────────────────────────
function tourCard(t, cls = 'tcard') {
  const from = SCALES[t.scale][0].price;
  return `
  <a class="${cls}" href="#/tour/${t.id}">
    <div class="ph" style="background-image:url(${t.img})"><span class="badge">${esc(t.code)}</span></div>
    <div class="bd"><div><h3>${esc(t.title)}</h3><div class="from">${esc(t.tag)}</div></div>
    ${cls === 'tile' ? `<div class="from" style="text-align:right">from<br><b>${eur(from)}</b></div>` : `<div class="from">from <b>${eur(from)}</b> per vehicle</div>`}</div>
  </a>`;
}

function upcomingTrips() {
  return S.trips.filter(t => !isPastTrip(t)).sort((a, b) => a.date.localeCompare(b.date));
}

function tripRow(t) {
  const d = parseDate(t.date);
  return `
  <a class="card trip" href="#/trip/${t.id}" style="display:flex">
    <div class="date"><b>${d.getDate()}</b><span>${d.toLocaleDateString('en-GB', { month: 'short' })}</span></div>
    <div class="info"><h3>${esc(t.title)}</h3><div class="small muted">${esc(t.people)} guest${t.people > 1 ? 's' : ''} · ${esc(pickupText(t))}</div><div style="margin-top:6px">${statusChip(t)}</div></div>
    <span class="chev muted">›</span>
  </a>`;
}

function statusChip(t) {
  if (t.status === 'cancelled') return '<span class="chip grey">Cancelled</span>';
  if (t.status === 'confirmed') return isPastTrip(t) ? '<span class="chip ok">Completed</span>' : '<span class="chip ok">Confirmed</span>';
  return isPastTrip(t) ? '<span class="chip grey">Not confirmed</span>' : '<span class="chip">Pending</span>';
}

// ── HOME ──────────────────────────────────────────────────────
function renderHome() {
  const h = new Date().getHours();
  const hello = h < 12 ? 'Buongiorno' : h < 18 ? 'Buon pomeriggio' : 'Buonasera';
  const next = upcomingTrips()[0];
  const featured = ['opt2', 'opt4', 'opt3', 'opt6', 'opt7'].map(tourById);
  view.innerHTML = `
  <header class="top">
    <div class="brand"><img src="icons/logo.png" alt="" /><div><div class="sub">${hello},</div><h1>${esc(S.profile.name.split(' ')[0])}</h1></div></div>
    <a class="icon-btn" href="${chatLink('I would like to talk to you.')}" target="_blank" rel="noopener" aria-label="WhatsApp">💬</a>
  </header>
  ${next ? `
  <a class="mcard" href="#/trip/${next.id}" style="display:block">
    <div class="row"><div><div class="club">Your next trip</div><div class="name">${esc(next.title)}</div></div>${statusChip(next)}</div>
    <div class="pts"><b>${parseDate(next.date).getDate()}</b><span>${fmtDate(next.date, { month: 'long', year: 'numeric' })} · ${fmtDate(next.date, { weekday: 'long' })}</span></div>
    <div class="next" style="margin-top:8px">${esc(next.people)} guest${next.people > 1 ? 's' : ''} · ${esc(pickupText(next))}${next.time ? ' · ' + esc(next.time) : ''}</div>
  </a>` : `
  <div class="mcard">
    <div class="club">${esc(CONFIG.brand)}</div>
    <div class="name" style="margin-top:6px">Arriving by cruise ship?</div>
    <p class="next" style="margin-top:8px;line-height:1.5">We pick you up at the port as soon as you disembark and bring you back with plenty of time before all aboard.</p>
    <a class="btn" href="#/explore" style="margin-top:16px;position:relative;z-index:1">Find your tour</a>
  </div>`}
  <div class="quick">
    <a href="#/explore"><span class="qi">🚐</span>Private tour</a>
    <a href="#/explore/shared"><span class="qi">👥</span>Shared tour</a>
    <a href="#/transfer"><span class="qi">🚖</span>Transfer</a>
    <a href="${CONFIG.tourisfied}" target="_blank" rel="noopener"><span class="qi">🌍</span>Other ports</a>
  </div>
  <h2 class="sec">Private day tours <a href="#/explore">See all</a></h2>
  <div class="scroller">${featured.map(t => tourCard(t)).join('')}</div>
  <h2 class="sec">How it works</h2>
  <div class="card"><ol class="stops">
    <li><b>Choose your tour</b><div class="small muted">Prices are total per vehicle, up to 8 guests.</div></li>
    <li><b>Send the request</b><div class="small muted">On WhatsApp or by email. We check availability and reply.</div></li>
    <li><b>Secure your date</b><div class="small muted">Pay the €${CONFIG.depositAmount} reservation fee with the link we send you. Your booking stays <b>pending</b> until then.</div></li>
    <li><b>Get your confirmation</b><div class="small muted">We send you a confirmation link: open it and your booking shows as confirmed.</div></li>
    <li><b>Enjoy the day</b><div class="small muted">Show your tour pass to the driver at pick-up.</div></li>
  </ol></div>
  <h2 class="sec">Your next ports</h2>
  ${tourisfiedCard()}`;
}

// ── EXPLORE ───────────────────────────────────────────────────
let sharedCache = null;

function exploreHeader(active) {
  return `
  <header class="top"><div><h1>Explore</h1><div class="sub">Tours & transfers from Naples</div></div></header>
  <div class="seg">
    <button data-t="private" class="${active === 'private' ? 'on' : ''}">Private</button>
    <button data-t="shared" class="${active === 'shared' ? 'on' : ''}">Shared</button>
    <button data-t="transfer" class="${active === 'transfer' ? 'on' : ''}">Transfers</button>
  </div>`;
}
function bindSeg() {
  view.querySelectorAll('.seg button').forEach(b => b.addEventListener('click', () => {
    location.hash = b.dataset.t === 'transfer' ? '#/transfer' : `#/explore/${b.dataset.t}`;
  }));
}

function renderExplore(tab = 'private') {
  view.innerHTML = exploreHeader(tab) + '<div id="ex"></div>';
  bindSeg();
  if (tab === 'shared') renderShared($('#ex'));
  else $('#ex').innerHTML = `
    <p class="small muted" style="margin-bottom:14px">Your own vehicle and driver for the day (about 8 hours). Prices are <b>total per vehicle</b>, not per person, up to 8 guests.</p>
    ${TOURS.map(t => tourCard(t, 'tile')).join('')}`;
}

async function fetchShared() {
  if (sharedCache) return sharedCache;
  const base = `${CONFIG.supabaseUrl}/rest/v1`;
  const headers = { apikey: CONFIG.supabaseAnon, Authorization: `Bearer ${CONFIG.supabaseAnon}` };
  const q = `${base}/groups?select=id,date,status,total_participants,meeting_point,tours(id,name,description,duration,base_price,image_url)` +
    `&status=in.(open,full)&date=gte.${todayISO()}&order=date.asc`;
  const qt = `${base}/tours?select=id,name,description,duration,base_price,image_url&is_active=eq.true&order=name`;
  const [g, t] = await Promise.all([fetch(q, { headers }), fetch(qt, { headers })]);
  if (!g.ok || !t.ok) throw new Error('HTTP ' + g.status + '/' + t.status);
  sharedCache = { groups: await g.json(), tours: await t.json() };
  return sharedCache;
}

function poolingUrl(params) {
  const p = new URLSearchParams(params);
  return `${CONFIG.poolingSite}/${p.toString() ? '?' + p : ''}#groups`;
}

async function renderShared(el) {
  const intro = `<p class="small muted" style="margin-bottom:14px">Join a group of travellers and share the van: you pay per person. Live groups from <b>taximrcabpooling.com</b>.</p>`;
  el.innerHTML = intro + `<div class="card empty"><div class="big">⏳</div><p class="muted">Loading open groups…</p></div>`;
  try {
    const { groups, tours } = await fetchShared();
    const cards = groups.filter(g => g.tours).map(g => {
      const left = Math.max(0, CONFIG.poolingMaxGroup - (g.total_participants || 0));
      const full = g.status === 'full' || left === 0;
      return `
      <div class="card">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
          <div><h3 style="font-size:16px">${esc(g.tours.name)}</h3>
          <div class="small muted">${fmtDate(g.date)}${g.tours.duration ? ' · ' + esc(g.tours.duration) : ''}${g.meeting_point ? ' · ' + esc(g.meeting_point) : ''}</div></div>
          <div style="text-align:right"><b>${eur(g.tours.base_price)}</b><div class="small muted">per person</div></div>
        </div>
        <div style="margin:10px 0">${full ? '<span class="chip grey">Full</span>' : `<span class="chip ${left <= 3 ? '' : 'ok'}">${left} spots left</span>`}</div>
        <div class="btns2">
          <a class="btn ${full ? 'ghost' : ''}" href="${poolingUrl({ tour: g.tours.id, date: g.date })}" target="_blank" rel="noopener">${full ? 'Join waitlist' : 'Join group'}</a>
          <button class="btn ghost" data-add='${esc(JSON.stringify({ id: g.tours.id, name: g.tours.name, date: g.date, price: g.tours.base_price, mp: g.meeting_point || '' }))}'>I booked it</button>
        </div>
      </div>`;
    }).join('');
    el.innerHTML = intro +
      (cards || '<div class="card empty"><div class="big">🗓️</div><p class="muted">No open groups right now. Start one below!</p></div>') +
      `<h2 class="sec">Start a new group</h2>
      ${tours.map(t => `<a class="card" style="display:flex;justify-content:space-between;gap:10px" href="${poolingUrl({ tour: t.id })}" target="_blank" rel="noopener">
        <div><b>${esc(t.name)}</b><div class="small muted">${esc(t.duration || '')}</div></div><div><b>${eur(t.base_price)}</b><div class="small muted">pp</div></div></a>`).join('')}`;
    el.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', () => addSharedTrip(JSON.parse(b.dataset.add))));
  } catch (err) {
    console.error(err);
    el.innerHTML = `<div class="card empty"><div class="big">📡</div><p>Could not load the shared groups.</p>
      <a class="btn" style="margin-top:14px" href="${poolingUrl({})}" target="_blank" rel="noopener">Open taximrcabpooling.com</a></div>`;
  }
}

function addSharedTrip(g) {
  openSheet(`
    <h2>Add to My Trips</h2>
    <p class="small muted">${esc(g.name)} · ${fmtDate(g.date)}</p>
    <form id="addsh">
      <label class="f">How many people did you book?<input name="people" type="number" min="1" max="13" value="2" required /></label>
      <label class="f">Hotel, address or ship (optional)<input name="where" placeholder="e.g. Hotel Excelsior, Naples · MSC Seashore" /></label>
      <label class="f">Flight or train number (optional)<input name="ref" /></label>
      <p class="note">We send your booking code to ${esc(CONFIG.driverName)} on WhatsApp or by email. It stays pending until we confirm it.</p>
      <button class="btn wa" style="margin-top:16px">Add trip & notify on WhatsApp</button>
      <button class="btn ghost" type="button" id="addsh-mail">Add trip & notify by email</button>
    </form>`);
  const form = $('#addsh');
  form.addEventListener('submit', e => { e.preventDefault(); add('whatsapp'); });
  $('#addsh-mail').addEventListener('click', () => { if (form.reportValidity()) add('email'); });
  function add(channel) {
    const fd = new FormData(form);
    const people = +fd.get('people');
    const where = (fd.get('where') || '').trim(), ref = (fd.get('ref') || '').trim();
    const trip = { id: uid('T'), code: makeBookingCode(), kind: 'shared', tourId: g.id, title: g.name + ' (shared)', date: g.date, people,
      pickup: g.mp || 'Meeting point', pickupDetail: where, ship: ref, price: g.price ? g.price * people : null, status: 'pending', createdAt: Date.now() };
    const msg = [`Hello ${CONFIG.driverName}, I booked a shared tour on taximrcabpooling.com.`, '',
      `- Booking code: ${trip.code}`, customerRef(),
      `- Tour: ${trip.title}`, `- Date: ${fmtDate(g.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`,
      `- Number of people: ${people}`, `- Location: ${trip.pickup}`,
      where ? `- Pick-up details: ${where}` : '', `- Ship / flight / train number: ${ref || '-'}`].filter(Boolean).join('\n');
    S.trips.push(trip); save(); closeSheet();
    sendRequest(channel, { kindLabel: 'Shared tour', code: trip.code, title: trip.title, date: trip.date, msg });
    location.hash = '#/trip/' + trip.id;
  }
}

// ── TOUR DETAIL ───────────────────────────────────────────────
function renderTour(id) {
  const t = tourById(id);
  if (!t) { location.hash = '#/explore'; return; }
  view.innerHTML = `
  <div class="hero" style="background-image:url(${t.img})"><a class="back" href="#/explore">‹ Explore</a><span class="hcode">${esc(t.code)} · Private day tour</span></div>
  <h1 class="detail-title">${esc(t.title)}</h1>
  <p class="small muted">About 8 hours · pick-up at the Port of Naples, station, airport, hotel or B&B${t.note ? '<br>' + esc(t.note) : ''}</p>
  <h2 class="sec">Your day</h2>
  <ol class="stops">${t.stops.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
  <p class="note">Recommended start time: 7:30 am (the final time is confirmed a few days before the tour). About one hour of free time at each stop (Pompeii about 2 hours). We plan the day around your ship and bring you back with a good margin before all aboard.</p>
  <h2 class="sec">Price per vehicle</h2>
  <div class="card"><ul class="plain">${scaleRows(t.scale).map(r => `<li><span>${r.label} guests</span><b>${eur(r.price)}</b></li>`).join('')}</ul></div>
  <h2 class="sec">Not included</h2>
  <ul class="ticks x">${t.excluded.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
  <div class="sticky-cta"><a class="btn" href="#/book/${t.id}">Request this tour</a></div>`;
}

// ── BOOKING (private) ─────────────────────────────────────────
const PICKUPS = ['Port of Naples (cruise terminal)', 'Naples Central Station', 'Naples Airport', 'Hotel / B&B in Naples', 'Port of Salerno', 'Sorrento', 'Positano / Amalfi', 'Other'];

function renderBook(id) {
  const t = tourById(id);
  if (!t) { location.hash = '#/explore'; return; }
  const p = S.profile;
  view.innerHTML = `
  <a class="back" href="#/tour/${t.id}">‹ ${esc(t.code)}</a>
  <h1 class="detail-title">Request ${esc(t.title)}</h1>
  <p class="small muted">We check availability and reply on WhatsApp or by email. Nothing is charged now.</p>
  <form id="bk">
    <div class="f2">
      <label class="f">Date<input name="date" type="date" min="${todayISO()}" required /></label>
      <label class="f">Guests<select name="people">${[1, 2, 3, 4, 5, 6, 7, 8].map(n => `<option ${n === 2 ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    </div>
    <label class="f">Pick-up<select name="pickup">${PICKUPS.map(x => `<option>${x}</option>`).join('')}</select></label>
    <label class="f"><span id="pd-label">Terminal / extra details (optional)</span><input name="pickupdetail" id="pd" placeholder="Hotel name and address, station, terminal…" /></label>
    <label class="f">Ship, flight or train (name or number)<input name="ship" placeholder="e.g. MSC Seashore · flight AZ1234 · train FR9620" /></label>
    <label class="f">Meeting time<input name="time" type="time" value="${CONFIG.defaultStart}" /></label>
    <p class="note" style="margin-top:6px">Recommended start time: <b>7:30 am</b>. You can change it, but we suggest doing so only if your ship arrives later. The final meeting time will be confirmed a few days before the tour.</p>
    <label class="f">Wishes (lunch, kids, mobility…)<textarea name="notes" rows="2"></textarea></label>
    <div class="f2">
      <label class="f">Name<input name="name" value="${esc(p.name)}" required /></label>
      <label class="f">Mobile<input name="phone" type="tel" value="${esc(p.phone)}" required /></label>
    </div>
    <label class="f">Email<input name="email" type="email" value="${esc(p.email)}" required /></label>
    <div id="season"></div>
    <div class="quote"><div><div class="small" style="opacity:.8">Total per vehicle</div><b id="qprice">—</b></div><div class="small" style="text-align:right;opacity:.8">€${CONFIG.depositAmount} to book<br>balance in cash on the day</div></div>
    <p class="note" id="qnote"></p>
    <label class="f" style="display:flex;gap:10px;align-items:flex-start;font-weight:400"><input type="checkbox" name="terms" required style="width:auto;margin-top:3px" /> <span>I accept the <a href="#" id="seeterms" style="text-decoration:underline">Terms & Conditions</a> (€${CONFIG.depositAmount} non-refundable reservation fee).</span></label>
    <button class="btn wa" style="margin-top:16px">Send request on WhatsApp</button>
    <button class="btn ghost" type="button" id="bymail">Send by email to ${esc(CONFIG.email)}</button>
  </form>`;
  const form = $('#bk');
  const upd = () => {
    const f = Object.fromEntries(new FormData(form));
    const price = priceFor(t.scale, +f.people);
    const far = !/Naples/.test(f.pickup);
    $('#qprice').textContent = far ? 'to be confirmed' : eur(price);
    $('#qnote').textContent = far ? 'Pick-up outside Naples: we will confirm itinerary and fare with you.' : `${f.people} guest${f.people > 1 ? 's' : ''} · balance on the day ${eur(price - CONFIG.depositAmount)} in cash (euros).`;
    const atPort = f.pickup === PICKUPS[0];
    $('#pd').required = !atPort;
    $('#pd-label').textContent = atPort ? 'Terminal / extra details (optional)' : 'Hotel name & address, or meeting point';
    const m = f.date ? parseDate(f.date).getMonth() : -1;
    const coast = /Amalfi|Positano|Ravello|Sorrento/.test(t.title);
    $('#season').innerHTML = coast && m !== -1 && (m >= 10 || m <= 2)
      ? `<p class="note">Winter note: from November to March much of the Amalfi Coast is closed. We suggest Amalfi (Duomo di Sant’Andrea) and Sorrento, with a short stop in Positano.</p>` : '';
  };
  form.addEventListener('input', upd); upd();
  $('#seeterms').addEventListener('click', e => { e.preventDefault(); showTerms(); });

  const build = () => {
    if (!form.reportValidity()) return null;
    const f = Object.fromEntries(new FormData(form));
    const far = !/Naples/.test(f.pickup);
    const price = far ? null : priceFor(t.scale, +f.people);
    const code = makeBookingCode();
    const msg = [
      `Hello ${CONFIG.driverName}, I would like to book a private tour.`, '',
      `- Booking code: ${code}`,
      `- Name: ${f.name}`,
      `- Date: ${fmtDate(f.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`,
      `- Mobile phone number: ${f.phone}`,
      `- Email address: ${f.email}`,
      `- Number of people: ${f.people}`,
      `- Option chosen: ${t.code} – ${t.title}`,
      `- Ship / flight / train number: ${f.ship || '-'}`,
      `- Meeting time: ${f.time || 'as soon as we disembark'}`,
      f.time && f.time !== CONFIG.defaultStart ? `- Start time changed from the recommended ${CONFIG.defaultStart}` : '',
      `- Location: ${f.pickup}`,
      f.pickupdetail ? `- Pick-up details: ${f.pickupdetail}` : '',
      f.notes ? `- Notes: ${f.notes}` : '',
      `- Quoted fare: ${price ? eur(price) + ' total per vehicle' : 'to be confirmed'}`,
      '', 'I accept the Terms & Conditions.',
    ].filter(Boolean).join('\n');
    const trip = { id: uid('T'), code, kind: 'private', tourId: t.id, title: `${t.code} · ${t.title}`, date: f.date, people: +f.people,
      pickup: f.pickup, pickupDetail: (f.pickupdetail || '').trim(), ship: f.ship, time: f.time, notes: f.notes, price, status: 'pending', createdAt: Date.now() };
    return { msg, trip };
  };
  const finish = (r, channel) => {
    S.trips.push(r.trip); save();
    sendRequest(channel, { kindLabel: 'Booking request', code: r.trip.code, title: r.trip.title, date: r.trip.date, msg: r.msg });
    location.hash = '#/trip/' + r.trip.id;
    toast('Request sent · pending confirmation');
  };
  form.addEventListener('submit', e => { e.preventDefault(); const r = build(); if (r) finish(r, 'whatsapp'); });
  $('#bymail').addEventListener('click', () => { const r = build(); if (r) finish(r, 'email'); });
}

function showTerms() {
  openSheet(`<h2>Terms & Conditions</h2>${TERMS.map(([h, b]) => `<h3 style="margin-top:16px;font-size:15px">${esc(h)}</h3><p class="small" style="margin-top:4px;line-height:1.55">${esc(b)}</p>`).join('')}
  <p class="small muted" style="margin-top:16px">By making a reservation you confirm you have read, understood and agreed to these terms.</p>`);
}

// ── TRANSFER ──────────────────────────────────────────────────
function renderTransfer() {
  const p = S.profile;
  view.innerHTML = exploreHeader('transfer') + `
  <p class="small muted" style="margin-bottom:6px">Port, airport, station, hotel, Amalfi Coast, Sorrento, Rome… Tell us where and when: we reply with the fare.</p>
  <form id="tr">
    <label class="f">From (airport, port, hotel or address)<input name="from" required placeholder="e.g. Naples Airport, or Hotel Excelsior, Via Partenope 48" /></label>
    <label class="f">To (hotel or address)<input name="to" required placeholder="e.g. Hotel Le Sirenuse, Via Colombo 30, Positano" /></label>
    <div class="f2"><label class="f">Date<input name="date" type="date" min="${todayISO()}" required /></label><label class="f">Time<input name="time" type="time" required /></label></div>
    <div class="f2"><label class="f">Passengers<input name="people" type="number" min="1" max="16" value="2" required /></label><label class="f">Suitcases<input name="bags" type="number" min="0" max="30" value="2" /></label></div>
    <label class="f">Flight, train or ship (name or number)<input name="ref" placeholder="e.g. flight AZ1234 · train FR9620 · MSC Seashore" /></label>
    <button class="btn wa" style="margin-top:16px">Ask for a quote on WhatsApp</button>
    <button class="btn ghost" type="button" id="tr-mail">Ask by email to ${esc(CONFIG.email)}</button>
  </form>`;
  bindSeg();
  const form = $('#tr');
  form.addEventListener('submit', e => { e.preventDefault(); send('whatsapp'); });
  $('#tr-mail').addEventListener('click', () => { if (form.reportValidity()) send('email'); });
  function send(channel) {
    const f = Object.fromEntries(new FormData(form));
    const code = makeBookingCode();
    const msg = [`Hello ${CONFIG.driverName}, I need a transfer.`, '',
      `- Booking code: ${code}`,
      `- Name: ${p.name}`, `- Mobile: ${p.phone}`, `- Email: ${p.email}`,
      `- From: ${f.from}`, `- To: ${f.to}`, `- Date & time: ${fmtDate(f.date)} at ${f.time}`,
      `- Passengers: ${f.people} · Suitcases: ${f.bags}`, `- Ship / flight / train number: ${f.ref || '-'}`,
    ].filter(Boolean).join('\n');
    const trip = { id: uid('T'), code, kind: 'transfer', title: `Transfer · ${f.from} to ${f.to}`, date: f.date, time: f.time,
      people: +f.people, pickup: f.from, ship: f.ref || '', price: null, status: 'pending', createdAt: Date.now() };
    S.trips.push(trip); save();
    sendRequest(channel, { kindLabel: 'Transfer request', code, title: trip.title, date: trip.date, msg });
    location.hash = '#/trip/' + trip.id;
    toast('Request sent · pending confirmation');
  }
}

// ── TRIPS ─────────────────────────────────────────────────────
function renderTrips() {
  const up = upcomingTrips();
  const past = S.trips.filter(isPastTrip).sort((a, b) => b.date.localeCompare(a.date));
  view.innerHTML = `
  <header class="top"><div><h1>My Trips</h1><div class="sub">Requests, bookings and past tours</div></div></header>
  <h2 class="sec" style="margin-top:6px">Upcoming</h2>
  ${up.length ? up.map(tripRow).join('') : `<div class="card empty"><div class="big">🧳</div><p class="muted">No upcoming trips yet.</p><a class="btn" href="#/explore" style="margin-top:14px">Explore tours</a></div>`}
  ${past.length ? `<h2 class="sec">Past</h2>${past.map(tripRow).join('')}` : ''}`;
}

function renderTrip(id) {
  const t = S.trips.find(x => x.id === id);
  if (!t) { location.hash = '#/trips'; return; }
  const tour = tourById(t.tourId);
  const past = isPastTrip(t);
  const confirmed = t.status === 'confirmed';
  const idx = t.status === 'cancelled' ? -1 : confirmed ? (past ? 2 : 1) : 0;
  const hasPompeii = tour && /Pompeii/.test(tour.stops.join(' '));
  const passText = bookingQrText(t);
  const balance = t.price && t.kind !== 'shared' && t.kind !== 'transfer' ? t.price - CONFIG.depositAmount : null;

  let actions = '';
  if (!past && t.status === 'pending') {
    actions = `
      <div class="card">
        <b>Pending confirmation</b>
        <p class="small muted" style="margin-top:4px">Your booking is not confirmed yet.</p>
        <ol class="stops" style="margin-top:6px">
          <li><span class="small">${esc(CONFIG.driverName)} checks availability and replies on WhatsApp or by email.</span></li>
          ${t.kind === 'private' ? `<li><span class="small">He sends you the link to pay the €${CONFIG.depositAmount} reservation fee.${balance ? ` The balance of ${eur(balance)} is paid in cash on the day.` : ''}</span></li>` : ''}
          <li><span class="small">Once everything is settled you receive a <b>confirmation link</b>: open it and this booking shows as <b>Confirmed</b>.</span></li>
        </ol>
        <p class="small muted" style="margin-top:10px">Mention your booking code <b>${esc(t.code)}</b> when you write to us.</p>
        ${t.kind === 'private' && CONFIG.depositLink ? `<a class="btn" target="_blank" rel="noopener" href="${esc(CONFIG.depositLink)}">Pay €${CONFIG.depositAmount} reservation fee</a>` : ''}
      </div>`;
  }
  if (!past && confirmed) {
    actions = `
      <div class="card pass">
        <div class="small muted" style="letter-spacing:.1em;text-transform:uppercase">Tour pass · ${esc(t.code)}</div>
        <h3 style="margin:4px 0 12px">${esc(t.name || S.profile.name)} · ${t.people} guest${t.people > 1 ? 's' : ''}</h3>
        <div class="qr">${qrImg(passText)}</div>
        <p class="small muted" style="margin-top:10px">Show this to your driver at pick-up. Scanning it shows all the booking details.</p>
      </div>
      ${hasPompeii ? `<div class="card"><b>Pompeii tickets</b><p class="small muted" style="margin-top:4px">Buy them online about one month before (Pompeii Express, about €26). Want a licensed guide for 2h? €140 — ask ${esc(CONFIG.driverName)}.</p></div>` : ''}
      <div class="btns2">
        <a class="btn navy" id="gcal" target="_blank" rel="noopener" href="${esc(googleCalendarUrl(t))}">Add to Google Calendar</a>
        <button class="btn ghost" id="ics" type="button">Apple / other calendar (.ics)</button>
      </div>
      <div style="margin-top:12px">${tourisfiedCard()}</div>`;
  }
  if (past && confirmed) {
    actions = `<div class="card"><b>Thank you for travelling with us.</b><p class="small muted" style="margin-top:4px">We hope you enjoyed your day. A short post in your cruise Facebook group helps us a lot: “I booked with Taxi Mister Cab Driver – Naples”.</p></div>
      <a class="btn" href="#/explore">Book your next tour</a>
      <div style="margin-top:12px">${tourisfiedCard()}</div>`;
  }
  if (past && t.status === 'pending') {
    actions = `<div class="card"><b>This request was not confirmed</b><p class="small muted" style="margin-top:4px">If you think this is a mistake, write to ${esc(CONFIG.driverName)} with your booking code ${esc(t.code)}.</p></div>`;
  }

  view.innerHTML = `
  <a class="back" href="#/trips">‹ My Trips</a>
  <h1 class="detail-title">${esc(t.title)}</h1>
  <p class="small muted">${fmtDate(t.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}${t.time ? ' · ' + esc(t.time) : ''}</p>
  <div style="margin-top:8px">${statusChip(t)}</div>
  ${idx >= 0 ? `<div class="steps">${['Request sent', 'Confirmed', t.kind === 'transfer' ? 'Done' : 'Tour day'].map((s, i) => `<div class="${i <= idx ? 'done' : ''}">${s}</div>`).join('')}</div>` : ''}
  <div class="card" style="margin-top:14px"><ul class="plain">
    <li><span class="muted">Booking code</span><b>${esc(t.code)}</b></li>
    <li><span class="muted">Guests</span><b>${t.people}</b></li>
    <li><span class="muted">Pick-up</span><b style="text-align:right">${esc(pickupText(t) || '-')}</b></li>
    ${t.ship ? `<li><span class="muted">Ship / flight / train</span><b style="text-align:right">${esc(t.ship)}</b></li>` : ''}
    ${t.time ? `<li><span class="muted">Meeting time</span><b>${esc(t.time)}</b></li>` : ''}
    <li><span class="muted">Total</span><b>${t.price ? eur(t.price) + (t.kind === 'private' ? ' per vehicle' : '') : 'to be confirmed'}</b></li>
    ${confirmed && balance ? `<li><span class="muted">Balance on the day</span><b>${eur(balance)} in cash</b></li>` : ''}
  </ul></div>
  ${!past && t.status !== 'cancelled' && t.kind === 'private' ? '<p class="note">The final meeting time will be confirmed a few days before the tour.</p>' : ''}
  <div style="margin-top:12px">${actions}</div>
  <a class="btn wa" style="margin-top:10px" target="_blank" rel="noopener" href="${chatLink('I have a question about my booking.', [`- Booking code: ${t.code}`, `- Booking: ${t.title}`, `- Date: ${fmtDate(t.date)}${t.time ? ' at ' + t.time : ''}`,
    `- Number of people: ${t.people}`, `- Location: ${t.pickup || '-'}`, t.pickupDetail ? `- Pick-up details: ${t.pickupDetail}` : '',
    `- Ship / flight / train number: ${t.ship || '-'}`, t.notes ? `- Notes: ${t.notes}` : '', `- Status: ${t.status}`].filter(Boolean))}">Chat with ${esc(CONFIG.driverName)}</a>
  ${!past && t.status === 'pending' ? '<button class="btn ghost" id="cancel" style="margin-top:10px">Cancel this request</button>' : ''}`;

  $('#ics')?.addEventListener('click', () => downloadICS(t));
  $('#cancel')?.addEventListener('click', () => {
    if (!confirm('Cancel this request? Please also tell your driver on WhatsApp.')) return;
    t.status = 'cancelled'; save(); renderTrip(id);
  });
}

// ── CONFIRMATION LINK (sent by Ciro) ──────────────────────────
async function renderConfirm(token) { return handleConfirm(token, verifyConfirmation); }       // long links (first version)
async function renderConfirmCompact(token) { return handleConfirm(token, verifyCompact); }  // short links

async function handleConfirm(token, verify) {
  view.innerHTML = `<div class="card empty" style="margin-top:40px"><div class="big">🔐</div><p class="muted">Checking your confirmation…</p></div>`;
  const res = await verify(token, CONFIG.confirmPublicKey);
  if (!res.ok) {
    view.innerHTML = `
    <header class="top"><div><h1>Confirmation</h1></div></header>
    <div class="card empty"><div class="big">⚠️</div>
      <p><b>${res.reason === 'not-setup' ? 'Confirmations are not active yet.' : 'This confirmation link is not valid.'}</b></p>
      <p class="small muted" style="margin-top:6px">Please check that you opened the whole link, or ask ${esc(CONFIG.driverName)} to send it again.</p>
      <a class="btn wa" style="margin-top:14px" target="_blank" rel="noopener" href="${chatLink('my confirmation link does not open.')}">Write to ${esc(CONFIG.driverName)}</a>
      <a class="btn ghost" href="#/trips">My Trips</a></div>`;
    return;
  }
  const d = res.data;
  let t = S.trips.find(x => x.code === d.c);
  if (!t) {
    t = { id: uid('T'), code: d.c, createdAt: Date.now() };
    S.trips.push(t);
  }
  // The confirmed details (as agreed with Ciro) replace what was requested
  Object.assign(t, {
    kind: d.k || t.kind || 'private', tourId: d.o || t.tourId, title: d.t || t.title || 'Confirmed booking', date: d.d || t.date,
    time: d.h || t.time || '', people: d.p || t.people || 1, pickup: d.u || t.pickup || '', pickupDetail: d.u ? '' : (t.pickupDetail || ''), price: d.e ?? t.price ?? null,
    name: d.n || t.name, ship: d.s || t.ship || '', status: 'confirmed', confirmedAt: Date.now(), proof: token,
  });
  save();
  history.replaceState(null, '', '#/trip/' + t.id);
  router();
  toast('Booking confirmed');
}

// ── CALENDAR (.ics and Google Calendar) ───────────────────────
// Everything the customer needs on the day, in one event.
function calendarInfo(t) {
  const tour = tourById(t.tourId);
  const time = t.time || CONFIG.defaultStart;
  const hours = t.kind === 'transfer' ? 1 : 8;
  const [y, mo, d] = t.date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const fmt = dt => `${dt.getUTCFullYear()}${String(dt.getUTCMonth() + 1).padStart(2, '0')}${String(dt.getUTCDate()).padStart(2, '0')}T${String(dt.getUTCHours()).padStart(2, '0')}${String(dt.getUTCMinutes()).padStart(2, '0')}00`;
  const start = fmt(new Date(Date.UTC(y, mo - 1, d, hh, mm)));
  const end = fmt(new Date(Date.UTC(y, mo - 1, d, hh + hours, mm)));
  const balance = t.kind === 'private' && t.price ? t.price - CONFIG.depositAmount : null;
  const L = [];
  L.push(`Booking code: ${t.code}`);
  L.push(`Status: ${t.status === 'confirmed' ? 'CONFIRMED' : 'PENDING'}`);
  L.push('');
  L.push(`Date: ${fmtDate(t.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`);
  L.push(`Meeting time: ${time} (the final time is confirmed a few days before the tour)`);
  L.push(`Guests: ${t.people}`);
  L.push(`Pick-up: ${pickupText(t) || '-'}`);
  if (t.ship) L.push(`Ship / flight / train: ${t.ship}`);
  if (t.notes) L.push(`Notes: ${t.notes}`);
  if (tour) {
    L.push('', 'Your day:');
    tour.stops.forEach((x, i) => L.push(`${i + 1}. ${x}`));
  }
  if (t.price) {
    L.push('', t.kind === 'private' ? `Total: ${eur(t.price)} per vehicle` : `Total: ${eur(t.price)}`);
    if (balance) L.push(`Reservation fee: €${CONFIG.depositAmount} (paid) · Balance on the day: ${eur(balance)} in cash (euros) to the driver`);
  }
  if (tour && tour.excluded.length) L.push(`Not included: ${tour.excluded.join(', ')}`);
  L.push('', `Your driver: ${CONFIG.driverName} – ${CONFIG.brand}`,
    `WhatsApp / phone: ${CONFIG.phoneDisplay}`, `Email: ${CONFIG.email}`,
    `Your booking: ${location.href.split('#')[0]}#/trip/${t.id}`);
  return {
    title: `${t.title} – ${CONFIG.brand}`,
    location: pickupText(t),
    description: L.join('\n'),
    start, end, time,
  };
}

// iCalendar text rules: escape \ ; , and newlines; fold lines at 75 bytes
const icsEscape = v => String(v).replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
function icsFold(line) {
  const enc = new TextEncoder();
  let out = '', cur = '', bytes = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (bytes + n > 75) { out += cur + '\r\n '; cur = ''; bytes = 1; }
    cur += ch; bytes += n;
  }
  return out + cur;
}

function downloadICS(t) {
  const c = calendarInfo(t);
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Taxi Mister Cab Driver//Mister Cab App//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VTIMEZONE', 'TZID:Europe/Rome',
    'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'TZNAME:CEST', 'DTSTART:19700329T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
    'BEGIN:STANDARD', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'TZNAME:CET', 'DTSTART:19701025T030000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    `UID:${t.code || t.id}@mistercab-app`, `DTSTAMP:${stamp}`, 'SEQUENCE:0',
    `DTSTART;TZID=Europe/Rome:${c.start}`, `DTEND;TZID=Europe/Rome:${c.end}`,
    `SUMMARY:${icsEscape(c.title)}`,
    ...(c.location ? [`LOCATION:${icsEscape(c.location)}`] : []),
    `DESCRIPTION:${icsEscape(c.description)}`,
    `STATUS:${t.status === 'confirmed' ? 'CONFIRMED' : 'TENTATIVE'}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEscape('Tomorrow: ' + t.title)}`, 'TRIGGER:-P1D', 'END:VALARM',
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEscape('Your driver meets you at ' + c.time)}`, 'TRIGGER:-PT2H', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ];
  const ics = lines.map(icsFold).join('\r\n') + '\r\n';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  a.download = `mister-cab-${t.code || 'trip'}.ics`;
  a.click();
}

function googleCalendarUrl(t) {
  const c = calendarInfo(t);
  const q = new URLSearchParams({
    action: 'TEMPLATE', text: c.title, dates: `${c.start}/${c.end}`, ctz: 'Europe/Rome',
    details: c.description, location: c.location || '',
  });
  return 'https://calendar.google.com/calendar/render?' + q.toString();
}

// ── TOURISFIED (link to the landing page) ─────────────────────
function tourisfiedCard() {
  return `
  <a class="card tf" href="${CONFIG.tourisfied}" target="_blank" rel="noopener" style="display:block">
    <div class="small" style="letter-spacing:.12em;text-transform:uppercase;font-weight:700;color:var(--terra)">TOURISFIED network</div>
    <b style="display:block;margin-top:4px;font-size:16px">Trusted drivers in Italy & every Mediterranean port</b>
    <p class="small muted" style="margin-top:4px">Other stops on your cruise? Discover trusted local drivers in Italy and across the Mediterranean.</p>
    <span class="small" style="font-weight:700;color:var(--navy);display:inline-block;margin-top:8px">Visit tourisfied.com ›</span>
  </a>`;
}

// ── ACCOUNT ───────────────────────────────────────────────────
function renderAccount() {
  const p = S.profile;
  view.innerHTML = `
  <header class="top"><div><h1>Account</h1><div class="sub">${esc(p.name)}</div></div></header>
  <h2 class="sec" style="margin-top:6px">Your details</h2>
  <form class="card" id="prof">
    <label class="f" style="margin-top:0">Full name<input name="name" value="${esc(p.name)}" required /></label>
    <label class="f">Email<input name="email" type="email" value="${esc(p.email)}" required /></label>
    <label class="f">Mobile / WhatsApp<input name="phone" type="tel" value="${esc(p.phone)}" required /></label>
    <button class="btn navy" style="margin-top:14px">Save</button>
  </form>
  <h2 class="sec">Contact us</h2>
  <div class="card rows">
    <a href="${chatLink('I would like to talk to you.')}" target="_blank" rel="noopener"><span>WhatsApp ${esc(CONFIG.phoneDisplay)}</span><span class="chev">›</span></a>
    <a href="tel:+${CONFIG.whatsapp}"><span>Call us</span><span class="chev">›</span></a>
    <a href="mailto:${CONFIG.email}"><span>${esc(CONFIG.email)}</span><span class="chev">›</span></a>
    <a href="${CONFIG.website}" target="_blank" rel="noopener"><span>taximistercabdriver.com</span><span class="chev">›</span></a>
    <a href="${CONFIG.poolingSite}" target="_blank" rel="noopener"><span>taximrcabpooling.com</span><span class="chev">›</span></a>
    <a href="${CONFIG.tourisfied}" target="_blank" rel="noopener"><span>TOURISFIED: other ports in Italy and the Mediterranean</span><span class="chev">›</span></a>
  </div>
  <h2 class="sec">More</h2>
  <div class="card rows">
    <button class="rowbtn" id="install"><span>Install the app on your phone</span><span class="chev">›</span></button>
    <button class="rowbtn" id="terms"><span>Terms & Conditions</span><span class="chev">›</span></button>
    <button class="rowbtn" id="reset"><span style="color:var(--terra)">Sign out & delete data on this phone</span><span class="chev">›</span></button>
  </div>
  <p class="note" style="text-align:center;margin-top:20px">${esc(CONFIG.brand)} · Naples, Italy</p>`;

  $('#prof').addEventListener('submit', e => {
    e.preventDefault();
    Object.assign(S.profile, Object.fromEntries(new FormData(e.target)));
    save(); toast('Details saved');
  });
  $('#terms').addEventListener('click', showTerms);
  $('#install').addEventListener('click', showInstall);
  $('#reset').addEventListener('click', () => {
    if (!confirm('Delete your details and trips from this phone?')) return;
    try { localStorage.removeItem(STORE_KEY); } catch { /* ignore */ }
    S = { profile: null, trips: [] };
    location.hash = '';
    router();
  });
}

let deferredInstall = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; });
function showInstall() {
  if (deferredInstall) { deferredInstall.prompt(); deferredInstall = null; return; }
  openSheet(`<h2>Install the app</h2>
    <p style="margin-top:10px"><b>iPhone (Safari):</b> tap the Share button (the square with an arrow), then <b>Add to Home Screen</b>.</p>
    <p style="margin-top:10px"><b>Android (Chrome):</b> tap the menu ⋮, then <b>Install app</b> or <b>Add to Home screen</b>.</p>
    <p class="note">The app opens full screen and keeps your trips and tour pass available offline.</p>`);
}

// ── boot ──────────────────────────────────────────────────────
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
router();
