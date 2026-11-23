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

  // Reservation fee (pre-trip fee). Replace with the real SumUp link.
  depositAmount: 50,
  depositLink: '',                     // e.g. 'https://pay.sumup.com/b2c/XXXXXXX'

  // Live shared tours (same Supabase as taximrcabpooling.com, read-only)
  supabaseUrl: 'https://muulovtjphqfzsjjovan.supabase.co',
  supabaseAnon: 'sb_publishable_WyhLiMQGJvjuFgkZ2OVaOQ_uQjv9D66',
  poolingMaxGroup: 13,                 // same as MAX_GROUP_SIZE on the pooling site
};
