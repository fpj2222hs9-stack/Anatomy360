/* Imhotep · daily safety copies of every student's progress (replaces the Cloud Function "progressBackup" of the paid plan; the Spark plan has no Cloud Functions).
   Runs from GitHub Actions (workflow "Firebase", action "backup", also on a daily schedule) with the service account, so it bypasses the security rules.
   - Only documents that changed since the last run are read and copied (query on updatedAt), so a quiet day costs almost nothing of the free quota.
   - A copy is progress_backups/<uid>~daily~<0|1|2>: three rotating slots = the last 3 days that student changed something. Older good copies are never pushed out by one bad day.
   - Shrink guard (what the Supabase trigger "shrink" did): if a student's number of answers fell by more than 30% (and more than 20) since their last copy, that day's copy is NOT written,
     so the older good copies survive. After 7 days in a row of the same low number we accept it as a real reset.
   - State lives in ONE small document, meta/backup (last run time + answer count per student). Students cannot read or write it (rules).
   PRIVACY: public repo log => counts only. */
const SLOTS = 3, SHRINK_RATIO = 0.7, SHRINK_MIN_DROP = 20, ACCEPT_AFTER_RUNS = 7, MAX_STATE_BYTES = 900000;
const OVERLAP_MS = 2 * 3600 * 1000;                       // re-read the last 2 hours of the previous run: a late write can never fall between two runs
const ms = t => (t && typeof t.toMillis === 'function') ? t.toMillis() : (t instanceof Date ? t.getTime() : Number(t) || 0);
const errCode = e => String((e && (e.code || e.name)) || 'error').slice(0, 40);

export function ansCount(dataStr) {
  try { const o = JSON.parse(dataStr); return o && o.ans && typeof o.ans === 'object' ? Object.keys(o.ans).length : 0; } catch (e) { return -1; }
}
export const slotOf = nowMs => Math.floor(nowMs / 86400000) % SLOTS;
export const backupId = (uid, slot) => uid + '~daily~' + slot;

/** opts: { db, FV, now (ms), log, only (array of uids, tests / selftest only) } */
export async function runBackup(opts) {
  const { db, FV } = opts, log = opts.log || (() => {}), nowMs = opts.now || Date.now();
  const R = { examined: 0, copied: 0, shrinkHeld: 0, unreadable: 0, errors: 0, first: false, problems: [] };
  const metaRef = db.collection('meta').doc('backup');
  const meta = await metaRef.get();
  let st = {}, last = 0;
  if (meta.exists) { const d = meta.data(); last = ms(d.lastRun); try { st = JSON.parse(d.st || '{}'); } catch (e) { st = {}; } }
  R.first = !last;
  const since = last ? new Date(last - OVERLAP_MS) : new Date(0);
  const slot = slotOf(nowMs);
  let docs;
  if (opts.only) { docs = []; for (const uid of opts.only) { const s = await db.collection('progress').doc(uid).get(); if (s.exists) docs.push(s); } }
  else docs = (await db.collection('progress').where('updatedAt', '>', since).get()).docs;
  const seen = new Set();
  for (const d of docs) {
    const uid = d.id, v = d.data(); R.examined++; seen.add(uid);
    const n = ansCount(v.data);
    if (n < 0) { R.unreadable++; R.problems.push('progress.data unreadable (skipped)'); continue; }
    const prev = st[uid];                                  // [answers at last copy, consecutive held runs]
    if (prev && prev[0] - n > SHRINK_MIN_DROP && n < prev[0] * SHRINK_RATIO && (prev[1] || 0) < ACCEPT_AFTER_RUNS) {
      st[uid] = [prev[0], (prev[1] || 0) + 1]; R.shrinkHeld++; continue;
    }
    try {
      await db.collection('progress_backups').doc(backupId(uid, slot)).set({ uid, reason: 'daily', rev: Number(v.rev) || 0, data: String(v.data || '{}'), takenAt: FV.serverTimestamp() });
      st[uid] = [n, 0]; R.copied++;
    } catch (e) { R.errors++; R.problems.push('copy failed (' + errCode(e) + ')'); }
  }
  if (R.shrinkHeld) R.problems.push(R.shrinkHeld + ' student(s) lost more than 30% of their answers since their last copy: their older copies were kept, today\'s was not written');
  /* keep the state document small: forget students that no longer exist (never touches students seen in this run) */
  let stStr = JSON.stringify(st);
  if (stStr.length > MAX_STATE_BYTES) { for (const k of Object.keys(st)) if (!seen.has(k) && !(st[k][1] > 0)) delete st[k]; stStr = JSON.stringify(st); }
  if (R.errors === 0 && !opts.only) await metaRef.set({ lastRun: new Date(nowMs), st: stStr });                  // a failed copy => do not advance, the next run retries the same window
  else if (opts.only) { /* tests / selftest: leave the real state alone */ }
  log('backup   ' + JSON.stringify({ examined: R.examined, copied: R.copied, shrinkHeld: R.shrinkHeld, unreadable: R.unreadable, errors: R.errors, firstRun: R.first, slot }));
  R.problems.forEach(p => log('PROBLEM ' + p));
  R.ok = R.errors === 0 && R.unreadable === 0;
  log(R.ok ? 'RESULT ok' : 'RESULT needs attention');
  return R;
}
