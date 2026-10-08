// Sign-in with the school's Google Workspace (Google Identity Services) — no Firebase Auth.
import { CONFIG } from './config.js';

const KEY = 'banda_session';

function decodeJwt(tok) {
  const b = tok.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(decodeURIComponent(atob(b).split('').map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join('')));
}

export async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export function savedSession() {
  try { return JSON.parse(sessionStorage.getItem(KEY) || localStorage.getItem(KEY)); } catch (e) { return null; }
}
export function saveSession(s) {
  try { sessionStorage.setItem(KEY, JSON.stringify(s)); localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
}
export function logout() { try { sessionStorage.removeItem(KEY); localStorage.removeItem(KEY); } catch (e) {} if (window.google?.accounts?.id) google.accounts.id.disableAutoSelect(); }

// Renders Google button into `el`; resolves with a user object or rejects with an error code.
export function googleSignIn(el, onUser, onError) {
  if (!CONFIG.googleClientId) { el.style.display = 'none'; return false; }
  const s = document.createElement('script');
  s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
  s.onload = () => {
    google.accounts.id.initialize({
      client_id: CONFIG.googleClientId,
      hd: CONFIG.workspaceDomain || undefined,
      callback: r => {
        const p = decodeJwt(r.credential);
        if (CONFIG.workspaceDomain && p.hd !== CONFIG.workspaceDomain) return onError('wrongDomain');
        onUser({ uid: 'g_' + p.sub, name: p.given_name || p.name || p.email.split('@')[0], email: (p.email || '').toLowerCase(), picture: p.picture, provider: 'google' });
      },
    });
    google.accounts.id.renderButton(el, { theme: 'filled_blue', size: 'large', shape: 'pill', text: 'continue_with' });
  };
  s.onerror = () => onError('googleUnavailable');
  document.head.appendChild(s);
  return true;
}

export function guestUser(name) {
  const clean = name.replace(/[<>]/g, '').trim().slice(0, 16);
  const slug = clean.toLowerCase().replace(/\s+/g, '_').replace(/[^\p{L}\p{N}_]/gu, '') || Math.random().toString(36).slice(2, 8);
  return { uid: 'n_' + slug, name: clean, email: '', provider: 'guest' };
}

export async function isTeacherCode(code) { return (await sha256(code.trim())) === CONFIG.teacherCodeSha256; }
export function isTeacherEmail(email) { return !!email && CONFIG.teacherEmails.map(e => e.toLowerCase()).includes(email.toLowerCase()); }
