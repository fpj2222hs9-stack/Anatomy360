/* Imhotep · Supabase → Firebase migration (the logic; migrate.mjs wires the real Supabase REST + firebase-admin, the tests wire fakes).
   What moves: sign-in users (same uid + Google id), student progress, safety copies, Horus chat.  What does NOT move: Horus counters, shared answer cache and
   the books — Horus keeps running on Supabase (the Firebase free plan has no Cloud Functions), so those stay where they are.
   Modes:  dry-run  reads everything and says what WOULD change (writes nothing)
           apply    copies users, progress, safety copies and Horus chat
           verify   read-only comparison of every Supabase row against what is in Firebase
   Safe to run again and again (the final "delta" run after the cutover does exactly the same thing):
     * an account the student deleted on Firebase (tombstone deleted_accounts/<uid>, written by the site when the student deletes the account) is NEVER brought back
     * a copy that only the migration ever wrote (device/by = migrate-sb) for a user who no longer exists on Supabase is removed (the student deleted the account there)
     * users keep the SAME uid and their Google id (providerData google.com / sub), so on their first Google sign-in Firebase recognises them
     * progress / chat that were never touched by the app on Firebase are refreshed from Supabase (and the revision is bumped so a device that
       read the old one simply re-merges); anything the app already wrote on Firebase is NEVER overwritten (the device holds the superset anyway).
       Each migrated progress document carries srcAt = the Supabase updated_at it was copied from, so a later run can COUNT the students whose Supabase copy
       changed afterwards (supabaseNewer): they are on an old device that has not updated yet; their progress is safe on that device and merges on its first Firebase sign-in.
   PRIVACY: this runs in a public repo's Actions log. It prints counts and 6-char fingerprints only — never emails, uids, answers or book text. */
import crypto from 'crypto';

const MARK = 'migrate-sb';
const MAX_BYTES = 1000000;                      // Firestore's limit is 1,048,576 BYTES per document (Arabic text is 2 bytes per character)
const bytes = s => Buffer.byteLength(String(s), 'utf8');
const isExists = e => !!e && (e.code === 6 || /ALREADY_EXISTS|already exists/i.test(String(e.message)));
const errCode = e => String((e && (e.code || e.name)) || 'error').slice(0, 40);        // never print e.message: Firestore puts document paths (uids) in it
const fp = s => crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 6);
const canon = v => JSON.stringify(sortKeys(v));
function sortKeys(v) { if (Array.isArray(v)) return v.map(sortKeys); if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map(k => [k, sortKeys(v[k])])); return v; }
const ms = t => (t && typeof t.toMillis === 'function') ? t.toMillis() : (t instanceof Date ? t.getTime() : (t ? new Date(t).getTime() : 0));
const D = iso => (iso ? new Date(iso) : new Date());
const srcAt = r => (r.updated_at ? new Date(r.updated_at).toISOString() : '');
const backupId = (uid, reason, rev) => uid + '~' + reason + '~' + rev;
const bump = (st, k, n) => { st[k] = (st[k] || 0) + (n === undefined ? 1 : n); };

export function userRecord(u) {
  const m = u.user_metadata || u.raw_user_meta_data || {};
  const g = (u.identities || []).find(i => i.provider === 'google');
  const sub = g ? String((g.identity_data && g.identity_data.sub) || g.provider_id || g.id || '') : '';
  const name = m.full_name || m.name || undefined, photo = m.avatar_url || m.picture || undefined;
  const rec = { uid: u.id, email: u.email || undefined, emailVerified: !!u.email_confirmed_at, displayName: name, photoURL: photo };
  if (sub) rec.providerData = [{ uid: sub, providerId: 'google.com', email: u.email || undefined, displayName: name, photoURL: photo }];
  const meta = {}; if (u.created_at) meta.creationTime = new Date(u.created_at).toUTCString(); if (u.last_sign_in_at) meta.lastSignInTime = new Date(u.last_sign_in_at).toUTCString();
  if (meta.creationTime) rec.metadata = meta;
  return { rec, sub };
}

export async function runMigration({ sb, db, auth, mode, log }) {
  log = log || (() => {});
  const W = mode === 'apply';
  const R = { mode, users: {}, progress: {}, backups: {}, chat: {}, problems: [] };
  const problem = (what, id) => { R.problems.push(what + (id ? ' #' + fp(id) : '')); };
  async function existingUser(uid) { try { return await auth.getUser(uid); } catch (e) { if (e && e.code === 'auth/user-not-found') return null; throw e; } }
  async function byGoogle(sub) { try { return await auth.getUserByProviderUid('google.com', sub); } catch (e) { if (e && e.code === 'auth/user-not-found') return null; throw e; } }

  /* ---------------- users ---------------- */
  const users = await sb.users();
  const S = R.users; S.source = users.length;
  const dead = new Set(); (await db.collection('deleted_accounts').get()).forEach(d => dead.add(d.id));
  const isDead = uid => dead.has(String(uid));
  const toImport = [];
  for (const u of users) {
    if (isDead(u.id)) { bump(S, 'deletedOnFirebase'); continue; }
    const { rec, sub } = userRecord(u);
    if (!sub) { bump(S, 'noGoogle'); problem('user without a Google identity (imported with email only)', u.id); }
    const ex = await existingUser(u.id);
    if (ex) {
      bump(S, 'exists');
      const linked = (ex.providerData || []).some(p => p.providerId === 'google.com' && (!sub || p.uid === sub));
      if (mode === 'verify' && sub && !linked) { bump(S, 'mismatch'); problem('user exists but is not linked to the same Google id', u.id); }
      continue;
    }
    if (sub) {
      const other = await byGoogle(sub);
      if (other && other.uid !== u.id) {
        /* someone signed in with this Google account on Firebase BEFORE the import: that created a second, empty account */
        const has = (await db.collection('progress').doc(other.uid).get()).exists || (await db.collection('horus_chat').doc(other.uid).get()).exists;
        if (has) { bump(S, 'conflict'); problem('Google id already used by another Firebase user that has data — needs a human', u.id); continue; }
        if (W) await auth.deleteUser(other.uid);
        bump(S, 'strayRemoved');
      }
    }
    if (mode === 'verify') { bump(S, 'missing'); problem('user missing in Firebase', u.id); continue; }
    toImport.push(rec);
  }
  S.toCreate = toImport.length;
  if (W) {
    for (let i = 0; i < toImport.length; i += 500) {
      const r = await auth.importUsers(toImport.slice(i, i + 500));
      bump(S, 'created', r.successCount || 0);
      (r.errors || []).forEach(e => { bump(S, 'errors'); problem('user import failed: ' + String((e.error && e.error.message) || e.error || '').slice(0, 80), toImport[e.index] && toImport[e.index].uid); });
    }
  }

  /* ---------------- copies of accounts deleted on Supabase after the first run ---------------- */
  if (!users.length) problem('Supabase returned no users — copies of deleted accounts were not checked');
  else if (mode !== 'verify') {
    const live = new Set(users.map(u => String(u.id)));
    const copies = await db.collection('progress').where('device', '==', MARK).select('device').get();
    for (const d of copies.docs) {
      if (live.has(d.id)) continue;
      bump(S, 'removedOnSupabase');
      if (!W) continue;
      const uid = d.id;
      await db.collection('progress').doc(uid).delete();
      const ch = await db.collection('horus_chat').doc(uid).get(); if (ch.exists && ch.data().by === MARK) await db.collection('horus_chat').doc(uid).delete();
      for (const q of [db.collection('progress_backups').where('uid', '==', uid)]) {
        for (;;) { const s = await q.limit(400).get(); if (s.empty) break; const b = db.batch(); s.docs.forEach(x => b.delete(x.ref)); await b.commit(); if (s.size < 400) break; }
      }
      const au = await existingUser(uid); if (au) await auth.deleteUser(uid);
    }
  }

  /* ---------------- progress ---------------- */
  const prog = await sb.table('progress', 'user_id,data,rev,device,created_at,updated_at', 'user_id.asc');
  const P = R.progress; P.source = prog.length;
  for (const r of prog) {
    if (isDead(r.user_id)) { bump(P, 'deletedOnFirebase'); continue; }
    if (!r.data || typeof r.data !== 'object' || Array.isArray(r.data)) { bump(P, 'errors'); problem('progress.data is not an object', r.user_id); continue; }
    const str = JSON.stringify(r.data);
    if (bytes(str) > MAX_BYTES) { bump(P, 'errors'); problem('progress.data too large for one Firestore document (' + bytes(str) + ' bytes)', r.user_id); continue; }
    const ref = db.collection('progress').doc(r.user_id), snap = await ref.get();
    const rev = Number(r.rev) || 1;
    if (mode === 'verify') {          /* is every answer the student has on Supabase ALSO on Firebase? (by question id, not by count; Firebase may have MORE: the device holds the superset) */
      const sk = Object.keys((r.data && r.data.ans) || {});
      let fk = null; if (snap.exists) { try { fk = new Set(Object.keys((JSON.parse(snap.data().data).ans) || {})); } catch (e) { fk = new Set(); } }
      const lack = fk ? sk.filter(k => !fk.has(k)).length : sk.length;
      bump(P, 'sbAnswers', sk.length); bump(P, 'carriedAnswers', sk.length - lack);
      if (lack) { bump(P, 'behindStudents'); bump(P, 'behindAnswers', lack); }
    }
    if (!snap.exists) {
      if (mode === 'verify') { bump(P, 'missing'); problem('progress missing in Firebase', r.user_id); continue; }
      if (W) {
        try { await ref.create({ data: str, rev, device: MARK, srcAt: srcAt(r), createdAt: D(r.created_at), updatedAt: D(r.updated_at) }); }
        catch (e) { if (isExists(e)) { bump(P, 'appWrote'); continue; } bump(P, 'errors'); problem('progress write failed (' + errCode(e) + ')', r.user_id); continue; }   // the app created it a moment ago
      }
      bump(P, 'created'); continue;
    }
    const ex = snap.data();
    if (ex.device !== MARK) {                                                       // the app has written here: never overwrite
      bump(P, 'appWrote');
      if (ex.srcAt && r.updated_at && ms(r.updated_at) > ms(ex.srcAt) + 1000) bump(P, 'supabaseNewer');          // informational: an old device wrote to Supabase after the copy
      continue;
    }
    let same = false; try { same = canon(JSON.parse(ex.data)) === canon(r.data); } catch (e) { /* corrupt: treat as different */ }
    if (same) { bump(P, 'unchanged'); continue; }
    if (mode === 'verify') { bump(P, 'mismatch'); problem('progress differs from Supabase', r.user_id); continue; }
    if (W) {
      /* re-checked inside a transaction: if the app wrote between our read and now, the app wins */
      let res; try {
        res = await db.runTransaction(async tx => {
          const s = await tx.get(ref); if (!s.exists) return 'gone';
          const cur = s.data(); if (cur.device !== MARK) return 'app';
          tx.update(ref, { data: str, rev: Math.max(rev, Number(cur.rev) || 0) + 1, srcAt: srcAt(r), updatedAt: D(r.updated_at) }); return 'ok';
        });
      } catch (e) { bump(P, 'errors'); problem('progress write failed (' + errCode(e) + ')', r.user_id); continue; }
      if (res !== 'ok') { bump(P, 'appWrote'); continue; }
    }
    bump(P, 'updated');
  }

  /* ---------------- safety copies ---------------- */
  const bks = await sb.table('progress_backups', 'user_id,data,rev,reason,taken_at', 'id.asc');
  const B = R.backups; B.source = bks.length;
  for (const r of bks) {
    if (isDead(r.user_id)) { bump(B, 'deletedOnFirebase'); continue; }
    const id = backupId(r.user_id, r.reason, r.rev), ref = db.collection('progress_backups').doc(id), snap = await ref.get();
    if (snap.exists) { bump(B, 'exists'); continue; }
    const bstr = JSON.stringify(r.data);
    if (bytes(bstr) > MAX_BYTES) { bump(B, 'skipped'); problem('safety copy too large for one Firestore document (skipped)', r.user_id); continue; }
    if (mode === 'verify') { bump(B, 'missing'); problem('safety copy missing', r.user_id); continue; }
    if (W) await ref.set({ uid: r.user_id, reason: r.reason, rev: Number(r.rev) || 0, data: bstr, takenAt: D(r.taken_at) });
    bump(B, 'created');
  }

  /* ---------------- Horus chat ---------------- */
  const chats = await sb.table('horus_chat', 'user_id,msgs,updated_at', 'user_id.asc');
  const C = R.chat; C.source = chats.length;
  for (const r of chats) {
    if (isDead(r.user_id)) { bump(C, 'deletedOnFirebase'); continue; }
    const str = JSON.stringify(r.msgs || []);
    const ref = db.collection('horus_chat').doc(r.user_id), snap = await ref.get();
    if (!snap.exists) {
      if (mode === 'verify') { bump(C, 'missing'); problem('chat missing in Firebase', r.user_id); continue; }
      if (W) {
        try { await ref.create({ msgs: str, by: MARK, updatedAt: D(r.updated_at) }); }
        catch (e) { if (isExists(e)) { bump(C, 'appWrote'); continue; } bump(C, 'errors'); problem('chat write failed (' + errCode(e) + ')', r.user_id); continue; }
      }
      bump(C, 'created'); continue;
    }
    const ex = snap.data();
    if (ex.by !== MARK) { bump(C, 'appWrote'); continue; }
    let same = false; try { same = canon(JSON.parse(ex.msgs)) === canon(r.msgs || []); } catch (e) { /* ignore */ }
    if (same) { bump(C, 'unchanged'); continue; }
    if (mode === 'verify') { bump(C, 'mismatch'); problem('chat differs from Supabase', r.user_id); continue; }
    if (W) {
      let res; try {
        res = await db.runTransaction(async tx => {
          const s = await tx.get(ref); if (!s.exists) return 'gone';
          if (s.data().by !== MARK) return 'app';
          tx.update(ref, { msgs: str, updatedAt: D(r.updated_at) }); return 'ok';
        });
      } catch (e) { bump(C, 'errors'); problem('chat write failed (' + errCode(e) + ')', r.user_id); continue; }
      if (res !== 'ok') { bump(C, 'appWrote'); continue; }
    }
    bump(C, 'updated');
  }

  /* ---------------- summary ---------------- */
  if (mode === 'dry-run') log('(dry-run: nothing was written; "created"/"updated" below are what WOULD change)');
  for (const k of ['users', 'progress', 'backups', 'chat']) log(k.padEnd(9) + JSON.stringify(R[k]));
  if (mode === 'verify' && R.progress.sbAnswers !== undefined) {
    const P2 = R.progress;
    log('ANSWERS on Supabase ' + P2.sbAnswers + ' · also on Firebase ' + (P2.carriedAnswers || 0) + (P2.behindStudents ? ' · MISSING on Firebase ' + P2.behindAnswers + ' answers of ' + P2.behindStudents + ' students (an old device that has not merged yet, or Firebase holds an older copy — see the runbook)' : ' · nothing missing'));
  }
  R.problems.forEach(p => log('PROBLEM ' + p));
  const bad = (R.users.mismatch || 0) + (R.users.missing || 0) + (R.users.conflict || 0) + (R.users.errors || 0) + ['progress', 'backups', 'chat'].reduce((n, k) => n + (R[k].mismatch || 0) + (R[k].missing || 0) + (R[k].errors || 0), 0);
  R.ok = bad === 0; log(R.ok ? 'RESULT ok' : 'RESULT needs attention (' + bad + ')');
  return R;
}
