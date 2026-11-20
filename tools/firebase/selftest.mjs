/* Imhotep · Firebase selftest (Spark plan) — runs AFTER you deploy the rules (workflow "Firebase" ← action "selftest"). It checks the REAL project end to end WITHOUT a Google login:
   it signs in a throw-away test user with a custom token (service account), then drives the real client code (js/cloud-fb.js) against the real Firestore rules:
   create / update / stale-write conflict / chat / everything the rules must refuse / the daily safety copy / the student deleting their own account (with the tombstone).
   It also checks Horus (it stays on the Supabase Edge Function): health, CORS, and that it accepts the Firebase token of the test user.
   Needs env: FIREBASE_SERVICE_ACCOUNT (JSON). apiKey, Supabase url/anon key and the site origin are read from js/cloud-config.js unless FIREBASE_API_KEY, SUPABASE_URL, SUPABASE_ANON, SITE_ORIGIN are set.
   Optional: SELFTEST_ASK=1 also asks Horus one real question (spends one Gemini call). Prints PASS/FAIL lines only (no uid, no data). The test users are removed at the end. */
import { pathToFileURL } from 'url';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const here = path.dirname(fileURLToPath(import.meta.url));
let sa; try { sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || ''); } catch (e) { console.error('FIREBASE_SERVICE_ACCOUNT must be the service-account JSON'); process.exit(2); }
/* the values the site itself uses: js/cloud-config.js (so the selftest also proves the committed config is the right one) */
let top = {}, cfg = {};
try { const vm = await import('vm'); const fsx = await import('fs'); const ctx = { window: { IM: {} } }; vm.runInNewContext(fsx.readFileSync(path.resolve(here, '../../js/cloud-config.js'), 'utf8'), ctx); top = ctx.window.IM.CLOUD || {}; cfg = top.fb || {}; } catch (e) { /* env only */ }
const API_KEY = process.env.FIREBASE_API_KEY || cfg.apiKey || '';
const SB_URL = String(process.env.SUPABASE_URL || top.url || '').replace(/\/+$/, ''), SB_ANON = process.env.SUPABASE_ANON || top.anon || '';
let ORIGIN = process.env.SITE_ORIGIN || ''; if (!ORIGIN && cfg.redirects && cfg.redirects[0]) { try { ORIGIN = new URL(cfg.redirects[0]).origin; } catch (e) { /* ignore */ } } ORIGIN = ORIGIN || 'https://imhotep-lac.vercel.app';
if (!API_KEY) { console.error('apiKey is required: fill fb{} in js/cloud-config.js (or set FIREBASE_API_KEY)'); process.exit(2); }
if (cfg.projectId && cfg.projectId !== sa.project_id) { console.error('js/cloud-config.js fb.projectId (' + cfg.projectId + ') is not the service account\'s project (' + sa.project_id + ')'); process.exit(2); }

const { initializeApp, cert } = await import('firebase-admin/app');
const { getFirestore, FieldValue } = await import('firebase-admin/firestore');
const { getAuth } = await import('firebase-admin/auth');
initializeApp({ credential: cert(sa), projectId: sa.project_id });
const db = getFirestore(), auth = getAuth();
const { runBackup, backupId, slotOf } = await import('./backup/backup-core.mjs');

/* the browser-side adapter, unchanged */
globalThis.window = globalThis; globalThis.IM = {}; globalThis.location = { origin: ORIGIN, pathname: '/', hash: '', search: '', href: ORIGIN + '/' };
const realFetch = globalThis.fetch;
globalThis.fetch = (u, i) => { i = Object.assign({}, i); i.headers = Object.assign({ origin: ORIGIN, referer: ORIGIN + '/' }, i.headers || {}); return realFetch(u, i); };   // so a referrer-restricted API key behaves like in the browser
await import(pathToFileURL(path.resolve(here, '../../js/cloud-fb.js')).href);

const uidA = 'selftest-' + crypto.randomBytes(5).toString('hex'), uidB = 'selftest-' + crypto.randomBytes(5).toString('hex');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function signIn(uid) {
  const ct = await auth.createCustomToken(uid);
  const r = await realFetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=' + API_KEY, { method: 'POST', headers: { 'content-type': 'application/json', origin: ORIGIN, referer: ORIGIN + '/' }, body: JSON.stringify({ token: ct, returnSecureToken: true }) });
  const j = await r.json(); if (!r.ok) throw new Error('custom-token sign-in failed: ' + JSON.stringify(j.error || j).slice(0, 200));
  return { at: j.idToken, rt: j.refreshToken };
}
function adapterFor(C, tokenBox) {
  const X = { CFG: { url: SB_URL, anon: SB_ANON, fb: { projectId: sa.project_id, apiKey: API_KEY, clientId: 'selftest', redirects: [] } }, C, S: { get: () => null, set() {}, del() {} }, PK: 'selftest', save() {},
    rnd: () => 'x', sha256: async s => s, b64url: s => s, withToken: fn => fn(tokenBox.at),
    httpErr: r => { const e = new Error('http'); e.status = r.status; e.code = (r.json && (r.json.code || r.json.error)) || ''; return e; } };
  return IM.cloudAdapters.firebase(X);
}
async function raw(method, url, tok, body, hdr) {
  const r = await realFetch(url, { method, headers: Object.assign({ origin: ORIGIN, referer: ORIGIN + '/' }, hdr || {}, tok ? { authorization: 'Bearer ' + tok } : {}, body ? { 'content-type': 'application/json' } : {}), body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch (e) { /* none */ } return { status: r.status, ok: r.ok, json: j, headers: r.headers };
}
const FSB = 'https://firestore.googleapis.com/v1/projects/' + sa.project_id + '/databases/(default)/documents';
const name = (c, id) => 'projects/' + sa.project_id + '/databases/(default)/documents/' + c + '/' + id;
const T = { setToServerValue: 'REQUEST_TIME' };
const commitBody = (w) => ({ writes: [w] });

try {
  const A = await signIn(uidA), B = await signIn(uidB), box = { at: A.at }, CA = { uid: uidA, at: A.at };
  const ad = adapterFor(CA, box);
  ok(!!A.at && !!B.at, 'custom-token sign-in works (Identity Toolkit + API key)');

  /* token refresh through the real adapter */
  const rf = await ad.refresh(A.rt); ok(rf.ok && rf.bundle && rf.bundle.at && rf.bundle.user.id === uidA, 'refresh token -> new id token for the same uid (securetoken)'); if (rf.ok) { box.at = rf.bundle.at; CA.at = rf.bundle.at; }
  ok((await ad.probe()) === 'on', 'probe: Firebase Auth reachable and the API key is accepted');

  /* progress: create, duplicate, read, update, stale write */
  ok((await ad.getRow(uidA)) === null, 'getRow: no document yet -> null');
  const d1 = { v: 1, name: 'اختبار', ans: { q1: { c: 1, t: 1 } } };
  let r = await ad.insertRow(uidA, d1, 'selftest'); ok(r.ok && r.rev === 1, 'insertRow: created with rev 1 (rules: create needs rev 1 and server timestamps)');
  r = await ad.insertRow(uidA, d1, 'selftest'); ok(r.dup === true, 'insertRow again: reported as duplicate');
  let row = await ad.getRow(uidA); ok(row && row.rev === 1 && JSON.stringify(row.data) === JSON.stringify(d1), 'getRow: same data and rev back (Arabic text intact)');
  const d2 = { v: 1, name: 'اختبار', ans: { q1: { c: 1, t: 1 }, q2: { c: 0, t: 2 } } };
  r = await ad.pushRow(uidA, d2, 1, 'selftest'); ok(r.ok && r.rev === 2, 'pushRow: rev 1 -> 2 accepted');
  r = await ad.pushRow(uidA, d1, 1, 'selftest'); ok(r.conflict === true, 'pushRow with a stale rev: rejected as a conflict (optimistic concurrency)');
  row = await ad.getRow(uidA, true); ok(row && row.rev === 2, 'light read returns the current rev');
  row = await ad.getRow(uidA); ok(JSON.stringify(row.data) === JSON.stringify(d2), 'the stale write did not change the data');

  /* chat */
  const msgs = [{ r: 'u', t: 'سؤال', id: 'm1' }, { r: 'a', t: 'إجابة', id: 'm2' }];
  ok((await ad.chatGet(uidA)) === null, 'chatGet: nothing yet'); await ad.chatPut(uidA, msgs);
  const ch = await ad.chatGet(uidA); ok(ch && JSON.stringify(ch.msgs) === JSON.stringify(msgs), 'chatPut / chatGet round trip');

  /* what the rules must refuse */
  const tokA = box.at, upd = (col, id, fields, mask) => ({ update: { name: name(col, id), fields }, updateMask: { fieldPaths: mask }, currentDocument: { exists: true }, updateTransforms: [{ fieldPath: 'updatedAt', ...T }] });
  ok((await raw('GET', FSB + '/progress/' + uidB, tokA)).status === 403, 'rules: cannot read another student\'s progress');
  ok((await raw('GET', FSB + '/horus_chat/' + uidB, tokA)).status === 403, 'rules: cannot read another student\'s chat');
  ok((await raw('GET', FSB + '/meta/backup', tokA)).status === 403, 'rules: the backup state document is closed to students');
  ok((await raw('GET', FSB + '/horus_passages/anatomy-1', tokA)).status === 403, 'rules: any collection we did not open is closed (the books are not here at all)');
  ok((await raw('GET', FSB + '/deleted_accounts/' + uidA, tokA)).status === 403, 'rules: the deleted-accounts list cannot be read');
  const np = await raw('GET', FSB + '/progress/' + uidA, null); ok(np.status === 401 || np.status === 403, 'rules: no sign-in, no data');
  ok((await raw('POST', FSB + ':commit', tokA, commitBody({ update: { name: name('progress', uidB), fields: { data: { stringValue: '{}' }, rev: { integerValue: '1' }, device: { stringValue: 'x' } } }, updateTransforms: [{ fieldPath: 'createdAt', ...T }, { fieldPath: 'updatedAt', ...T }] }))).status === 403, 'rules: cannot create a progress document for someone else');
  ok((await raw('POST', FSB + ':commit', tokA, commitBody({ delete: name('progress', uidB) }))).status === 403, 'rules: cannot delete another student\'s progress document');
  ok((await raw('POST', FSB + ':commit', tokA, commitBody(upd('progress', uidA, { data: { stringValue: '{}' }, rev: { integerValue: '9' }, device: { stringValue: 'x' } }, ['data', 'rev', 'device'])))).status === 403, 'rules: rev can only go up by exactly one');
  ok((await raw('POST', FSB + ':commit', tokA, commitBody(upd('progress', uidA, { data: { stringValue: '{}' }, rev: { integerValue: '3' }, extra: { stringValue: 'x' } }, ['data', 'rev', 'extra'])))).status === 403, 'rules: unknown fields are refused');
  ok((await raw('POST', FSB + ':commit', tokA, commitBody(upd('progress', uidA, { data: { stringValue: 'x'.repeat(900001) }, rev: { integerValue: '3' } }, ['data', 'rev'])))).status === 403, 'rules: a document bigger than 900,000 characters is refused');
  ok((await raw('POST', FSB + ':commit', tokA, commitBody({ update: { name: name('progress_backups', 'forged'), fields: { uid: { stringValue: uidA }, data: { stringValue: '{}' } } } }))).status === 403, 'rules: students cannot write safety copies (only the daily job can)');
  ok((await raw('POST', FSB + ':commit', tokA, commitBody({ update: { name: name('meta', 'backup'), fields: { st: { stringValue: '{}' } } } }))).status === 403, 'rules: students cannot write the backup state');
  ok((await raw('POST', FSB + ':commit', tokA, commitBody({ update: { name: name('deleted_accounts', uidB), fields: {} }, updateTransforms: [{ fieldPath: 'at', ...T }] }))).status === 403, 'rules: a student cannot mark SOMEONE ELSE\'s account as deleted');
  ok((await raw('POST', FSB + ':commit', tokA, commitBody({ update: { name: name('horus_cache', 'evil'), fields: { ans: { stringValue: '{}' } } } }))).status === 403, 'rules: students cannot write anything outside their own documents');
  row = await ad.getRow(uidA); ok(row && row.rev === 2 && JSON.stringify(row.data) === JSON.stringify(d2), 'after all the refused writes the document is unchanged');

  /* horus (still on Supabase) */
  if (SB_URL && SB_ANON) {
    const HZ = SB_URL + '/functions/v1/horus', ah = { apikey: SB_ANON };
    const h = await raw('GET', HZ, null, null, ah); ok(h.status === 200 && h.json && h.json.ok && h.json.ready && h.json.ready.db === true, 'horus: health check answers and its store is ready');
    ok(h.json && h.json.ready && h.json.ready.gemini === true, 'horus: GEMINI_API_KEY secret is set (no value shown)');
    ok(h.json && h.json.ready && h.json.ready.fb === true, 'horus: FIREBASE_PROJECT_ID secret is set on the Supabase function (otherwise Firebase students cannot ask Horus)');
    const me = await ad.fn('GET', '?me=1', { timeout: 20000 });
    ok(me.ok && me.json && typeof me.json.left === 'number' && me.json.lim >= 1, 'horus ?me=1 with a FIREBASE token: remaining asks returned' + (me.ok ? '' : ' (status ' + me.status + ': deploy the new horus function with firebase.js and set FIREBASE_PROJECT_ID)'));
    ok((await raw('GET', HZ + '?me=1', null, null, ah)).status === 401, 'horus ?me=1 without a token: 401');
    const pre = await realFetch(HZ, { method: 'OPTIONS', headers: { origin: ORIGIN, 'access-control-request-method': 'POST', apikey: SB_ANON } });
    ok((pre.status === 204 || pre.status === 200) && pre.headers.get('access-control-allow-origin') === ORIGIN, 'horus: CORS preflight allows the site origin');
    const evil = await realFetch(HZ, { method: 'OPTIONS', headers: { origin: 'https://evil.example', apikey: SB_ANON } }); ok(evil.headers.get('access-control-allow-origin') !== 'https://evil.example', 'horus: CORS refuses other origins');
    if (process.env.SELFTEST_ASK === '1') {
      const q = await ad.fn('POST', '', { body: { mode: 'chat', text: 'Which nerve supplies the deltoid muscle?', sid: 'anatomy' }, timeout: 60000 });
      ok(q.ok && q.json && q.json.ok && typeof q.json.a === 'string' && q.json.a.length > 20, 'horus: a real question from a Firebase student gets a real answer (Gemini + books) — ' + (q.json && q.json.st));
    }
  } else console.log('SKIP horus checks (no Supabase url/anon key in js/cloud-config.js)');

  /* the daily safety copy (what replaces the Cloud Function): run the real job for the test student only */
  const R = await runBackup({ db, FV: FieldValue, only: [uidA], log: () => {} });
  const bk = (await db.collection('progress_backups').doc(backupId(uidA, slotOf(Date.now()))).get());
  ok(R.copied === 1 && bk.exists && bk.data().rev === 2 && bk.data().reason === 'daily' && bk.data().uid === uidA, 'backup job: the student\'s progress was copied to progress_backups (daily slot)');
  const mine = await raw('POST', FSB + ':runQuery', box.at, { structuredQuery: { from: [{ collectionId: 'progress_backups' }], where: { fieldFilter: { field: { fieldPath: 'uid' }, op: 'EQUAL', value: { stringValue: uidA } } }, limit: 5 } });
  ok(mine.ok && Array.isArray(mine.json) && mine.json.some(x => x.document), 'rules: a student can list their OWN safety copies (the site uses this when deleting an account)');
  const other = await raw('POST', FSB + ':runQuery', box.at, { structuredQuery: { from: [{ collectionId: 'progress_backups' }], where: { fieldFilter: { field: { fieldPath: 'uid' }, op: 'EQUAL', value: { stringValue: uidB } } }, limit: 5 } });
  ok(other.status === 403, 'rules: a student cannot list another student\'s safety copies');

  /* the student deletes their own account (browser flow: tombstone, data, safety copies, then the sign-in user) */
  ok((await ad.deleteAccount()) === true, 'deleteAccount (client side) with the student\'s own token: accepted');
  await sleep(1500);
  ok(!(await db.collection('progress').doc(uidA).get()).exists && !(await db.collection('horus_chat').doc(uidA).get()).exists && (await db.collection('progress_backups').where('uid', '==', uidA).get()).empty, 'account deleted: progress, chat and safety copies are gone');
  ok((await db.collection('deleted_accounts').doc(uidA).get()).exists, 'account deleted: the tombstone was written (blocks re-creation)');
  let gone = false; try { await auth.getUser(uidA); } catch (e) { gone = e && e.code === 'auth/user-not-found'; } ok(gone, 'account deleted: the sign-in user is gone too');
  /* a second device whose token is still alive tries to bring the data back */
  await raw('POST', FSB + ':commit', box.at, commitBody({ update: { name: name('progress', uidA), fields: { data: { stringValue: '{"v":1}' }, rev: { integerValue: '1' }, device: { stringValue: 'ghost' } } }, currentDocument: { exists: false }, updateTransforms: [{ fieldPath: 'createdAt', ...T }, { fieldPath: 'updatedAt', ...T }] }));
  ok(!(await db.collection('progress').doc(uidA).get()).exists, 'tombstone: a leftover token cannot recreate the deleted account\'s data');
} catch (e) {
  console.log('FAIL unexpected error: ' + String(e && e.message).slice(0, 300)); fails++;
} finally {
  for (const u of [uidA, uidB]) {
    try { for (const c of ['progress', 'horus_chat', 'deleted_accounts']) await db.collection(c).doc(u).delete(); const b = await db.collection('progress_backups').where('uid', '==', u).get(); for (const d of b.docs) await d.ref.delete(); } catch (e) { /* best effort */ }
    try { await auth.deleteUser(u); } catch (e) { /* already gone */ }
  }
}
console.log(fails ? 'SELFTEST FAILED (' + fails + ')' : 'SELFTEST OK'); process.exit(fails ? 1 : 0);
