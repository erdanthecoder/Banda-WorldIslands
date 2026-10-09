// ===== World Islands — settings =====
export const CONFIG = {
  // TeamOlive account server (the LearnKyrgyz Supabase project). The publishable key is safe
  // to ship: every Banda table is protected by row-level security (supabase/migrations).
  supabaseUrl: 'https://lzamxwqxnzcrazyuipjx.supabase.co',
  supabaseKey: 'sb_publishable_zSvDRXqxLlW1tuaoJ06PUw_Tges-7OG',
  // Sign-in hub. It sends people back here already signed in (#oit=…).
  hub: 'https://teamolive.web.app',

  // Game servers (each one is its own world with its own players).
  servers: [
    { id: 's1', name: 'Server 1' }, { id: 's2', name: 'Server 2' },
    { id: 's3', name: 'Server 3' }, { id: 's4', name: 'Server 4' },
  ],
  maxPlayersPerServer: 30,

  starsPerPoint: 30,
};

// Local test mode (no accounts, multiplayer between tabs of one browser):
// open http://localhost:…/?dev=1 (add &teacher=1 for a teacher).
export const DEV = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && new URLSearchParams(location.search).has('dev');
