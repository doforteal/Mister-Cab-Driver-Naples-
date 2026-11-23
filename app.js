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
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ profile: S.profile, trips: S.trips })); } catch { toast('Could not save on this device'); }
}

const tourById = id => TOURS.find(t => t.id === id);
// A trip is "past" when cancelled or once its date has gone by
const isPastTrip = t => t.status === 'cancelled' || t.date < todayISO();

function qrImg(text, cell = 5) {
  if (typeof qrcode === 'undefined') return `<div class="code-box">${esc(text)}</div>`;
  const q = qrcode(0, 'M');
  q.addData(text);
  q.make();
  return q.createImgTag(cell, 8, 'QR code');
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
  account: renderAccount,
};

function router() {
  closeSheet();
  if (!S.profile) { renderWelcome(); return; }
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
      <li>Your tour pass, deposit link and chat with your driver</li>
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
    location.hash = '#/home';
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
    <div class="info"><h3>${esc(t.title)}</h3><div class="small muted">${esc(t.people)} guest${t.people > 1 ? 's' : ''} · ${esc(t.pickup || '')}</div><div style="margin-top:6px">${statusChip(t)}</div></div>
    <span class="chev muted">›</span>
  </a>`;
}

function statusChip(t) {
  if (t.status === 'cancelled') return '<span class="chip grey">Cancelled</span>';
  if (isPastTrip(t)) return '<span class="chip ok">Completed</span>';
  return {
    requested: '<span class="chip">Request sent</span>',
    deposit: '<span class="chip navy">Deposit paid</span>',
    confirmed: '<span class="chip ok">Confirmed</span>',
  }[t.status] || '';
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
    <a class="icon-btn" href="${waLink(`Hello ${CONFIG.driverName}, I am ${S.profile.name}.`)}" target="_blank" rel="noopener" aria-label="WhatsApp">💬</a>
  </header>
  ${next ? `
  <a class="mcard" href="#/trip/${next.id}" style="display:block">
    <div class="row"><div><div class="club">Your next trip</div><div class="name">${esc(next.title)}</div></div>${statusChip(next)}</div>
    <div class="pts"><b>${parseDate(next.date).getDate()}</b><span>${fmtDate(next.date, { month: 'long', year: 'numeric' })} · ${fmtDate(next.date, { weekday: 'long' })}</span></div>
    <div class="next" style="margin-top:8px">${esc(next.people)} guest${next.people > 1 ? 's' : ''} · ${esc(next.pickup || '')}${next.time ? ' · ' + esc(next.time) : ''}</div>
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
    <a href="${waLink(`Hello ${CONFIG.driverName}!`)}" target="_blank" rel="noopener"><span class="qi">💬</span>WhatsApp</a>
  </div>
  <h2 class="sec">Private day tours <a href="#/explore">See all</a></h2>
  <div class="scroller">${featured.map(t => tourCard(t)).join('')}</div>
  <h2 class="sec">How it works</h2>
  <div class="card"><ol class="stops">
    <li><b>Choose your tour</b><div class="small muted">Prices are total per vehicle, up to 8 guests.</div></li>
    <li><b>Send the request</b><div class="small muted">We check availability and reply on WhatsApp.</div></li>
    <li><b>Secure your date</b><div class="small muted">€${CONFIG.depositAmount} reservation fee, balance in cash on the day.</div></li>
    <li><b>Enjoy the day</b><div class="small muted">Show your tour pass to the driver at pick-up.</div></li>
  </ol></div>
  <h2 class="sec">Other ports in Italy?</h2>
  <a class="card" href="${CONFIG.tourisfied}" target="_blank" rel="noopener" style="display:block"><b>TOURISFIED network</b><p class="small muted" style="margin-top:4px">Trusted local drivers in other cruise ports. Tap to discover.</p></a>`;
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
      <button class="btn" style="margin-top:16px">Add trip</button>
    </form>`);
  $('#addsh').addEventListener('submit', e => {
    e.preventDefault();
    const people = +new FormData(e.target).get('people');
    const trip = { id: uid('T'), kind: 'shared', tourId: g.id, title: g.name + ' (shared)', date: g.date, people,
      pickup: g.mp || 'Meeting point', price: g.price ? g.price * people : null, status: 'requested', createdAt: Date.now() };
    S.trips.push(trip); save(); closeSheet();
    location.hash = '#/trip/' + trip.id;
  });
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
  <p class="note">About one hour of free time at each stop (Pompeii about 2 hours). We plan the day around your ship and bring you back with a good margin before all aboard.</p>
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
  <p class="small muted">We check availability and reply on WhatsApp. Nothing is charged now.</p>
  <form id="bk">
    <div class="f2">
      <label class="f">Date<input name="date" type="date" min="${todayISO()}" required /></label>
      <label class="f">Guests<select name="people">${[1, 2, 3, 4, 5, 6, 7, 8].map(n => `<option ${n === 2 ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    </div>
    <label class="f">Pick-up<select name="pickup">${PICKUPS.map(x => `<option>${x}</option>`).join('')}</select></label>
    <div class="f2">
      <label class="f">Cruise / ship<input name="ship" placeholder="e.g. MSC Seashore" /></label>
      <label class="f">Meeting time<input name="time" type="time" value="08:00" /></label>
    </div>
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
    <button class="btn ghost" type="button" id="bymail">Send by email instead</button>
  </form>`;
  const form = $('#bk');
  const upd = () => {
    const f = Object.fromEntries(new FormData(form));
    const price = priceFor(t.scale, +f.people);
    const far = !/Naples/.test(f.pickup);
    $('#qprice').textContent = far ? 'to be confirmed' : eur(price);
    $('#qnote').textContent = far ? 'Pick-up outside Naples: we will confirm itinerary and fare with you.' : `${f.people} guest${f.people > 1 ? 's' : ''} · balance on the day ${eur(price - CONFIG.depositAmount)} in cash (euros).`;
    const m = f.date ? parseDate(f.date).getMonth() : -1;
    const coast = /Amalfi|Positano|Ravello|Sorrento/.test(t.title);
    $('#season').innerHTML = coast && m !== -1 && (m >= 10 || m <= 2)
      ? `<p class="note">❄️ Winter note: from November to March much of the Amalfi Coast is closed. We suggest Amalfi (Duomo di Sant’Andrea) and Sorrento, with a short stop in Positano.</p>` : '';
  };
  form.addEventListener('input', upd); upd();
  $('#seeterms').addEventListener('click', e => { e.preventDefault(); showTerms(); });

  const build = () => {
    if (!form.reportValidity()) return null;
    const f = Object.fromEntries(new FormData(form));
    const far = !/Naples/.test(f.pickup);
    const price = far ? null : priceFor(t.scale, +f.people);
    const msg = [
      `Hello ${CONFIG.driverName}, I would like to book a private tour.`, '',
      `- Name: ${f.name}`,
      `- Date: ${fmtDate(f.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`,
      `- Mobile phone number: ${f.phone}`,
      `- Email address: ${f.email}`,
      `- Number of people: ${f.people}`,
      `- Option chosen: ${t.code} – ${t.title}`,
      `- Cruise company / ship name: ${f.ship || '-'}`,
      `- Meeting time: ${f.time || 'as soon as we disembark'}`,
      `- Location: ${f.pickup}`,
      f.notes ? `- Notes: ${f.notes}` : '',
      `- Quoted fare: ${price ? eur(price) + ' total per vehicle' : 'to be confirmed'}`,
      '', 'I accept the Terms & Conditions.',
    ].filter(Boolean).join('\n');
    const trip = { id: uid('T'), kind: 'private', tourId: t.id, title: `${t.code} · ${t.title}`, date: f.date, people: +f.people,
      pickup: f.pickup, ship: f.ship, time: f.time, notes: f.notes, price, status: 'requested', createdAt: Date.now() };
    return { msg, trip };
  };
  const finish = (r, href) => {
    S.trips.push(r.trip); save();
    window.open(href, '_blank', 'noopener');
    location.hash = '#/trip/' + r.trip.id;
    toast('Request saved in My Trips');
  };
  form.addEventListener('submit', e => { e.preventDefault(); const r = build(); if (r) finish(r, waLink(r.msg)); });
  $('#bymail').addEventListener('click', () => { const r = build(); if (r) finish(r, mailLink(`Tour request – ${t.code} – ${r.trip.date}`, r.msg)); });
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
    <label class="f">From<input name="from" required placeholder="e.g. Naples Airport" /></label>
    <label class="f">To<input name="to" required placeholder="e.g. Hotel in Positano" /></label>
    <div class="f2"><label class="f">Date<input name="date" type="date" min="${todayISO()}" required /></label><label class="f">Time<input name="time" type="time" required /></label></div>
    <div class="f2"><label class="f">Passengers<input name="people" type="number" min="1" max="16" value="2" required /></label><label class="f">Suitcases<input name="bags" type="number" min="0" max="30" value="2" /></label></div>
    <label class="f">Flight / train / ship (optional)<input name="ref" /></label>
    <button class="btn wa" style="margin-top:16px">Ask for a quote on WhatsApp</button>
  </form>`;
  bindSeg();
  $('#tr').addEventListener('submit', e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const msg = [`Hello ${CONFIG.driverName}, I need a transfer.`, '',
      `- Name: ${p.name}`, `- Mobile: ${p.phone}`, `- Email: ${p.email}`,
      `- From: ${f.from}`, `- To: ${f.to}`, `- Date & time: ${fmtDate(f.date)} at ${f.time}`,
      `- Passengers: ${f.people} · Suitcases: ${f.bags}`, f.ref ? `- Flight/train/ship: ${f.ref}` : '',
    ].filter(Boolean).join('\n');
    const trip = { id: uid('T'), kind: 'transfer', title: `Transfer · ${f.from} → ${f.to}`, date: f.date, time: f.time,
      people: +f.people, pickup: f.from, price: null, status: 'requested', createdAt: Date.now() };
    S.trips.push(trip); save();
    window.open(waLink(msg), '_blank', 'noopener');
    location.hash = '#/trip/' + trip.id;
  });
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
  const isPrivate = t.kind === 'private';
  const secured = ['deposit', 'confirmed'].includes(t.status);
  const idx = t.status === 'cancelled' ? -1 : past ? 2 : secured ? 1 : 0;
  const hasPompeii = tour && /Pompeii/.test(tour.stops.join(' '));
  const passText = `MISTERCAB|${t.id}|${S.profile.name}|${t.date}|${t.people}`;
  const balance = t.price ? t.price - CONFIG.depositAmount : null;

  let actions = '';
  if (!past && t.status === 'requested') {
    actions = isPrivate ? `
      <div class="card"><b>Secure your date</b>
        <p class="small muted" style="margin-top:4px">Once ${esc(CONFIG.driverName)} confirms availability, pay the €${CONFIG.depositAmount} reservation fee.${balance ? ` The balance of ${eur(balance)} is paid in cash on the day.` : ''}</p>
        <a class="btn" style="margin-top:12px" target="_blank" rel="noopener" href="${CONFIG.depositLink || waLink(`Hello ${CONFIG.driverName}, could you send me the link for the €${CONFIG.depositAmount} reservation fee? (${t.title}, ${fmtDate(t.date)}, ${S.profile.name})`)}">Pay €${CONFIG.depositAmount} reservation fee</a>
        <button class="btn ghost" id="paid">I have paid the fee</button>
      </div>` : `
      <div class="card"><b>Waiting for confirmation</b><p class="small muted" style="margin-top:4px">${esc(CONFIG.driverName)} will reply on WhatsApp.</p><button class="btn ghost" id="paid" style="margin-top:12px">Mark as confirmed</button></div>`;
  }
  if (!past && secured) {
    actions = `
      <div class="card pass">
        <div class="small muted" style="letter-spacing:.1em;text-transform:uppercase">Tour pass</div>
        <h3 style="margin:4px 0 12px">${esc(S.profile.name)} · ${t.people} guest${t.people > 1 ? 's' : ''}</h3>
        <div class="qr">${qrImg(passText)}</div>
        <p class="small muted" style="margin-top:10px">Show this to your driver at pick-up.</p>
      </div>
      ${hasPompeii ? `<div class="card"><b>🏛️ Pompeii tickets</b><p class="small muted" style="margin-top:4px">Buy them online about one month before (Pompeii Express, about €26). Want a licensed guide for 2h? €140 — ask ${esc(CONFIG.driverName)}.</p></div>` : ''}
      <button class="btn navy" id="ics">Add to calendar</button>`;
  }
  if (past && t.status !== 'cancelled') {
    actions = `<div class="card"><b>Grazie mille! ❤️</b><p class="small muted" style="margin-top:4px">We hope you enjoyed your day. A short post in your cruise Facebook group helps us a lot: “I booked with Taxi Mister Cab Driver – Naples”.</p></div>
      <a class="btn" href="#/explore">Book your next tour</a>`;
  }

  view.innerHTML = `
  <a class="back" href="#/trips">‹ My Trips</a>
  <h1 class="detail-title">${esc(t.title)}</h1>
  <p class="small muted">${fmtDate(t.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}${t.time ? ' · ' + esc(t.time) : ''}</p>
  <div style="margin-top:8px">${statusChip(t)}</div>
  ${idx >= 0 ? `<div class="steps">${['Request sent', isPrivate ? 'Deposit paid' : 'Confirmed', t.kind === 'transfer' ? 'Done' : 'Tour day'].map((s, i) => `<div class="${i <= idx ? 'done' : ''}">${s}</div>`).join('')}</div>` : ''}
  <div class="card" style="margin-top:14px"><ul class="plain">
    <li><span class="muted">Guests</span><b>${t.people}</b></li>
    <li><span class="muted">Pick-up</span><b style="text-align:right">${esc(t.pickup || '-')}</b></li>
    ${t.ship ? `<li><span class="muted">Ship</span><b>${esc(t.ship)}</b></li>` : ''}
    <li><span class="muted">Total</span><b>${t.price ? eur(t.price) + (t.kind === 'shared' ? '' : ' per vehicle') : 'to be confirmed'}</b></li>
  </ul></div>
  <div style="margin-top:12px">${actions}</div>
  <a class="btn wa" style="margin-top:10px" target="_blank" rel="noopener" href="${waLink(`Hello ${CONFIG.driverName}, about my trip: ${t.title} on ${fmtDate(t.date)} (${S.profile.name}).`)}">💬 Chat with ${esc(CONFIG.driverName)}</a>
  ${!past ? '<button class="btn ghost" id="cancel" style="margin-top:10px">Cancel this request</button>' : ''}`;

  $('#paid')?.addEventListener('click', () => { t.status = isPrivate ? 'deposit' : 'confirmed'; save(); renderTrip(id); toast('Great, your date is secured!'); });
  $('#ics')?.addEventListener('click', () => downloadICS(t));
  $('#cancel')?.addEventListener('click', () => {
    if (!confirm('Cancel this trip in the app? Please also tell your driver on WhatsApp. The €50 reservation fee is non-refundable.')) return;
    t.status = 'cancelled'; save(); renderTrip(id);
  });
}

function downloadICS(t) {
  const d = t.date.replace(/-/g, '');
  const [hh, mm] = (t.time || '08:00').split(':');
  const endH = String(Math.min(23, +hh + (t.kind === 'transfer' ? 1 : 8))).padStart(2, '0');
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Taxi Mister Cab Driver//EN', 'BEGIN:VEVENT',
    `UID:${t.id}@mistercab`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    `DTSTART;TZID=Europe/Rome:${d}T${hh}${mm}00`, `DTEND;TZID=Europe/Rome:${d}T${endH}${mm}00`,
    `SUMMARY:${t.title} – Taxi Mister Cab Driver`, `LOCATION:${(t.pickup || '').replace(/[,;]/g, ' ')}`,
    `DESCRIPTION:Driver WhatsApp ${CONFIG.phoneDisplay}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  a.download = 'mister-cab-trip.ics';
  a.click();
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
    <a href="${waLink('Hello ' + CONFIG.driverName + '!')}" target="_blank" rel="noopener"><span>💬 WhatsApp ${esc(CONFIG.phoneDisplay)}</span><span class="chev">›</span></a>
    <a href="tel:+${CONFIG.whatsapp}"><span>📞 Call us</span><span class="chev">›</span></a>
    <a href="mailto:${CONFIG.email}"><span>✉️ ${esc(CONFIG.email)}</span><span class="chev">›</span></a>
    <a href="${CONFIG.website}" target="_blank" rel="noopener"><span>🌐 taximistercabdriver.com</span><span class="chev">›</span></a>
    <a href="${CONFIG.poolingSite}" target="_blank" rel="noopener"><span>👥 taximrcabpooling.com</span><span class="chev">›</span></a>
  </div>
  <h2 class="sec">More</h2>
  <div class="card rows">
    <button class="rowbtn" id="install"><span>📲 Install the app on your phone</span><span class="chev">›</span></button>
    <button class="rowbtn" id="terms"><span>📄 Terms & Conditions</span><span class="chev">›</span></button>
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
    <p style="margin-top:10px"><b>iPhone (Safari):</b> tap the Share button <span style="font-size:18px">⬆︎</span>, then <b>Add to Home Screen</b>.</p>
    <p style="margin-top:10px"><b>Android (Chrome):</b> tap the menu ⋮, then <b>Install app</b> or <b>Add to Home screen</b>.</p>
    <p class="note">The app opens full screen and keeps your trips and tour pass available offline.</p>`);
}

// ── boot ──────────────────────────────────────────────────────
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
router();
