/* ============================================================
   Private Day Tours — 2027 price list (total per vehicle, not per person)
   ============================================================ */

const SCALES = {
  A:   [{ max: 4, price: 500 }, { max: 5, price: 550 }, { max: 6, price: 600 }, { max: 7, price: 650 }, { max: 8, price: 700 }],
  B:   [{ max: 4, price: 400 }, { max: 6, price: 500 }, { max: 8, price: 600 }],
  O8:  [{ max: 4, price: 450 }, { max: 6, price: 500 }, { max: 8, price: 600 }],
  O8b: [{ max: 4, price: 400 }, { max: 6, price: 450 }, { max: 8, price: 500 }],
};

function priceFor(scale, people) {
  const row = SCALES[scale].find(r => people <= r.max);
  return row ? row.price : null;
}

function scaleRows(scale) {
  let from = 1;
  return SCALES[scale].map(r => {
    const label = from === r.max ? `${r.max}` : `${from}–${r.max}`;
    from = r.max + 1;
    return { label, price: r.price };
  });
}

const IMG_COAST = 'img/amalfi-positano-ravello.jpg';
const IMG_POMPEII = 'img/pompei-porta.jpg';

const TOURS = [
  { id: 'opt1', code: 'Opt 1', title: 'Sorrento & Pompeii', tag: 'Pizza or winery', scale: 'A', img: IMG_POMPEII, hue: 18,
    stops: ['Sorrento — free time in the old town', 'Pompeii archaeological site (about 2h)', 'Neapolitan pizza or Vesuvius winery lunch'],
    excluded: ['Food', 'Winery lunch €50 pp', 'Pompeii tickets €20', 'Guide €140 / 2h'] },
  { id: 'opt2', code: 'Opt 2', title: 'Amalfi Coast Highlights', tag: 'Most popular', scale: 'A', img: IMG_COAST, hue: 200,
    stops: ['Ravello (or via Vietri + Minori)', 'Amalfi town', 'Positano viewpoint', 'Sorrento — free time / lunch'],
    excluded: ['Food & drinks'], note: 'Also from Salerno, Sorrento, Positano and Amalfi.' },
  { id: 'opt2b', code: 'Opt 2 Bis', title: 'Ravello & Amalfi + Lunch', tag: 'Off the beaten path', scale: 'A', img: IMG_COAST, hue: 150,
    stops: ['Ravello & Amalfi by land', 'Lunch A: mountain rustic (Conca dei Marini / Monti Lattari)', 'or Lunch B: secluded beach with boat ride and swim'],
    excluded: ['Food & drinks'] },
  { id: 'opt3', code: 'Opt 3', title: 'Positano, Sorrento & Pompeii', tag: 'Coast + history', scale: 'A', img: IMG_COAST, hue: 30,
    stops: ['Positano downtown', 'Sorrento', 'Pompeii archaeological site'],
    excluded: ['Food', 'Pompeii tickets €20', 'Guide €140 / 2h', 'Winery lunch €50 pp'] },
  { id: 'opt3b', code: 'Opt 3 Bis', title: 'Positano, Sorrento & Winery', tag: 'Food lovers', scale: 'A', img: IMG_COAST, hue: 330,
    stops: ['Positano', 'Sorrento', 'Vesuvius winery lunch'],
    excluded: ['Winery lunch €50 pp'] },
  { id: 'opt4', code: 'Opt 4', title: 'Ravello, Amalfi & Positano', tag: 'Full coast', scale: 'A', img: IMG_COAST, hue: 210,
    stops: ['Ravello — Villa Rufolo (or via Vietri + Minori)', 'Amalfi — Duomo di Sant’Andrea', 'Positano'],
    excluded: ['Food & drinks'] },
  { id: 'opt5', code: 'Opt 5', title: 'Ravello, Amalfi & Pompeii', tag: 'Coast + history', scale: 'A', img: IMG_COAST, hue: 260,
    stops: ['Ravello', 'Amalfi', 'Pompeii archaeological site'],
    excluded: ['Food', 'Pompeii tickets €20', 'Guide €140 / 2h', 'Winery lunch €45 pp'] },
  { id: 'opt6', code: 'Opt 6', title: 'Vesuvius, Winery & Pompeii', tag: 'Volcano day', scale: 'B', img: IMG_POMPEII, hue: 10,
    stops: ['Mount Vesuvius crater', 'Winery lunch on the volcano', 'Pompeii or Herculaneum'],
    excluded: ['Site tickets €20', 'Crater €12', 'Winery lunch €50 pp', 'Guide €140 / 2h'] },
  { id: 'opt7', code: 'Opt 7', title: 'Pompeii & Herculaneum', tag: 'Ancient Rome', scale: 'B', img: IMG_POMPEII, hue: 40,
    stops: ['Pompeii', 'Herculaneum', 'Pizza or winery lunch'],
    excluded: ['Tickets €20', 'Winery lunch €50 pp', 'Guide €140 / 2h'] },
  { id: 'opt8', code: 'Opt 8', title: 'Royal Palace of Caserta & Pompeii', tag: 'Royal day', scale: 'O8', img: IMG_POMPEII, hue: 280,
    stops: ['Royal Palace of Caserta', 'Winery or lunch break', 'Pompeii'],
    excluded: ['Food', 'Tickets', 'Guide'] },
  { id: 'opt8b', code: 'Opt 8 Bis', title: 'Caserta & Casertavecchia', tag: 'Slow day', scale: 'O8b', img: IMG_POMPEII, hue: 100,
    stops: ['Royal Palace of Caserta', 'Medieval Casertavecchia', 'Trattoria lunch'],
    excluded: ['Food', 'Palace tickets', 'Guide'] },
];

const TERMS = [
  ['Reservation fee', 'To secure your date, a non-refundable reservation fee of €50 is required at the time of booking. Once everything is confirmed, we send you the payment link.'],
  ['Final payment', 'The balance is due on the day of the tour and is paid in cash (euros) directly to the driver.'],
  ['Meeting time', 'The recommended start time is 7:30 am. It can be changed, but we suggest doing so only if your ship arrives later. The final meeting time is confirmed a few days before the tour.'],
  ['General conditions', 'We reserve the right to adjust the itinerary in case of unforeseen circumstances. Timings are indicative: tours usually last about 8 hours and are planned around your ship’s schedule. Food, entrance tickets and guided tours are not included unless stated. Guests are responsible for their own travel documents. We are not liable for loss, damage or theft of personal belongings, or for injuries or accidents during the tour.'],
];
