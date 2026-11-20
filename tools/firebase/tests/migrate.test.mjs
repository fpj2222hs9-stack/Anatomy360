import assert from 'assert';
import { makeFakeFirestore } from './fake-firestore.mjs';
import { runMigration } from '../migrate/migrate-core.mjs';

let pass = 0, fail = 0;
async function t(name, fn) { try { await fn(); pass++; console.log('  ok  ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + '\n      ' + (e && e.stack || e).split('\n').slice(0, 5).join('\n      ')); } }

/* ---- a fake Supabase (the REST shapes migrate.mjs reads) ---- */
const SECRET_BITS = ['alice@example.org', 'bob@example.org', 'SECRET-BOOK-TEXT', 'q-private-12', 'student-answer-xyz'];
function makeSupabase() {
  const mkUser = (n, sub) => ({ id: '00000000-0000-4000-8000-00000000000' + n, email: ['alice', 'bob', 'carol', 'dina'][n - 1] + '@example.org', email_confirmed_at: '2026-11-01T10:00:00Z', created_at: '2026-11-01T10:00:00Z', last_sign_in_at: '2026-11-10T10:00:00Z',
    user_metadata: { full_name: 'Student ' + n, avatar_url: 'https://lh3.googleusercontent.com/a/' + n }, identities: [{ provider: 'google', provider_id: sub, identity_data: { sub, email: 'x' } }] });
  const S = {
    users: [mkUser(1, 'g-111'), mkUser(2, 'g-222')],
    tables: {
      progress: [
        { user_id: '00000000-0000-4000-8000-000000000001', data: { v: 1, name: 'Alice', ans: { 'q-private-12': { c: 1, t: 1 }, a2: { c: 0, t: 2 } }, 'student-answer-xyz': 1 }, rev: 7, device: 'web-1', created_at: '2026-11-02T10:00:00Z', updated_at: '2026-11-12T10:00:00Z' },
        { user_id: '00000000-0000-4000-8000-000000000002', data: { v: 1, ans: { b1: { c: 1, t: 1 } } }, rev: 2, device: 'web-2', created_at: '2026-11-03T10:00:00Z', updated_at: '2026-11-13T10:00:00Z' },
      ],
      progress_backups: [{ user_id: '00000000-0000-4000-8000-000000000001', data: { v: 1, ans: {} }, rev: 3, reason: 'periodic', taken_at: '2026-11-05T10:00:00Z' }],
      horus_chat: [{ user_id: '00000000-0000-4000-8000-000000000001', msgs: [{ r: 'u', t: 'hello' }], updated_at: '2026-11-12T10:00:00Z' }],
      horus_usage: [{ scope: 'u:00000000-0000-4000-8000-000000000001', day: '2026-11-15', n: 3 }, { scope: 'g', day: '2026-11-15', n: 12 }],
      horus_cache: [{ key: 'q|v7|abc/def', kind: 'q', sid: 'anatomy', q: 'stem', ans: { a: 'x', st: 'book', ss: [] }, hits: 4, created_at: '2026-11-08T10:00:00Z', last_at: '2026-11-14T10:00:00Z' }],
      horus_passages: [
        { id: 1, sid: 'anatomy', src: 'anatomy-dept-book', ord: 0, seq: 0, book: 'Book', chapter: 'C', heading: 'H', page: '1', body: 'SECRET-BOOK-TEXT one' },
        { id: 2, sid: 'histology', src: 'histology-ref', ord: 1, seq: 0, book: 'Book', chapter: '', heading: '', page: '', body: 'SECRET-BOOK-TEXT two' },
      ],
    },
  };
  return { S, sb: { users: async () => JSON.parse(JSON.stringify(S.users)), table: async (n) => JSON.parse(JSON.stringify(S.tables[n] || [])) }, mkUser };
}
function makeAuth() {
  const m = new Map(); const nf = () => Object.assign(new Error('nf'), { code: 'auth/user-not-found' });
  return { m,
    getUser: async uid => { if (!m.has(uid)) throw nf(); return m.get(uid); },
    getUserByProviderUid: async (p, uid) => { const u = [...m.values()].find(x => (x.providerData || []).some(d => d.providerId === p && d.uid === uid)); if (!u) throw nf(); return u; },
    importUsers: async recs => { recs.forEach(r => m.set(r.uid, r)); return { successCount: recs.length, failureCount: 0, errors: [] }; },
    deleteUser: async uid => { m.delete(uid); } };
}
const setup = () => { const sbx = makeSupabase(), f = makeFakeFirestore(), auth = makeAuth(), lines = []; const run = mode => runMigration({ sb: sbx.sb, db: f.db, auth, mode, log: l => lines.push(l) }); return { ...sbx, f, auth, lines, run }; };
const snapshot = f => JSON.stringify(Object.fromEntries([...f.cols.entries()].map(([c, m]) => [c, [...m.entries()]])));
const A = '00000000-0000-4000-8000-000000000001', B = '00000000-0000-4000-8000-000000000002';

console.log('migration');
await t('dry-run reads everything and writes nothing', async () => {
  const s = setup(); const r = await s.run('dry-run');
  assert([...s.f.cols.values()].every(m => m.size === 0), 'Firestore untouched'); assert.equal(s.auth.m.size, 0, 'Auth untouched');
  assert.equal(r.users.toCreate, 2); assert.equal(r.progress.created, 2); assert(r.ok);
});
await t('apply: same uid + Google id for every user; progress/chat/safety copies copied with the right shapes (and Horus counters/cache/books are NOT copied: they stay on Supabase)', async () => {
  const s = setup(); const r = await s.run('apply'); assert(r.ok, JSON.stringify(r));
  const u = s.auth.m.get(A); assert.equal(u.email, 'alice@example.org'); assert.equal(u.emailVerified, true); assert.equal(u.displayName, 'Student 1');
  assert.deepEqual(u.providerData.map(p => [p.providerId, p.uid]), [['google.com', 'g-111']]);
  const p = s.f.dump('progress')[A]; assert.equal(typeof p.data, 'string'); assert.equal(p.rev, 7); assert.equal(p.device, 'migrate-sb'); assert.equal(JSON.parse(p.data).name, 'Alice');
  assert.deepEqual(Object.keys(p).sort(), ['createdAt', 'data', 'device', 'rev', 'srcAt', 'updatedAt'], 'exactly the fields the security rules allow (srcAt is only written by the migration)');
  assert.equal(p.srcAt, '2026-11-12T10:00:00.000Z');
  assert.equal(new Date(p.createdAt).toISOString(), '2026-11-02T10:00:00.000Z');
  assert.deepEqual(JSON.parse(s.f.dump('horus_chat')[A].msgs), [{ r: 'u', t: 'hello' }]); assert.deepEqual(Object.keys(s.f.dump('horus_chat')[A]).sort(), ['by', 'msgs', 'updatedAt']);
  assert.equal(s.f.col('progress_backups').size, 1);
  for (const c of ['horus_usage', 'horus_cache', 'horus_passages']) assert(!s.f.cols.has(c) || s.f.col(c).size === 0, c + ' must not be copied');
  assert.equal(s.f.dump('progress_backups')[A + '~periodic~3'].uid, A);
});
await t('running apply again changes nothing (idempotent), and verify is happy', async () => {
  const s = setup(); await s.run('apply'); const before = snapshot(s.f);
  const r = await s.run('apply'); assert.equal(snapshot(s.f), before); assert.equal(r.progress.unchanged, 2); assert.equal(r.users.exists, 2); assert.equal(r.users.created || 0, 0);
  const v = await s.run('verify'); assert(v.ok, JSON.stringify(v));
});
await t('delta run: new user + new Supabase data are picked up; progress the app already wrote on Firebase is never overwritten; refreshed docs get a higher rev', async () => {
  const s = setup(); await s.run('apply');
  s.f.dump('progress')[B]; const refB = s.f.col('progress').get(B); refB.device = 'web-xyz'; refB.rev = 9; refB.data = JSON.stringify({ v: 1, ans: { newer: 1 } });         // the app wrote user B's doc on Firebase
  s.S.tables.progress[0].data.ans.a3 = { c: 1, t: 3 }; s.S.tables.progress[0].rev = 8;                               // user A changed on Supabase meanwhile
  s.S.users.push(s.mkUser(3, 'g-333')); s.S.tables.progress.push({ user_id: '00000000-0000-4000-8000-000000000003', data: { v: 1, ans: {} }, rev: 1, device: 'w', created_at: '2026-11-14T10:00:00Z', updated_at: '2026-11-14T10:00:00Z' });
  const r = await s.run('apply'); assert(r.ok);
  assert.equal(r.users.created, 1); assert.equal(r.progress.created, 1); assert.equal(r.progress.updated, 1); assert.equal(r.progress.appWrote, 1);
  assert.equal(JSON.parse(s.f.dump('progress')[A].data).ans.a3.c, 1); assert.equal(s.f.dump('progress')[A].rev, 9, 'max(8,7)+1');
  assert.equal(s.f.dump('progress')[B].device, 'web-xyz'); assert.equal(s.f.dump('progress')[B].rev, 9); assert.equal(JSON.parse(s.f.dump('progress')[B].data).ans.newer, 1);
  assert(s.auth.m.has('00000000-0000-4000-8000-000000000003'));
});
await t('students who already use Firebase but whose Supabase copy changed afterwards (old device) are COUNTED (supabaseNewer), never overwritten', async () => {
  const s = setup(); await s.run('apply');
  s.f.col('progress').get(A).device = 'web-1';                                                            // A signed in on Firebase from the new site
  s.S.tables.progress[0].updated_at = '2026-11-20T10:00:00Z'; s.S.tables.progress[0].rev = 9;              // an old device kept writing to Supabase
  const r = await s.run('apply'); assert(r.ok, JSON.stringify(r)); assert.equal(r.progress.appWrote, 1); assert.equal(r.progress.supabaseNewer, 1);
  assert.equal(s.f.dump('progress')[A].device, 'web-1'); assert.equal(s.f.dump('progress')[A].rev, 7);
  const v = await s.run('verify'); assert(v.ok, 'informational only'); assert.equal(v.progress.supabaseNewer, 1);
});
await t('verify counts every Supabase answer (by question id) that Firebase also has: nothing missing right after apply; a Firebase-written copy that lacks answers is COUNTED; a Firebase superset is fine', async () => {
  const s = setup(); await s.run('apply');
  let v = await s.run('verify'); assert(v.ok); assert.equal(v.progress.sbAnswers, 3); assert.equal(v.progress.carriedAnswers, 3); assert(!v.progress.behindStudents); assert(s.lines.some(l => /nothing missing/.test(l)));
  const refB = s.f.col('progress').get(B); refB.device = 'web-xyz'; refB.data = JSON.stringify({ v: 1, ans: { b1: { c: 1, t: 1 }, extra: { c: 1, t: 9 } } });            // B on Firebase has MORE than Supabase
  const refA = s.f.col('progress').get(A); refA.device = 'web-1'; refA.data = JSON.stringify({ v: 1, ans: { a2: { c: 0, t: 2 } } });                                   // A on Firebase lacks 'q-private-12'
  v = await s.run('verify'); assert.equal(v.progress.sbAnswers, 3); assert.equal(v.progress.carriedAnswers, 2); assert.equal(v.progress.behindStudents, 1); assert.equal(v.progress.behindAnswers, 1);
  assert(s.lines.some(l => /MISSING on Firebase 1 answers of 1 students/.test(l)));
  assert(!s.lines.join('\n').includes('q-private-12'), 'the log never names the question');
  s.f.col('progress').delete(B); v = await s.run('verify'); assert.equal(v.progress.missing, 1); assert.equal(v.progress.behindAnswers, 2, 'a missing document counts all its answers as not carried');
});
await t('a stray Firebase user created by an early Google sign-in is replaced when it has no data; kept and reported when it has data', async () => {
  let s = setup();
  s.auth.m.set('stray-1', { uid: 'stray-1', providerData: [{ providerId: 'google.com', uid: 'g-111' }] });
  let r = await s.run('apply'); assert(r.ok); assert.equal(r.users.strayRemoved, 1); assert(!s.auth.m.has('stray-1')); assert(s.auth.m.has(A));
  s = setup(); s.auth.m.set('stray-2', { uid: 'stray-2', providerData: [{ providerId: 'google.com', uid: 'g-111' }] }); s.f.put('progress', 'stray-2', { data: '{}', rev: 1 });
  r = await s.run('apply'); assert.equal(r.users.conflict, 1); assert.equal(r.ok, false); assert(s.auth.m.has('stray-2')); assert(!s.auth.m.has(A), 'the conflicting user is not imported');
  assert(r.problems.some(p => /needs a human/.test(p)));
});
await t('a progress row that is not an object, or too large IN BYTES (Arabic = 2 bytes/char), is reported and not written; the rest of the run continues', async () => {
  const s = setup(); s.S.tables.progress[1].data = [1, 2]; s.S.tables.progress[0].data = { big: '\u0639'.repeat(500001) };      // 500001 characters but 1,000,002 bytes
  const r = await s.run('apply'); assert.equal(r.progress.errors, 2); assert.equal(r.ok, false); assert.equal(s.f.col('progress').size, 0);
  assert.equal(r.chat.created, 1, 'later sections still ran');
});
await t('verify finds a missing user, a missing document and a changed safety copy', async () => {
  const s = setup(); await s.run('apply');
  s.auth.m.delete(B); s.f.col('progress').delete(B); s.f.col('progress_backups').delete(A + '~periodic~3');
  const v = await s.run('verify'); assert.equal(v.ok, false); assert.equal(v.users.missing, 1); assert.equal(v.progress.missing, 1); assert.equal(v.backups.missing, 1);
});
await t('an account the student deleted on Firebase (tombstone) is NOT brought back by a repeated migration', async () => {
  const s = setup(); await s.run('apply');
  /* what the site does when the student deletes the account */
  s.f.put('deleted_accounts', A, { at: new Date() }); s.f.col('progress').delete(A); s.f.col('horus_chat').delete(A); s.auth.m.delete(A);
  for (const k of [...s.f.col('progress_backups').keys()]) if (k.startsWith(A)) s.f.col('progress_backups').delete(k);
  const r = await s.run('apply'); assert(r.ok, JSON.stringify(r));
  assert(!s.auth.m.has(A) && !s.f.col('progress').has(A) && !s.f.col('horus_chat').has(A), 'still gone');
  assert([...s.f.col('progress_backups').keys()].every(k => !k.startsWith(A)));
  assert.equal(r.users.deletedOnFirebase, 1); assert.equal(r.progress.deletedOnFirebase, 1); assert.equal(r.chat.deletedOnFirebase, 1); assert.equal(r.backups.deletedOnFirebase, 1);
  assert(s.f.col('progress').has(B) && s.auth.m.has(B), 'everybody else is untouched');
  const v = await s.run('verify'); assert(v.ok, JSON.stringify(v));
});
await t('a student who deleted the account on SUPABASE after the first run: the migration-only copy is removed; app-written data and Firebase-only users are kept', async () => {
  const s = setup(); await s.run('apply');
  s.f.col('progress').get(B).device = 'web-9';                                                           // B kept using the app on Firebase
  s.S.users.shift(); s.S.tables.progress.shift(); s.S.tables.horus_chat.shift();                          // A deleted the account on Supabase
  s.S.tables.progress_backups.shift();
  s.f.put('progress', 'native-1', { data: '{"v":1}', rev: 2, device: 'web-5' }); s.auth.m.set('native-1', { uid: 'native-1' });   // signed up on Firebase directly
  const d = await s.run('dry-run'); assert.equal(d.users.removedOnSupabase, 1); assert(s.f.col('progress').has(A), 'dry-run removes nothing');
  const r = await s.run('apply'); assert.equal(r.users.removedOnSupabase, 1);
  assert(!s.f.col('progress').has(A) && !s.f.col('horus_chat').has(A) && !s.auth.m.has(A), 'A is gone');
  assert([...s.f.col('progress_backups').keys()].every(k => !k.startsWith(A)));
  assert(s.f.col('progress').has(B) && s.f.col('progress').has('native-1') && s.auth.m.has('native-1'), 'others kept');
  const none = setup(); await none.run('apply'); none.S.users.length = 0; const g = await none.run('apply');
  assert(g.problems.some(p => /returned no users/.test(p)) && none.f.col('progress').size === 2, 'an empty Supabase answer never purges anything');
});
await t('the app writing between our read and our write wins (update inside a transaction; create that hits ALREADY_EXISTS)', async () => {
  let s = setup(); await s.run('apply');
  s.S.tables.progress[0].data.ans.a3 = { c: 1, t: 3 }; s.S.tables.progress[0].rev = 8; s.S.tables.horus_chat[0].msgs.push({ r: 'u', t: 'later' });
  const orig = s.f.db.runTransaction.bind(s.f.db);
  s.f.db.runTransaction = fn => { s.f.col('progress').get(A).device = 'web-1'; s.f.col('horus_chat').get(A).by = 'web'; return orig(fn); };      // the app got there first
  const r = await s.run('apply'); assert(r.ok);
  assert.equal(r.progress.appWrote, 1); assert.equal(r.chat.appWrote, 1); assert.equal(r.progress.updated || 0, 0);
  assert(!JSON.parse(s.f.dump('progress')[A].data).ans.a3, 'not overwritten'); assert.equal(s.f.dump('progress')[A].rev, 7);
  s = setup(); const oc = s.f.db.collection;
  s.f.db.collection = n => { const q = oc(n); if (n === 'progress') { const od = q.doc; q.doc = id => { const ref = od(id), og = ref.get.bind(ref); ref.get = async () => { const sn = await og(); if (!sn.exists) s.f.put('progress', id, { data: '{"v":1}', rev: 3, device: 'web-1' }); return sn; }; return ref; }; } return q; };
  const r2 = await s.run('apply'); assert.equal(r2.progress.appWrote, 2); assert.equal(s.f.dump('progress')[A].device, 'web-1');
});
await t('PRIVACY: a failing write is reported by error code only (no uid/path), and the run goes on', async () => {
  const s = setup(); const oc = s.f.db.collection;
  s.f.db.collection = n => { const q = oc(n); if (n === 'progress') { const od = q.doc; q.doc = id => { const ref = od(id); ref.create = async () => { throw Object.assign(new Error('13 INTERNAL: boom at projects/p/databases/(default)/documents/progress/' + id), { code: 13 }); }; return ref; }; } return q; };
  const r = await s.run('apply'); assert.equal(r.progress.errors, 2); assert.equal(r.ok, false); assert.equal(r.chat.created, 1, 'later sections still ran');
  const log = s.lines.join('\n'); assert(/progress write failed \(13\)/.test(log)); for (const bit of [A, B, 'boom', 'databases']) assert(!log.includes(bit), 'log leaked: ' + bit);
});
await t('PRIVACY: the log never contains emails, uids, answers or book text', async () => {
  const s = setup(); s.S.tables.progress[0].data = { big: 'x'.repeat(1000001) };
  await s.run('dry-run'); await s.run('apply'); await s.run('verify');
  const log = s.lines.join('\n');
  for (const bit of SECRET_BITS.concat([A, B, 'g-111', 'Student 1'])) assert(!log.includes(bit), 'log leaked: ' + bit);
  assert(/PROBLEM progress.data too large/.test(log));
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
