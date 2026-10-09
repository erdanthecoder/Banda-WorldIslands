// Sign-in through Recoon (recoon.web.app). The hub hands the Supabase session over
// in the URL fragment (#oit=…); we store it and remove it from the address bar.
import { CONFIG, DEV } from './config.js';

let client = null;
export function sb() {
  if (!client) client = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'banda-auth' },
    realtime: { params: { eventsPerSecond: 20 } },
  });
  return client;
}

const unb64 = s => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));
const CHECKED = 'banda_sso_checked';

function returnUrl() { return location.origin + location.pathname; }

async function acceptHandoff() {
  const m = location.hash.match(/(?:^#|&)oit=([A-Za-z0-9_-]+)/);
  if (!m) return false;
  history.replaceState(null, '', location.pathname + location.search);
  if (m[1] === 'none') return false;
  try {
    const { at, rt } = JSON.parse(unb64(m[1]));
    const { error } = await sb().auth.setSession({ access_token: at, refresh_token: rt });
    return !error;
  } catch (e) { return false; }
}

// Returns { user, profile } when signed in, or null. May redirect once to the hub for a silent check.
export async function currentAccount() {
  if (DEV) return devAccount();
  const handed = await acceptHandoff();
  if (/(?:^#|&)oit=none/.test(location.hash) || handed) sessionStorage.setItem(CHECKED, '1');
  const { data } = await sb().auth.getSession();
  const session = data.session;
  if (!session) {
    if (!sessionStorage.getItem(CHECKED)) {
      sessionStorage.setItem(CHECKED, '1');
      location.replace(`${CONFIG.hub}/?return=${encodeURIComponent(returnUrl())}&silent=1`);
      return new Promise(() => {}); // navigating away
    }
    return null;
  }
  const user = session.user;
  const { data: profile } = await sb().from('profiles').select('role, full_name, avatar_color, learn_from').eq('id', user.id).maybeSingle();
  return { user, profile: profile || { role: 'student', full_name: user.email?.split('@')[0] || 'Player' } };
}

export function signInWithHub(asTeacher) {
  sessionStorage.removeItem(CHECKED);
  location.href = `${CONFIG.hub}/?return=${encodeURIComponent(returnUrl())}${asTeacher ? '&as=teacher' : ''}`;
}

export async function signOut() {
  sessionStorage.removeItem(CHECKED);
  if (DEV) { sessionStorage.removeItem('banda_dev'); return; }
  try { await sb().auth.signOut(); } catch (e) {}
}

function devAccount() {
  const q = new URLSearchParams(location.search);
  let d = null; try { d = JSON.parse(sessionStorage.getItem('banda_dev')); } catch (e) {}
  if (!d) { d = { id: 'dev-' + Math.random().toString(36).slice(2, 8) }; sessionStorage.setItem('banda_dev', JSON.stringify(d)); }
  return { user: { id: d.id, email: '' }, profile: { role: q.has('teacher') || location.hash === '#teacher' ? 'teacher' : 'student', full_name: q.get('name') || '' } };
}
