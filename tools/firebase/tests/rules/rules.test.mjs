/* Firestore security rules test (runs in the Firestore emulator, in CI: workflow "Firebase rules test").
   Checks exactly the writes js/cloud-fb.js makes (create with rev 1, update with rev+1, chat upsert) and everything that must be refused. */
import fs from 'fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, collection, query, where, serverTimestamp, Timestamp } from 'firebase/firestore';

const env = await initializeTestEnvironment({ projectId: 'demo-imhotep', firestore: { rules: fs.readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8') } });
let pass = 0, fail = 0;
async function t(name, fn) { try { await env.clearFirestore(); await fn(); pass++; console.log('  ok  ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + '\n      ' + String(e && e.message).split('\n')[0]); } }
const as = uid => env.authenticatedContext(uid).firestore();
const anon = () => env.unauthenticatedContext().firestore();
const seed = async (fn) => env.withSecurityRulesDisabled(async ctx => fn(ctx.firestore()));
const NEW = (extra) => Object.assign({ data: '{"v":1,"ans":{}}', rev: 1, device: 'web-1', createdAt: serverTimestamp(), updatedAt: serverTimestamp() }, extra || {});
const seedProgress = (uid, rev) => seed(db => setDoc(doc(db, 'progress', uid), { data: '{"v":1}', rev: rev || 1, device: 'migrate-sb', createdAt: Timestamp.fromDate(new Date('2026-11-01')), updatedAt: Timestamp.fromDate(new Date('2026-11-01')) }));

console.log('progress');
await t('owner can create with rev 1 and server timestamps', async () => { await assertSucceeds(setDoc(doc(as('u1'), 'progress', 'u1'), NEW())); });
await t('create without device is fine; with rev 2 / client timestamps / extra field / other uid is refused', async () => {
  await assertSucceeds(setDoc(doc(as('u1'), 'progress', 'u1'), (({ device, ...r }) => r)(NEW())));
  await assertFails(setDoc(doc(as('u2'), 'progress', 'u2'), NEW({ rev: 2 })));
  await assertFails(setDoc(doc(as('u3'), 'progress', 'u3'), NEW({ createdAt: Timestamp.fromDate(new Date('2020-01-01')) })));
  await assertFails(setDoc(doc(as('u4'), 'progress', 'u4'), NEW({ extra: 1 })));
  await assertFails(setDoc(doc(as('u5'), 'progress', 'u6'), NEW()));
  await assertFails(setDoc(doc(anon(), 'progress', 'u7'), NEW()));
});
await t('update: rev +1 with new server updatedAt is accepted (also on a document written by the migration)', async () => {
  await seedProgress('u1', 7);
  await assertSucceeds(updateDoc(doc(as('u1'), 'progress', 'u1'), { data: '{"v":1,"ans":{"a":1}}', rev: 8, device: 'web-9', updatedAt: serverTimestamp() }));
});
await t('update: stale rev (+0), skipped rev (+2), rewound rev, extra field, createdAt change, other user — all refused', async () => {
  await seedProgress('u1', 7);
  const d = doc(as('u1'), 'progress', 'u1');
  await assertFails(updateDoc(d, { data: '{}', rev: 7, updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(d, { data: '{}', rev: 9, updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(d, { data: '{}', rev: 6, updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(d, { data: '{}', rev: 8, extra: 1, updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(d, { data: '{}', rev: 8, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(d, { data: '{}', rev: 8, updatedAt: Timestamp.fromDate(new Date('2020-01-01')) }));
  await assertFails(updateDoc(doc(as('u2'), 'progress', 'u1'), { data: '{}', rev: 8, updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(d, { data: { not: 'a string' }, rev: 8, updatedAt: serverTimestamp() }));
});
await t('read own document only; no list of the collection; delete own document only (account deletion)', async () => {
  await seedProgress('u1', 1);
  await assertSucceeds(getDoc(doc(as('u1'), 'progress', 'u1')));
  await assertFails(getDoc(doc(as('u2'), 'progress', 'u1')));
  await assertFails(getDoc(doc(anon(), 'progress', 'u1')));
  await assertFails(getDocs(collection(as('u1'), 'progress')));
  await assertFails(deleteDoc(doc(as('u2'), 'progress', 'u1')));
  await assertFails(deleteDoc(doc(anon(), 'progress', 'u1')));
  await assertSucceeds(deleteDoc(doc(as('u1'), 'progress', 'u1')));
});
await t('a document written by the migration (extra srcAt field) can still be updated by the student, and srcAt cannot be changed by the app', async () => {
  await seed(db => setDoc(doc(db, 'progress', 'u1'), { data: '{"v":1}', rev: 3, device: 'migrate-sb', srcAt: '2026-11-18T10:00:00Z', createdAt: Timestamp.fromDate(new Date('2026-11-01')), updatedAt: Timestamp.fromDate(new Date('2026-11-01')) }));
  const d = doc(as('u1'), 'progress', 'u1');
  await assertFails(updateDoc(d, { data: '{}', rev: 4, srcAt: 'x', updatedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(d, { data: '{"v":1,"ans":{"a":1}}', rev: 4, device: 'web-1', updatedAt: serverTimestamp() }));
});
await t('creating with srcAt is refused (only the migration writes it)', async () => {
  await assertFails(setDoc(doc(as('u1'), 'progress', 'u1'), NEW({ srcAt: 'x' })));
});
await t('data larger than 900000 characters is refused', async () => {
  await assertFails(setDoc(doc(as('u1'), 'progress', 'u1'), NEW({ data: 'x'.repeat(900001) })));
});

console.log('horus chat');
await t('owner can upsert msgs (+by, server updatedAt); not others; not extra fields; not oversized', async () => {
  const d = doc(as('u1'), 'horus_chat', 'u1');
  await assertSucceeds(setDoc(d, { msgs: '[]', by: 'web', updatedAt: serverTimestamp() }));
  await assertSucceeds(setDoc(d, { msgs: '[{"r":"u","t":"hi"}]', by: 'web', updatedAt: serverTimestamp() }, { merge: true }));
  await assertSucceeds(getDoc(d));
  await assertFails(getDoc(doc(as('u2'), 'horus_chat', 'u1')));
  await assertFails(setDoc(doc(as('u2'), 'horus_chat', 'u1'), { msgs: '[]', by: 'web', updatedAt: serverTimestamp() }));
  await assertFails(setDoc(d, { msgs: '[]', by: 'web', updatedAt: serverTimestamp(), extra: 1 }, { merge: true }));
  await assertFails(setDoc(d, { msgs: 'x'.repeat(400001), by: 'web', updatedAt: serverTimestamp() }));
  await assertFails(deleteDoc(doc(as('u2'), 'horus_chat', 'u1')));
  await assertSucceeds(deleteDoc(d));
});

console.log('deleted accounts');
await t('the student writes the tombstone once (own uid, server time only); nobody can read, change or remove it', async () => {
  await assertSucceeds(setDoc(doc(as('u1'), 'deleted_accounts', 'u1'), { at: serverTimestamp() }));
  await assertFails(setDoc(doc(as('u1'), 'deleted_accounts', 'u1'), { at: serverTimestamp() }));                      // second time = update
  await assertFails(setDoc(doc(as('u2'), 'deleted_accounts', 'u9'), { at: serverTimestamp() }));                      // someone else's uid
  await assertFails(setDoc(doc(as('u3'), 'deleted_accounts', 'u3'), { at: Timestamp.fromDate(new Date('2020-01-01')) }));
  await assertFails(setDoc(doc(as('u4'), 'deleted_accounts', 'u4'), { at: serverTimestamp(), extra: 1 }));
  await assertFails(getDoc(doc(as('u1'), 'deleted_accounts', 'u1')));
  await assertFails(deleteDoc(doc(as('u1'), 'deleted_accounts', 'u1')));
  await assertFails(setDoc(doc(anon(), 'deleted_accounts', 'u5'), { at: serverTimestamp() }));
});
await t('after deleteAccount (tombstone), a still-signed-in device cannot re-create progress or chat; others are unaffected', async () => {
  await seed(db => setDoc(doc(db, 'deleted_accounts', 'gone'), { at: Timestamp.fromDate(new Date('2026-11-16')) }));
  await assertFails(setDoc(doc(as('gone'), 'progress', 'gone'), NEW()));
  await assertFails(setDoc(doc(as('gone'), 'horus_chat', 'gone'), { msgs: '[]', by: 'web', updatedAt: serverTimestamp() }));
  await assertSucceeds(setDoc(doc(as('u1'), 'progress', 'u1'), NEW()));
  await assertFails(getDoc(doc(as('u1'), 'deleted_accounts', 'gone')));
});

console.log('everything else is closed');
await t('safety copies: a student reads and deletes only their own (query by uid), never writes; meta and unknown collections are closed', async () => {
  await seed(async db => { await setDoc(doc(db, 'progress_backups', 'u1~daily~1'), { uid: 'u1', reason: 'daily', rev: 1, data: '{}' }); await setDoc(doc(db, 'meta', 'backup'), { st: '{}' }); });
  await assertSucceeds(getDoc(doc(as('u1'), 'progress_backups', 'u1~daily~1')));
  await assertFails(getDoc(doc(as('u2'), 'progress_backups', 'u1~daily~1')));
  await assertSucceeds(getDocs(query(collection(as('u1'), 'progress_backups'), where('uid', '==', 'u1'))));
  await assertFails(getDocs(query(collection(as('u2'), 'progress_backups'), where('uid', '==', 'u1'))));
  await assertFails(getDocs(collection(as('u1'), 'progress_backups')));                                                  // no unfiltered list
  await assertFails(setDoc(doc(as('u1'), 'progress_backups', 'mine'), { uid: 'u1', reason: 'daily', rev: 1, data: '{}' }));
  await assertFails(deleteDoc(doc(as('u2'), 'progress_backups', 'u1~daily~1')));
  await assertSucceeds(deleteDoc(doc(as('u1'), 'progress_backups', 'u1~daily~1')));
  await assertFails(getDoc(doc(as('u1'), 'meta', 'backup'))); await assertFails(setDoc(doc(as('u1'), 'meta', 'backup'), { st: 'x' }));
  await assertFails(setDoc(doc(as('u1'), 'some_new_collection', 'x'), { a: 1 }));
  for (const p of [['horus_passages', 'anatomy-1'], ['horus_cache', 'k'], ['horus_usage', 'u~d']]) { await assertFails(getDoc(doc(as('u1'), ...p))); await assertFails(setDoc(doc(as('u1'), ...p), { n: 2 })); }   // Horus data lives in Supabase now
});

await env.cleanup();
console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
