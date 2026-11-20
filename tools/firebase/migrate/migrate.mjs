/* Imhotep · Supabase → Firebase migration (CLI). Run it from the GitHub Actions workflow "Firebase migrate" (see tools/firebase/README.md).
     node migrate.mjs --mode=dry-run|apply|verify
   Needs (as repository SECRETS, never in a file): SUPABASE_URL, SUPABASE_SECRET_KEY (sb_secret_… or the legacy service_role), FIREBASE_SERVICE_ACCOUNT (the whole JSON).
   Prints counts only. Never upload its output as an artifact (the repo is public). */
import { runMigration } from './migrate-core.mjs';

const arg = (n, d) => { const a = process.argv.find(x => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : d; };
const mode = arg('mode', 'dry-run');
if (!['dry-run', 'apply', 'verify'].includes(mode)) { console.error('mode must be dry-run, apply or verify'); process.exit(2); }
const SB_URL = String(process.env.SUPABASE_URL || '').replace(/\/+$/, ''), SB_KEY = process.env.SUPABASE_SECRET_KEY || '';
if (!SB_URL || !SB_KEY) { console.error('SUPABASE_URL and SUPABASE_SECRET_KEY secrets are required'); process.exit(2); }
let sa; try { sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || ''); } catch (e) { console.error('FIREBASE_SERVICE_ACCOUNT secret must be the service-account JSON'); process.exit(2); }

const H = { apikey: SB_KEY }; if (SB_KEY.startsWith('eyJ')) H.authorization = 'Bearer ' + SB_KEY;
async function get(path) {
  for (let a = 0; a < 3; a++) {
    const r = await fetch(SB_URL + path, { headers: H });
    if (r.ok) return r.json();
    if (r.status < 500 && r.status !== 429) throw new Error('Supabase ' + path.split('?')[0] + ' -> HTTP ' + r.status);
    await new Promise(res => setTimeout(res, 1000 * (a + 1)));
  }
  throw new Error('Supabase ' + path.split('?')[0] + ' kept failing');
}
const sb = {
  async users() {
    const all = [];
    for (let page = 1; ; page++) { const j = await get('/auth/v1/admin/users?page=' + page + '&per_page=200'); const a = j.users || []; if (!a.length) break; all.push(...a); }
    return all;
  },
  /* `order` must be a UNIQUE key (offset paging over a non-unique order can skip or repeat rows). We also don't assume the server returns the
     full 1000: the offset advances by what actually came back and we stop only on an empty page (a lower db-max-rows would otherwise end the loop early). */
  async table(name, select, order) {
    const all = [];
    for (let off = 0; ;) { const a = await get('/rest/v1/' + name + '?select=' + select + '&order=' + order + '&limit=1000&offset=' + off); if (!a.length) break; all.push(...a); off += a.length; }
    return all;
  },
};

const { initializeApp, cert } = await import('firebase-admin/app');
const { getFirestore } = await import('firebase-admin/firestore');
const { getAuth } = await import('firebase-admin/auth');
initializeApp({ credential: cert(sa), projectId: sa.project_id });
const db = getFirestore(), auth = getAuth();
console.log('Firebase project: ' + sa.project_id + ' · mode: ' + mode);
/* public log: an uncaught error would print a stack trace with document paths (= uids). Print the error code only. */
let R;
try { R = await runMigration({ sb, db, auth, mode, log: console.log }); }
catch (e) { console.error('Migration stopped: ' + String((e && (e.code || e.name)) || 'error').slice(0, 60) + ' (nothing sensitive is printed; re-run is safe)'); process.exit(1); }
process.exit(R.ok ? 0 : 1);
