import assert from 'assert';
import { makeFakeFirestore } from './fake-firestore.mjs';
import { runBackup, ansCount, slotOf, backupId } from '../backup/backup-core.mjs';

let pass = 0, fail = 0;
async function t(name, fn) { try { await fn(); pass++; console.log('  ok  ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + '\n      ' + (e && e.stack || e).split('\n').slice(0, 5).join('\n      ')); } }
const DAY = 86400000, T0 = Date.UTC(2026, 10, 20, 8, 30);            // 20 Nov 2026 08:30 UTC
const ans = n => { const a = {}; for (let i = 0; i < n; i++) a['q' + i] = { c: 1, t: i }; return JSON.stringify({ v: 1, ans: a, name: 'Student' }); };
function setup(clock) {
  const f = makeFakeFirestore({ now: () => clock.t });
  const put = (uid, n, at, rev) => f.put('progress', uid, { data: ans(n), rev: rev || 1, device: 'web-1', createdAt: new Date(at), updatedAt: new Date(at) });
  const run = (extra) => { const lines = []; return runBackup(Object.assign({ db: f.db, FV: f.FV, now: clock.t, log: l => lines.push(l) }, extra || {})).then(r => { r.lines = lines; return r; }); };
  return { f, put, run };
}
const slots = f => [...f.col('progress_backups').keys()].sort();

console.log('daily backup');
await t('first run copies every student (answers counted from the JSON), writes meta; the copy is exactly the student data', async () => {
  const clock = { t: T0 }; const s = setup(clock); s.put('u1', 50, T0 - DAY, 4); s.put('u2', 10, T0 - 3 * DAY, 1);
  const r = await s.run(); assert(r.ok); assert.equal(r.first, true); assert.equal(r.examined, 2); assert.equal(r.copied, 2);
  const b = s.f.dump('progress_backups')[backupId('u1', slotOf(T0))]; assert.equal(b.uid, 'u1'); assert.equal(b.reason, 'daily'); assert.equal(b.rev, 4); assert.equal(b.data, s.f.dump('progress').u1.data);
  assert.deepEqual(Object.keys(b).sort(), ['data', 'reason', 'rev', 'takenAt', 'uid']);
  assert(s.f.col('meta').has('backup'));
  assert.equal(ansCount(ans(7)), 7); assert.equal(ansCount('not json'), -1); assert.equal(ansCount('{"v":1}'), 0);
});
await t('only students who changed since the last run are read and copied (a quiet day costs nothing)', async () => {
  const clock = { t: T0 }; const s = setup(clock); s.put('u1', 50, T0 - DAY); s.put('u2', 10, T0 - DAY); await s.run();
  clock.t = T0 + DAY; let r = await s.run(); assert.equal(r.examined, 0); assert.equal(r.copied, 0); assert(r.ok);
  s.put('u2', 12, clock.t - 1000, 2); clock.t += 1000;
  r = await s.run(); assert.equal(r.examined, 1); assert.equal(r.copied, 1);
  assert.equal(JSON.parse(s.f.dump('progress_backups')[backupId('u2', slotOf(clock.t))].data).ans.q11.c, 1);
});
await t('three rotating slots: the 4th day overwrites the 1st day only; older good copies of other days survive', async () => {
  const clock = { t: T0 }; const s = setup(clock); s.put('u1', 50, T0 - DAY, 1); await s.run();
  for (let d = 1; d <= 3; d++) { clock.t = T0 + d * DAY; s.put('u1', 50 + d, clock.t - 1000, 1 + d); await s.run(); }
  assert.equal(s.f.col('progress_backups').size, 3, slots(s.f).join(','));
  const revs = Object.values(s.f.dump('progress_backups')).map(x => x.rev).sort(); assert.deepEqual(revs, [2, 3, 4], 'rev 1 (day 0) was replaced by rev 4 (day 3)');
});
await t('shrink guard: a student whose answers fall by more than 30% keeps the older copies; accepted as a real reset after 7 runs', async () => {
  const clock = { t: T0 }; const s = setup(clock); s.put('u1', 100, T0 - DAY, 5); await s.run();
  clock.t = T0 + DAY; s.put('u1', 20, clock.t - 1000, 6);                       // a wiped device overwrote the account
  let r = await s.run(); assert.equal(r.shrinkHeld, 1); assert.equal(r.copied, 0); assert(r.problems.some(p => /lost more than 30%/.test(p)));
  const kept = s.f.dump('progress_backups')[backupId('u1', slotOf(T0))]; assert.equal(kept.rev, 5); assert.equal(ansCount(kept.data), 100, 'the good copy is still there');
  for (let d = 2; d <= 7; d++) { clock.t = T0 + d * DAY; s.put('u1', 20, clock.t - 1000, 5 + d); r = await s.run(); assert.equal(r.shrinkHeld, 1, 'run ' + d); }
  clock.t = T0 + 8 * DAY; s.put('u1', 20, clock.t - 1000, 20); r = await s.run(); assert.equal(r.shrinkHeld, 0); assert.equal(r.copied, 1, 'accepted after 7 held runs');
});
await t('a small drop is a normal copy: <= 20 answers lost (even if it is most of a small account) OR less than 30% lost', async () => {
  const clock = { t: T0 }; const s = setup(clock); s.put('u1', 100, T0 - DAY); s.put('u2', 25, T0 - DAY); s.put('u3', 100, T0 - DAY); await s.run();
  clock.t = T0 + DAY;
  s.put('u1', 85, clock.t - 1000);                         // lost 15 (15%)         -> copy
  s.put('u2', 8, clock.t - 1000);                          // lost 17 (68%) but not more than 20 -> copy (a small account being tidied)
  s.put('u3', 75, clock.t - 1000);                         // lost 25 but only 25%  -> copy
  const r = await s.run(); assert.equal(r.shrinkHeld, 0); assert.equal(r.copied, 3);
});
await t('boundary: more than 20 lost AND more than 30% lost is held (25 -> 3)', async () => {
  const clock = { t: T0 }; const s = setup(clock); s.put('u2', 25, T0 - DAY); await s.run();
  clock.t = T0 + DAY; s.put('u2', 3, clock.t - 1000); const r = await s.run(); assert.equal(r.shrinkHeld, 1); assert.equal(r.copied, 0);
});
await t('a failed copy does not advance the state: the next run retries the same window', async () => {
  const clock = { t: T0 }; const s = setup(clock); s.put('u1', 10, T0 - DAY);
  const oc = s.f.db.collection; let fail = true;
  s.f.db.collection = n => { const q = oc(n); if (n === 'progress_backups') { const od = q.doc; q.doc = id => { const ref = od(id), os = ref.set.bind(ref); ref.set = async (...a) => { if (fail) throw Object.assign(new Error('boom at progress_backups/' + id), { code: 14 }); return os(...a); }; return ref; }; } return q; };
  let r = await s.run(); assert.equal(r.ok, false); assert.equal(r.errors, 1); assert(!s.f.col('meta').has('backup'));
  const log = r.lines.join('\n'); assert(/copy failed \(14\)/.test(log) && !log.includes('boom') && !log.includes('u1'), 'error code only');
  fail = false; r = await s.run(); assert(r.ok); assert.equal(r.copied, 1);
});
await t('an unreadable progress document is reported and skipped, the rest still copied', async () => {
  const clock = { t: T0 }; const s = setup(clock); s.put('u1', 10, T0 - DAY); s.f.put('progress', 'bad', { data: '{oops', rev: 1, updatedAt: new Date(T0 - DAY) });
  const r = await s.run(); assert.equal(r.unreadable, 1); assert.equal(r.copied, 1); assert.equal(r.ok, false);
});
await t('selftest mode (only): copies just the named student and leaves the real state alone', async () => {
  const clock = { t: T0 }; const s = setup(clock); s.put('u1', 10, T0 - DAY); s.put('u2', 10, T0 - DAY);
  const r = await s.run({ only: ['u1'] }); assert.equal(r.copied, 1); assert(!s.f.col('meta').has('backup')); assert(!slots(s.f).some(k => k.startsWith('u2')));
});
await t('PRIVACY: the log has counts only (no uid, no answers)', async () => {
  const clock = { t: T0 }; const s = setup(clock); s.put('uid-secret-1', 10, T0 - DAY); const r = await s.run();
  const log = r.lines.join('\n'); assert(!log.includes('uid-secret-1') && !log.includes('Student') && !log.includes('q1'), log);
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
