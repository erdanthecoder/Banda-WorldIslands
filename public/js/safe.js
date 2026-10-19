// Keeps chat friendly for kids: rude words (English and Russian, common spellings) become ***.
// Words only match at the start of a word, so normal words like "рубля" or "хлеба" stay as they are.
const BAD = ['fuck', 'shit', 'bitch', 'asshole', 'dick', 'cunt', 'bastard', 'slut', 'whore', 'nigger', 'nigga', 'faggot', 'retard', 'kys', 'kill yourself',
  'бля', 'сука', 'суки', 'хуй', 'хуё', 'хуе', 'пизд', 'ебат', 'ебан', 'ебал', 'мудак', 'гандон', 'шлюх', 'долбоеб', 'долбаеб', 'пидор', 'пидар', 'уеб'];
// leetspeak back to letters (one character for one character, so positions stay the same)
const norm = s => s.toLowerCase().replace(/[0@]/g, 'o').replace(/[1!|]/g, 'i').replace(/3/g, 'e').replace(/[$5]/g, 's').replace(/4/g, 'a').replace(/ё/g, 'е');
const RES = BAD.map(w => new RegExp('(?<![\\p{L}])' + norm(w).split('').map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s._*-]*'), 'giu'));
export function clean(text) {
  let out = String(text || '').slice(0, 120);
  for (const re of RES) { const n = norm(out); let m; re.lastIndex = 0; while ((m = re.exec(n))) { out = out.slice(0, m.index) + '*'.repeat(m[0].length) + out.slice(m.index + m[0].length); } }
  return out;
}
