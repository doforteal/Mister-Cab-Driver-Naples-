/* ============================================================
   Mister Cab Club — app logic (single-page, hash routing)
   Member data is stored on this device (localStorage).
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
const isPast = d => d && d < todayISO();
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
let S = load() || { profile: null, trips: [], ledger: [], redeemed: [] };
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch { toast('Could not save on this device'); }
}

const points = () => S.ledger.reduce((a, l) => a + l.points, 0);
const completedTours = () => S.trips.filter(t => t.status === 'completed' && t.kind !== 'transfer').length;
function tierInfo() {
  const n = completedTours();
  const tiers = CONFIG.tiers;
  let i = 0;
  tiers.forEach((t, k) => { if (n >= t.minTours) i = k; });
  const cur = tiers[i], next = tiers[i + 1];
  const pct = next ? Math.round(((n - cur.minTours) / (next.minTours - cur.minTours)) * 100) : 100;
  return { cur, next, n, pct, toNext: next ? next.minTours - n : 0 };
}
const tourById = id => TOURS.find(t => t.id === id);

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
  rewards: renderRewards,
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
  const ref = new URLSearchParams(location.search).get('ref') || '';
  view.innerHTML = `
  <section class="welcome">
    <img class="logo" src="icons/logo.png" alt="" />
    <h1>Welcome to the<br>${esc(CONFIG.club)}</h1>
    <p>The app of ${esc(CONFIG.brand)}, Naples. Book private and shared tours, keep every trip in your pocket and earn rewards each time you ride with us.</p>
    <ul class="ticks" style="margin-top:16px">
      <li>Private day tours from the Port of Naples</li>
      <li>Shared tours: join a group and pay less</li>
      <li>Your tour pass, chat with your driver, deposit link</li>
      <li>Points, member tiers and free experiences</li>
    </ul>
    <form class="card" id="join">
      <label class="f">Full name<input name="name" required autocomplete="name" /></label>
      <label class="f">Email<input name="email" type="email" required autocomplete="email" /></label>
      <label class="f">Mobile / WhatsApp<input name="phone" type="tel" required autocomplete="tel" placeholder="+1 555 123 4567" /></label>
      <label class="f">Invited by a friend? Code (optional)<input name="ref" value="${esc(ref)}" autocapitalize="characters" /></label>
      <button class="btn" style="margin-top:18px">Join the club — it’s free</button>
      <p class="fine">Your details stay on this phone and are only sent to us when you book.</p>
    </form>
  </section>`;
  $('#join').addEventListener('submit', e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const first = f.name.trim().split(/\s+/)[0].replace(/[^a-z]/gi, '').toUpperCase().slice(0, 5) || 'GUEST';
    S.profile = {
      name: f.name.trim(), email: f.email.trim(), phone: f.phone.trim(),
      referredBy: f.ref.trim().toUpperCase(),
      memberId: 'MC' + String(Math.floor(100000 + Math.random() * 900000)),
      refCode: first + Math.floor(10 + Math.random() * 90),
      joined: todayISO(),
    };
    S.ledger.push({ date: todayISO(), desc: 'Welcome bonus', points: 50 });
    save();
    location.hash = '#/home';
    router();
    toast('Welcome! 50 points added 🎉');
  });
}

// ── member card ───────────────────────────────────────────────
function memberCard() {
  const t = tierInfo();
  return `
  <a class="mcard" href="#/rewards" style="display:block">
    <div class="row">
      <div><div class="club">${esc(CONFIG.club)}</div><div class="name">${esc(S.profile.name)}</div></div>
      <span class="tier-pill" style="background:${t.cur.color}">★ ${esc(t.cur.name)}</span>
    </div>
    <div class="pts"><b>${points().toLocaleString('en-US')}</b><span>points</span></div>
    <div class="bar"><i style="width:${t.pct}%"></i></div>
    <div class="next">${t.next ? `${t.toNext} more tour${t.toNext > 1 ? 's' : ''} to reach <b>${esc(t.next.name)}</b>` : 'You reached our highest tier. Grazie!'}</div>
    <div class="mid">MEMBER ${esc(S.profile.memberId)}</div>
  </a>`;
}

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
  return S.trips.filter(t => !['completed', 'cancelled'].includes(t.status)).sort((a, b) => a.date.localeCompare(b.date));
}

function tripRow(t) {
  const d = parseDate(t.date);
  const st = statusChip(t);
  return `
  <a class="card trip" href="#/trip/${t.id}" style="display:flex">
    <div class="date"><b>${d.getDate()}</b><span>${d.toLocaleDateString('en-GB', { month: 'short' })}</span></div>
    <div class="info"><h3>${esc(t.title)}</h3><div class="small muted">${esc(t.people)} guest${t.people > 1 ? 's' : ''} · ${esc(t.pickup || '')}</div><div style="margin-top:6px">${st}</div></div>
    <span class="chev muted">›</span>
  </a>`;
}

function statusChip(t) {
  return {
    requested: '<span class="chip">Request sent</span>',
    deposit: '<span class="chip navy">Deposit paid</span>',
    confirmed: '<span class="chip ok">Confirmed</span>',
    completed: '<span class="chip ok">Completed</span>',
    cancelled: '<span class="chip grey">Cancelled</span>',
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
    <a class="icon-btn" href="${waLink(`Hello ${CONFIG.driverName}, I am ${S.profile.name} (member ${S.profile.memberId}).`)}" target="_blank" rel="noopener" aria-label="WhatsApp">💬</a>
  </header>
  ${memberCard()}
  <div class="quick">
    <a href="#/explore"><span class="qi">🚐</span>Private tour</a>
    <a href="#/explore/shared"><span class="qi">👥</span>Shared tour</a>
    <a href="#/transfer"><span class="qi">🚖</span>Transfer</a>
    <a href="#/rewards"><span class="qi">🎁</span>Rewards</a>
  </div>
  ${next ? `<h2 class="sec">Your next trip <a href="#/trips">All trips</a></h2>${tripRow(next)}` : `
  <h2 class="sec">Plan your day in Naples</h2>
  <div class="card"><b>Arriving by cruise ship?</b><p class="small muted" style="margin-top:4px">We pick you up at the port as soon as you disembark and bring you back with plenty of time before all aboard.</p>
  <a class="btn navy" href="#/explore" style="margin-top:12px">Find your tour</a></div>`}
  <h2 class="sec">Private day tours <a href="#/explore">See all</a></h2>
  <div class="scroller">${featured.map(t => tourCard(t)).join('')}</div>
  <h2 class="sec">Moments</h2>
  <div class="scroller">${CONFIG.rewards.slice(0, 4).map(r => `
    <a class="tcard" href="#/rewards" style="flex-basis:46%"><div class="bd"><div style="font-size:30px">${r.icon}</div><h3 style="margin-top:6px">${esc(r.title)}</h3><div class="from"><b>${r.points}</b> pts</div></div></a>`).join('')}
  </div>
  <h2 class="sec">Other ports in Italy?</h2>
  <a class="card" href="${CONFIG.tourisfied}" target="_blank" rel="noopener" style="display:block"><b>TOURISFIED network</b><p class="small muted" style="margin-top:4px">Trusted local drivers in other cruise ports. Tap to discover.</p></a>`;
}

// ── EXPLORE ───────────────────────────────────────────────────
let sharedCache = null;

function renderExplore(tab = 'private') {
  view.innerHTML = `
  <header class="top"><div><h1>Explore</h1><div class="sub">Tours & transfers from Naples</div></div></header>
  <div class="seg">
    <button data-t="private" class="${tab === 'private' ? 'on' : ''}">Private</button>
    <button data-t="shared" class="${tab === 'shared' ? 'on' : ''}">Shared</button>
    <button data-t="transfer">Transfers</button>
  </div>
  <div id="ex"></div>`;
  view.querySelectorAll('.seg button').forEach(b => b.addEventListener('click', () => {
    location.hash = b.dataset.t === 'transfer' ? '#/transfer' : `#/explore/${b.dataset.t}`;
  }));
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
  const p = new URLSearchParams({ ...params, ref: S.profile.refCode });
  return `${CONFIG.poolingSite}/?${p}#groups`;
}

async function renderShared(el) {
  el.innerHTML = `<p class="small muted" style="margin-bottom:14px">Join a group of travellers and share the van: you pay per person. Live groups from <b>taximrcabpooling.com</b>.</p><div class="card empty"><div class="big">⏳</div><p class="muted">Loading open groups…</p></div>`;
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
    el.innerHTML = `<p class="small muted" style="margin-bottom:14px">Join a group of travellers and share the van: you pay per person. Live groups from <b>taximrcabpooling.com</b>.</p>
      ${cards || '<div class="card empty"><div class="big">🗓️</div><p class="muted">No open groups right now. Start one below!</p></div>'}
      <h2 class="sec">Start a new group</h2>
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
  const minDate = todayISO();
  view.innerHTML = `
  <a class="back" href="#/tour/${t.id}">‹ ${esc(t.code)}</a>
  <h1 class="detail-title">Request ${esc(t.title)}</h1>
  <p class="small muted">We check availability and reply on WhatsApp. Nothing is charged now.</p>
  <form id="bk">
    <div class="f2">
      <label class="f">Date<input name="date" type="date" min="${minDate}" required /></label>
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
    $('#season').innerHTML = coast && (m >= 10 || m <= 2) && m !== -1
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
      `- Member: ${S.profile.memberId}${S.profile.referredBy ? ' · referred by ' + S.profile.referredBy : ''}`,
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
  view.innerHTML = `
  <header class="top"><div><h1>Explore</h1><div class="sub">Tours & transfers from Naples</div></div></header>
  <div class="seg"><button data-t="private">Private</button><button data-t="shared">Shared</button><button class="on">Transfers</button></div>
  <p class="small muted" style="margin-bottom:6px">Port, airport, station, hotel, Amalfi Coast, Sorrento, Rome… Tell us where and when: we reply with the fare.</p>
  <form id="tr">
    <label class="f">From<input name="from" required placeholder="e.g. Naples Airport" /></label>
    <label class="f">To<input name="to" required placeholder="e.g. Hotel in Positano" /></label>
    <div class="f2"><label class="f">Date<input name="date" type="date" min="${todayISO()}" required /></label><label class="f">Time<input name="time" type="time" required /></label></div>
    <div class="f2"><label class="f">Passengers<input name="people" type="number" min="1" max="16" value="2" required /></label><label class="f">Suitcases<input name="bags" type="number" min="0" max="30" value="2" /></label></div>
    <label class="f">Flight / train / ship (optional)<input name="ref" /></label>
    <button class="btn wa" style="margin-top:16px">Ask for a quote on WhatsApp</button>
  </form>`;
  view.querySelectorAll('.seg button[data-t]').forEach(b => b.addEventListener('click', () => location.hash = `#/explore/${b.dataset.t}`));
  $('#tr').addEventListener('submit', e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const msg = [`Hello ${CONFIG.driverName}, I need a transfer.`, '',
      `- Name: ${p.name}`, `- Mobile: ${p.phone}`, `- Email: ${p.email}`,
      `- From: ${f.from}`, `- To: ${f.to}`, `- Date & time: ${fmtDate(f.date)} at ${f.time}`,
      `- Passengers: ${f.people} · Suitcases: ${f.bags}`, f.ref ? `- Flight/train/ship: ${f.ref}` : '',
      `- Member: ${p.memberId}`].filter(Boolean).join('\n');
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
  const past = S.trips.filter(t => ['completed', 'cancelled'].includes(t.status)).sort((a, b) => b.date.localeCompare(a.date));
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
  const order = ['requested', 'deposit', 'completed'];
  const idx = t.status === 'cancelled' ? -1 : order.indexOf(t.status === 'confirmed' ? 'deposit' : t.status);
  const isTour = t.kind !== 'transfer';
  const hasPompeii = tour && /Pompeii/.test(tour.stops.join(' '));
  const passText = `MCC|${S.profile.memberId}|${t.id}|${t.date}|${t.people}`;
  const balance = t.price ? t.price - CONFIG.depositAmount : null;

  let actions = '';
  if (t.status === 'requested') {
    actions = isTour && t.kind === 'private' ? `
      <div class="card"><b>Secure your date</b>
        <p class="small muted" style="margin-top:4px">Once ${esc(CONFIG.driverName)} confirms availability, pay the €${CONFIG.depositAmount} reservation fee.${balance ? ` The balance of ${eur(balance)} is paid in cash on the day.` : ''}</p>
        <a class="btn" style="margin-top:12px" target="_blank" rel="noopener" href="${CONFIG.depositLink || waLink(`Hello ${CONFIG.driverName}, could you send me the link for the €${CONFIG.depositAmount} reservation fee? (${t.title}, ${fmtDate(t.date)}, member ${S.profile.memberId})`)}">Pay €${CONFIG.depositAmount} reservation fee</a>
        <button class="btn ghost" id="paid">I have paid the fee</button>
      </div>` : `
      <div class="card"><b>Waiting for confirmation</b><p class="small muted" style="margin-top:4px">${esc(CONFIG.driverName)} will reply on WhatsApp.</p><button class="btn ghost" id="paid" style="margin-top:12px">Mark as confirmed</button></div>`;
  }
  if (['deposit', 'confirmed'].includes(t.status)) {
    actions = `
      <div class="card pass">
        <div class="small muted" style="letter-spacing:.1em;text-transform:uppercase">Tour pass</div>
        <h3 style="margin:4px 0 12px">${esc(S.profile.name)} · ${t.people} guest${t.people > 1 ? 's' : ''}</h3>
        <div class="qr">${qrImg(passText)}</div>
        <p class="small muted" style="margin-top:10px">Show this to your driver at pick-up.</p>
      </div>
      ${hasPompeii ? `<div class="card"><b>🏛️ Pompeii tickets</b><p class="small muted" style="margin-top:4px">Buy them online about one month before (Pompeii Express, about €26). Want a licensed guide for 2h? €140 — ask ${esc(CONFIG.driverName)}.</p></div>` : ''}
      <button class="btn navy" id="ics">Add to calendar</button>
      <button class="btn ghost" id="done">Driver: complete tour & add points</button>`;
  }
  if (t.status === 'completed') {
    actions = `<div class="card"><b>Grazie mille! ❤️</b><p class="small muted" style="margin-top:4px">You earned <b>${t.earned || 0} points</b> with this trip. A short post in your cruise Facebook group helps us a lot: “I booked with Taxi Mister Cab Driver – Naples”.</p></div>
      <a class="btn" href="#/explore">Book your next tour</a>`;
  }

  view.innerHTML = `
  <a class="back" href="#/trips">‹ My Trips</a>
  <h1 class="detail-title">${esc(t.title)}</h1>
  <p class="small muted">${fmtDate(t.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}${t.time ? ' · ' + esc(t.time) : ''}</p>
  <div style="margin-top:8px">${statusChip(t)}</div>
  ${idx >= 0 ? `<div class="steps">${['Request sent', isTour && t.kind === 'private' ? 'Deposit paid' : 'Confirmed', 'Completed'].map((s, i) => `<div class="${i <= idx ? 'done' : ''}">${s}</div>`).join('')}</div>` : ''}
  <div class="card" style="margin-top:14px"><ul class="plain">
    <li><span class="muted">Guests</span><b>${t.people}</b></li>
    <li><span class="muted">Pick-up</span><b style="text-align:right">${esc(t.pickup || '-')}</b></li>
    ${t.ship ? `<li><span class="muted">Ship</span><b>${esc(t.ship)}</b></li>` : ''}
    <li><span class="muted">Total</span><b>${t.price ? eur(t.price) + (t.kind === 'shared' ? '' : ' per vehicle') : 'to be confirmed'}</b></li>
  </ul></div>
  <div style="margin-top:12px">${actions}</div>
  <a class="btn wa" style="margin-top:10px" target="_blank" rel="noopener" href="${waLink(`Hello ${CONFIG.driverName}, about my trip: ${t.title} on ${fmtDate(t.date)} (member ${S.profile.memberId}).`)}">💬 Chat with ${esc(CONFIG.driverName)}</a>
  ${['requested', 'deposit', 'confirmed'].includes(t.status) ? '<button class="btn ghost" id="cancel" style="margin-top:10px">Cancel this request</button>' : ''}`;

  $('#paid')?.addEventListener('click', () => { t.status = t.kind === 'private' ? 'deposit' : 'confirmed'; save(); renderTrip(id); toast('Great, your date is secured!'); });
  $('#ics')?.addEventListener('click', () => downloadICS(t));
  $('#done')?.addEventListener('click', () => completeTrip(t));
  $('#cancel')?.addEventListener('click', () => {
    if (!confirm('Cancel this trip in the app? Please also tell your driver on WhatsApp. The €50 reservation fee is non-refundable.')) return;
    t.status = 'cancelled'; save(); renderTrip(id);
  });
}

function completeTrip(t) {
  openSheet(`
    <h2>Complete tour</h2>
    <p class="small muted">For the driver: enter the staff PIN to close the tour and credit the points.</p>
    <form id="pin">
      <label class="f">Final amount paid (€)<input name="amount" type="number" min="0" step="1" value="${t.price || ''}" required /></label>
      <label class="f">Staff PIN<input name="pin" type="password" inputmode="numeric" required /></label>
      <button class="btn" style="margin-top:16px">Complete & add points</button>
    </form>`);
  $('#pin').addEventListener('submit', e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    if (f.pin !== CONFIG.staffPin) { toast('Wrong PIN'); return; }
    const tier = tierInfo().cur;
    const earned = Math.round(+f.amount * CONFIG.pointsPerEuro * (1 + (tier.bonus || 0)));
    t.status = 'completed'; t.price = +f.amount; t.earned = earned;
    S.ledger.push({ date: todayISO(), desc: t.title, points: earned });
    const before = tier.name;
    save(); closeSheet(); renderTrip(t.id);
    const after = tierInfo().cur.name;
    toast(after !== before ? `+${earned} points · Welcome to ${after}! ⭐` : `+${earned} points added`);
  });
}

function downloadICS(t) {
  const d = t.date.replace(/-/g, '');
  const [hh, mm] = (t.time || '08:00').split(':');
  const endH = String(Math.min(23, +hh + (t.kind === 'transfer' ? 1 : 8))).padStart(2, '0');
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Mister Cab Club//EN', 'BEGIN:VEVENT',
    `UID:${t.id}@mistercab`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    `DTSTART;TZID=Europe/Rome:${d}T${hh}${mm}00`, `DTEND;TZID=Europe/Rome:${d}T${endH}${mm}00`,
    `SUMMARY:${t.title} – Taxi Mister Cab Driver`, `LOCATION:${(t.pickup || '').replace(/[,;]/g, ' ')}`,
    `DESCRIPTION:Driver WhatsApp ${CONFIG.phoneDisplay}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  a.download = 'mister-cab-trip.ics';
  a.click();
}

// ── REWARDS ───────────────────────────────────────────────────
function renderRewards() {
  const t = tierInfo();
  const pts = points();
  const shareText = `Join me on the Mister Cab Club for tours in Naples & the Amalfi Coast! Use my code ${S.profile.refCode}: ${location.origin}${location.pathname}?ref=${S.profile.refCode}`;
  view.innerHTML = `
  <header class="top"><div><h1>Rewards</h1><div class="sub">${esc(CONFIG.club)}</div></div></header>
  ${memberCard()}
  <h2 class="sec">Member tiers</h2>
  <div class="tiers">${CONFIG.tiers.map(x => `<div class="${x.id === t.cur.id ? 'on' : ''}"><i style="background:${x.color}"></i><b>${esc(x.name)}</b><div class="muted">${x.minTours ? x.minTours + '+ tours' : 'Join'}</div></div>`).join('')}</div>
  <div class="card" style="margin-top:12px"><b>Your ${esc(t.cur.name)} benefits</b><ul class="ticks" style="margin-top:6px">${t.cur.perks.map(p => `<li>${esc(p)}</li>`).join('')}</ul>
  ${t.next ? `<p class="small muted" style="margin-top:8px">Next: <b>${esc(t.next.name)}</b> — ${t.next.perks.map(esc).join(' · ')}</p>` : ''}</div>
  <h2 class="sec">Moments — use your points</h2>
  ${CONFIG.rewards.map(r => `
    <div class="card reward"><div class="ri">${r.icon}</div><div class="rb"><b>${esc(r.title)}</b><div class="small muted">${esc(r.sub)}</div><div class="small"><b>${r.points}</b> pts</div></div>
    <button data-r="${r.id}" ${pts < r.points ? 'disabled' : ''}>${pts < r.points ? `${r.points - pts} to go` : 'Redeem'}</button></div>`).join('')}
  ${S.redeemed.length ? `<h2 class="sec">My vouchers</h2>${S.redeemed.slice().reverse().map(v => `<div class="card"><b>${esc(v.title)}</b><div class="small muted">${fmtDate(v.date)} · show this code to your driver</div><div class="code-box">${esc(v.code)}</div></div>`).join('')}` : ''}
  <h2 class="sec">Invite friends</h2>
  <div class="card"><p class="small">Share your code: when a friend books a tour, you get <b>${CONFIG.referralBonus} points</b> (credited by your driver).</p>
    <div class="code-box">${esc(S.profile.refCode)}</div>
    <div class="btns2"><button class="btn navy" id="share">Share</button><a class="btn wa" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(shareText)}">WhatsApp</a></div></div>
  <h2 class="sec">Points history</h2>
  <div class="card"><ul class="ledger">${S.ledger.slice().reverse().map(l => `<li><span>${esc(l.desc)}<br><span class="small muted">${fmtDate(l.date)}</span></span><span class="${l.points >= 0 ? 'plus' : 'minus'}">${l.points >= 0 ? '+' : ''}${l.points}</span></li>`).join('') || '<li class="muted">No points yet</li>'}</ul></div>
  <p class="note">1 point for every €1 spent on tours. Tier bonus applies on top. Points have no cash value.</p>`;

  view.querySelectorAll('[data-r]').forEach(b => b.addEventListener('click', () => redeem(b.dataset.r)));
  $('#share').addEventListener('click', async () => {
    if (navigator.share) { try { await navigator.share({ title: CONFIG.club, text: shareText }); } catch { /* cancelled */ } }
    else { try { await navigator.clipboard.writeText(shareText); toast('Invite copied'); } catch { toast(shareText); } }
  });
}

function redeem(rid) {
  const r = CONFIG.rewards.find(x => x.id === rid);
  if (!r || points() < r.points) return;
  openSheet(`<h2>${r.icon} ${esc(r.title)}</h2><p class="small muted">${esc(r.sub)}</p>
    <p style="margin-top:14px">Use <b>${r.points} points</b> for this reward? You will get a voucher code to show your driver.</p>
    <button class="btn" id="ok" style="margin-top:16px">Redeem ${r.points} points</button>`);
  $('#ok').addEventListener('click', () => {
    const code = 'MC-' + uid().slice(0, 6);
    S.ledger.push({ date: todayISO(), desc: 'Redeemed: ' + r.title, points: -r.points });
    S.redeemed.push({ id: r.id, title: r.title, code, date: todayISO() });
    save(); closeSheet(); renderRewards(); toast('Voucher ' + code + ' ready');
  });
}

// ── ACCOUNT ───────────────────────────────────────────────────
function renderAccount() {
  const p = S.profile;
  view.innerHTML = `
  <header class="top"><div><h1>Account</h1><div class="sub">Member since ${fmtDate(p.joined, { month: 'long', year: 'numeric' })}</div></div></header>
  <div class="card pass"><div class="small muted" style="letter-spacing:.1em;text-transform:uppercase">Member card</div>
    <h3 style="margin:4px 0 12px">${esc(p.name)}</h3><div class="qr">${qrImg('MCC|' + p.memberId)}</div><div class="code-box" style="font-size:16px">${esc(p.memberId)}</div></div>
  <h2 class="sec">Profile</h2>
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
    <button class="rowbtn" id="staff"><span>🔑 Driver tools</span><span class="chev">›</span></button>
    <button class="rowbtn" id="reset"><span style="color:var(--terra)">Sign out & delete data on this phone</span><span class="chev">›</span></button>
  </div>
  <p class="note" style="text-align:center;margin-top:20px">${esc(CONFIG.brand)} · Naples, Italy</p>`;

  $('#prof').addEventListener('submit', e => {
    e.preventDefault();
    Object.assign(S.profile, Object.fromEntries(new FormData(e.target)));
    save(); toast('Profile saved');
  });
  $('#terms').addEventListener('click', showTerms);
  $('#install').addEventListener('click', showInstall);
  $('#staff').addEventListener('click', staffTools);
  $('#reset').addEventListener('click', () => {
    if (!confirm('Delete your member card, trips and points from this phone?')) return;
    localStorage.removeItem(STORE_KEY);
    S = { profile: null, trips: [], ledger: [], redeemed: [] };
    location.hash = '';
    router();
  });
}

function staffTools() {
  openSheet(`<h2>Driver tools</h2><p class="small muted">Credit bonus points (referral, review, goodwill). Staff PIN required.</p>
    <form id="bonus">
      <label class="f">Reason<select name="desc"><option>Friend referral bonus</option><option>Thank you for your review</option><option>Goodwill bonus</option></select></label>
      <label class="f">Points<input name="points" type="number" value="${CONFIG.referralBonus}" min="1" max="5000" required /></label>
      <label class="f">Staff PIN<input name="pin" type="password" inputmode="numeric" required /></label>
      <button class="btn" style="margin-top:16px">Add points</button>
    </form>`);
  $('#bonus').addEventListener('submit', e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    if (f.pin !== CONFIG.staffPin) { toast('Wrong PIN'); return; }
    S.ledger.push({ date: todayISO(), desc: f.desc, points: +f.points });
    save(); closeSheet(); toast(`+${f.points} points added`);
  });
}

let deferredInstall = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; });
function showInstall() {
  if (deferredInstall) { deferredInstall.prompt(); deferredInstall = null; return; }
  openSheet(`<h2>Install the app</h2>
    <p style="margin-top:10px"><b>iPhone (Safari):</b> tap the Share button <span style="font-size:18px">⬆︎</span>, then <b>Add to Home Screen</b>.</p>
    <p style="margin-top:10px"><b>Android (Chrome):</b> tap the menu ⋮, then <b>Install app</b> or <b>Add to Home screen</b>.</p>
    <p class="note">The app opens full screen, works offline for your trips and member card.</p>`);
}

// ── boot ──────────────────────────────────────────────────────
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
router();
