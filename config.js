/* ============================================================
   Mister Cab app — configuration
   Everything Ciro may want to change lives in this file.
   ============================================================ */

const CONFIG = {
  brand: 'Taxi Mister Cab Driver',
  appName: 'Mister Cab',
  website: 'https://www.taximistercabdriver.com',
  poolingSite: 'https://taximrcabpooling.com',
  tourisfied: 'https://www.tourisfied.com',
  whatsapp: '393297556193',            // international format, no "+"
  phoneDisplay: '+39 329 755 6193',
  email: 'mrcabdrivernapoli@gmail.com',
  driverName: 'Ciro',

  // Recommended start time of the private tours (customers may change it; final time is confirmed days before)
  defaultStart: '07:30',

  // Reservation fee (pre-trip fee). The payment link is normally sent by
  // Ciro on WhatsApp. Optional: a fixed SumUp link shown in the app too.
  depositAmount: 50,
  depositLink: '',                     // e.g. 'https://pay.sumup.com/b2c/XXXXXXX'

  // Public key that checks the confirmation links Ciro sends.
  // Create it once in admin.html ("Crea la chiave") and paste it here.
  // Until it is set, bookings stay "Pending" and links cannot be opened.
  confirmPublicKey: {"kty": "EC", "crv": "P-256", "x": "GoN5vh8PQj6Y0s4ZAAxqcfUILkhlkdjd9S5wGhNG8R0", "y": "44GAJrRAynzZtswDe_m48W8igJ8llFmNzYe23JrynwU"},
  appUrl: '',                          // optional: full URL of index.html used in links (default: same site)

  // Live shared tours (same Supabase as taximrcabpooling.com, read-only)
  supabaseUrl: 'https://muulovtjphqfzsjjovan.supabase.co',
  supabaseAnon: 'sb_publishable_WyhLiMQGJvjuFgkZ2OVaOQ_uQjv9D66',
  poolingMaxGroup: 13,                 // same as MAX_GROUP_SIZE on the pooling site
};
