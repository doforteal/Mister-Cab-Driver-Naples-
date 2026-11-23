/* ============================================================
   Mister Cab Club — configuration
   Everything Ciro may want to change lives in this file.
   ============================================================ */

const CONFIG = {
  brand: 'Taxi Mister Cab Driver',
  club: 'Mister Cab Club',
  website: 'https://www.taximistercabdriver.com',
  poolingSite: 'https://taximrcabpooling.com',
  tourisfied: 'https://www.tourisfied.com',
  whatsapp: '393297556193',            // international format, no "+"
  phoneDisplay: '+39 329 755 6193',
  email: 'mrcabdrivernapoli@gmail.com',
  driverName: 'Ciro',

  // Reservation fee (pre-trip fee). Replace with the real SumUp link.
  depositAmount: 50,
  depositLink: '',                     // e.g. 'https://pay.sumup.com/b2c/XXXXXXX'

  // Live shared tours (same Supabase as taximrcabpooling.com, read-only)
  supabaseUrl: 'https://muulovtjphqfzsjjovan.supabase.co',
  supabaseAnon: 'sb_publishable_WyhLiMQGJvjuFgkZ2OVaOQ_uQjv9D66',
  poolingMaxGroup: 13,                 // same as MAX_GROUP_SIZE on the pooling site

  // Driver PIN used at the end of a tour to mark it completed and award points.
  // PROTOTYPE ONLY: it lives in the browser, so it is not real security.
  // Move members and points to the server (Supabase) before going live.
  staffPin: '2027',

  // ── Loyalty rules (PROPOSAL — adjust freely) ──────────────
  pointsPerEuro: 1,                    // 1 point for every € spent on a tour
  referralBonus: 100,                  // points when a friend books with your code
  reviewBonus: 50,                     // points for a review / Facebook post
  tiers: [
    { id: 'member',   name: 'Member',   minTours: 0, color: '#8a7f70',
      perks: ['Collect points on every tour', 'Member-only offers', 'Direct WhatsApp with your driver'] },
    { id: 'silver',   name: 'Silver',   minTours: 1, color: '#9aa7b4', bonus: 0.10,
      perks: ['+10% bonus points', 'Free bottle of water & limoncello tasting', 'Priority on busy cruise days'] },
    { id: 'gold',     name: 'Gold',     minTours: 3, color: '#c9a14a', bonus: 0.25,
      perks: ['+25% bonus points', 'Free child seat & flexible pick-up time', 'Free 30-min extra stop'] },
    { id: 'platinum', name: 'Platinum', minTours: 6, color: '#cfd8dc', bonus: 0.50,
      perks: ['+50% bonus points', 'Free airport / station transfer once a year', 'Guaranteed date on request (subject to fleet)'] },
  ],

  // "Moments" — rewards redeemed with points
  rewards: [
    { id: 'r-limoncello', points: 150,  title: 'Limoncello tasting',          sub: 'At a family lemon farm in Sorrento', icon: '🍋' },
    { id: 'r-25off',      points: 300,  title: '€25 off your next tour',      sub: 'Valid on any private day tour', icon: '💶' },
    { id: 'r-guide',      points: 600,  title: '2h Pompeii guide',            sub: 'Licensed guide (worth €140)', icon: '🏛️' },
    { id: 'r-transfer',   points: 800,  title: 'Free Naples transfer',        sub: 'Port / station / airport ↔ hotel', icon: '🚖' },
    { id: 'r-winery',     points: 1000, title: 'Vesuvius winery lunch for 2', sub: 'Lunch with wine tasting on the volcano', icon: '🍷' },
  ],
};
