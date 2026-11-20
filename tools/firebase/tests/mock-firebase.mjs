/* A local stand-in for what js/cloud-fb.js talks to on the Spark plan: Firebase Auth (Identity Toolkit + securetoken; ID tokens are JWT-shaped with auth_time),
   Firestore REST with OUR security rules re-implemented in JS (same decisions as firestore.rules), a scripted Horus at /sb/functions/v1/horus (in production Horus is the
   Supabase Edge Function that verifies the Firebase token; the REAL handler + verifier are covered by tools/horus/tests/firebase.test.mjs), and a fake Google sign-in.
   For the browser tests only:  node mock-firebase.mjs 8791
   Test controls (GET): /__next?email&name  /__import?email&uid  /__expire?email  /__revoke?email  /__stale?email (next refresh gives an OLD auth_time)  /__fail?n
                        /__quota?on=1|0 (every Firestore call answers 429 RESOURCE_EXHAUSTED)  /__rows  /__chat  /__backups  /__tombs  /__reset  /__log  /__prov?google=0|1  /__keeptokens?on=1
                        /__seedbackup?email&n  /__horus?mode=ok|general|limit|busy|ai|slow|auth|off&lim=3&delay=ms&reset=1  /__horusreqs  /__users   (POST) /__seed {email,data,rev}
   The browser reaches the three googleapis hosts through Playwright routes that forward to /g/<host>/…, and Google's authorize page through /__google.
   The site is configured with url: <this server>/sb (so Horus = <this server>/sb/functions/v1/horus) and any non-empty anon key. */
import http from 'http';
import crypto from 'crypto';
import { makeFakeFirestore } from './fake-firestore.mjs';

export const API_KEY = 'test-api-key', PROJECT = 'imhotep-test', CLIENT_ID = 'test-client.apps.googleusercontent.com', ANON = 'sb_publishable_test';
const b64 = b => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const nowS = () => Math.floor(Date.now() / 1000);

export function create() {
  const fsx = makeFakeFirestore();
  const users = {};                                   // email -> {uid, sub, email, name}
  let keepTok = false, quota = false;
  const access = {}, refresh = {};                    // id token -> {uid, exp} / refresh token -> {uid, authTime}
  const log = []; let next = { email: 'student@example.com', name: 'Student One' }, fails = 0, googleOn = true;
  const hz = { mode: 'ok', lim: 3, reqs: [], used: {}, delay: 0 };
  const userBy = uid => Object.values(users).find(u => u.uid === uid);
  const ensure = email => users[email] || (users[email] = { uid: crypto.randomUUID(), sub: 'g-' + email, email, name: '' });
  const idToken = (u, authTime) => {
    const pl = { iss: 'https://securetoken.google.com/' + PROJECT, aud: PROJECT, sub: u.uid, user_id: u.uid, auth_time: authTime, iat: nowS(), exp: nowS() + 3600, email: u.email, firebase: { sign_in_provider: 'google.com', identities: {} }, jti: crypto.randomBytes(6).toString('hex') };
    const t = [b64(JSON.stringify({ alg: 'RS256', kid: 'mock', typ: 'JWT' })), b64(JSON.stringify(pl)), 'sig'].join('.'); access[t] = { uid: u.uid, exp: Date.now() + 3600e3 }; return t;
  };
  const mint = (u, authTime) => { const rt = 'rt_' + crypto.randomBytes(10).toString('hex'); refresh[rt] = { uid: u.uid, authTime: authTime || nowS() }; return { at: idToken(u, refresh[rt].authTime), rt }; };
  const tokenUid = t => (access[t] && access[t].exp > Date.now()) ? access[t].uid : null;
  const authUid = req => { const m = /^Bearer (.+)$/.exec(req.headers.authorization || ''); return m ? tokenUid(m[1]) : null; };
  const claims = t => { try { return JSON.parse(Buffer.from(String(t).split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()); } catch (e) { return null; } };

  const gerr = (code, status, message) => ({ error: { code, status, message } });
  const ts = t => (t && typeof t.toMillis === 'function') ? new Date(t.toMillis()).toISOString() : t;
  const toDoc = (col, id, d, mask) => {
    const fields = {};
    for (const [k, v] of Object.entries(d)) {
      if (mask && !mask.includes(k)) continue;
      if (typeof v === 'string') fields[k] = { stringValue: v }; else if (typeof v === 'number') fields[k] = { integerValue: String(v) };
      else if (v && typeof v.toMillis === 'function') fields[k] = { timestampValue: ts(v) };
    }
    return { name: 'projects/' + PROJECT + '/databases/(default)/documents/' + col + '/' + id, fields, createTime: new Date().toISOString(), updateTime: new Date().toISOString() };
  };
  const val = f => f === undefined ? undefined : (f.stringValue !== undefined ? f.stringValue : f.integerValue !== undefined ? Number(f.integerValue) : f.timestampValue !== undefined ? f.timestampValue : undefined);

  /* our firestore.rules, in JS: returns true when the write is allowed */
  function allowed(uid, col, id, exists, cur, patch, transforms) {
    if (!uid) return false;
    const tf = new Set((transforms || []).map(t => t.fieldPath));
    if (col === 'deleted_accounts') return id === uid && !exists && Object.keys(patch).length === 0 && tf.size === 1 && tf.has('at');
    if (id !== uid) return false;
    if (!exists && fsx.col('deleted_accounts').has(uid)) return false;                 // deleted_accounts/{uid} tombstone: no re-creation
    const merged = Object.assign({}, cur || {}, patch);
    const keys = new Set([...Object.keys(merged), ...tf]);
    if (col === 'progress') {
      const ok = ['data', 'rev', 'device', 'createdAt', 'updatedAt'];
      if ([...keys].some(k => !ok.includes(k))) return false;
      if (typeof merged.data !== 'string' || merged.data.length < 2 || merged.data.length > 900000) return false;
      if (!Number.isInteger(merged.rev)) return false;
      if (merged.device !== undefined && (typeof merged.device !== 'string' || merged.device.length > 100)) return false;
      if (!tf.has('updatedAt')) return false;
      if (!exists) return merged.rev === 1 && ['data', 'rev', 'createdAt', 'updatedAt'].every(k => keys.has(k)) && tf.has('createdAt');
      const changed = Object.keys(patch).concat([...tf]); if (changed.some(k => !['data', 'rev', 'device', 'updatedAt'].includes(k))) return false;
      return merged.rev === cur.rev + 1;
    }
    if (col === 'horus_chat') {
      if ([...keys].some(k => !['msgs', 'by', 'updatedAt'].includes(k))) return false;
      if (typeof merged.msgs !== 'string' || merged.msgs.length > 400000) return false;
      if (merged.by !== undefined && (typeof merged.by !== 'string' || merged.by.length > 40)) return false;
      return tf.has('updatedAt');
    }
    return false;
  }
  const mayDelete = (uid, col, id) => (['progress', 'horus_chat'].includes(col) && id === uid) || (col === 'progress_backups' && !!fsx.col(col).get(id) && fsx.col(col).get(id).uid === uid);
  const parseName = nm => { const m = /\/documents\/([^/]+)\/(.+)$/.exec(nm || ''); return m ? { col: m[1], id: decodeURIComponent(m[2]) } : null; };

  async function handle(req, res, body) {
    const u = new URL(req.url, 'http://x'), p = u.pathname, q = u.searchParams;
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization,content-type,apikey,x-client-version,x-goog-api-client', 'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS' };
    const send = (st, o, extra) => { res.writeHead(st, Object.assign({ 'content-type': 'application/json' }, cors, extra || {})); res.end(o === undefined ? '' : JSON.stringify(o)); };
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
    log.push(req.method + ' ' + p.replace(/^\/g\//, '') + (q.get('mask.fieldPaths') ? '?mask' : '') + (p.includes('token') && /grant_type=refresh_token/.test(body || '') ? ' grant_type=refresh_token' : ''));

    /* ---- test controls ---- */
    if (p === '/__next') { next = { email: q.get('email'), name: q.get('name') || next.name }; return send(200, { ok: 1 }); }
    if (p === '/__import') { const e = q.get('email'); users[e] = { uid: q.get('uid'), sub: 'g-' + e, email: e, name: '' }; return send(200, { ok: 1 }); }
    if (p === '/__expire') { const u2 = users[q.get('email')]; Object.keys(access).forEach(t => { if (u2 && access[t].uid === u2.uid) access[t].exp = 1; }); return send(200, { ok: 1 }); }
    if (p === '/__stale') { const u2 = users[q.get('email')]; Object.keys(access).forEach(t => { if (u2 && access[t].uid === u2.uid) access[t].exp = 1; }); Object.keys(refresh).forEach(t => { if (u2 && refresh[t].uid === u2.uid) refresh[t].authTime = nowS() - 3600; }); return send(200, { ok: 1 }); }
    if (p === '/__keeptokens') { keepTok = q.get('on') === '1'; return send(200, { ok: 1 }); }      // real Firebase: a deleted user's ID token stays valid until it expires (refresh tokens die)
    if (p === '/__revoke') { const u2 = users[q.get('email')]; Object.keys(refresh).forEach(t => { if (u2 && refresh[t].uid === u2.uid) delete refresh[t]; }); return send(200, { ok: 1 }); }
    if (p === '/__fail') { fails = +q.get('n') || 0; return send(200, { ok: 1 }); }
    if (p === '/__quota') { quota = q.get('on') === '1'; return send(200, { ok: 1, quota }); }
    if (p === '/__prov') { googleOn = q.get('google') !== '0'; return send(200, { ok: 1, googleOn }); }
    if (p === '/__log') return send(200, log);
    if (p === '/__users') return send(200, users);
    if (p === '/__rows') { const o = {}; for (const [id, d] of fsx.col('progress')) { let data = null; try { data = JSON.parse(d.data); } catch (e) { /* corrupt */ } o[id] = { user_id: id, data, rev: d.rev, device: d.device, updated_at: ts(d.updatedAt) }; } return send(200, o); }
    if (p === '/__chat') { const o = {}; for (const [id, d] of fsx.col('horus_chat')) { let m = null; try { m = JSON.parse(d.msgs); } catch (e) { /* ignore */ } o[id] = { user_id: id, msgs: m, by: d.by }; } return send(200, o); }
    if (p === '/__backups') return send(200, [...fsx.col('progress_backups').values()]);
    if (p === '/__tombs') return send(200, [...fsx.col('deleted_accounts').keys()]);
    if (p === '/__seedbackup') { const us = users[q.get('email')]; const n = +q.get('n') || 1; for (let i = 0; i < n; i++) fsx.put('progress_backups', us.uid + '~daily~' + i, { uid: us.uid, reason: 'daily', rev: i + 1, data: '{"v":1}', takenAt: new fsx.Ts(Date.now()) }); fsx.put('progress_backups', 'someone-else~daily~0', { uid: 'someone-else', reason: 'daily', rev: 1, data: '{"v":1}', takenAt: new fsx.Ts(Date.now()) }); return send(200, { ok: 1 }); }
    if (p === '/__horus') {
      if (q.get('reset')) { hz.mode = 'ok'; hz.lim = 3; hz.delay = 0; hz.used = {}; hz.reqs.length = 0; }
      if (q.get('mode')) hz.mode = q.get('mode'); if (q.get('lim')) hz.lim = +q.get('lim'); if (q.get('delay')) hz.delay = +q.get('delay');
      return send(200, { ok: 1, hz: { lim: hz.lim, mode: hz.mode, delay: hz.delay } });
    }
    if (p === '/__horusreqs') return send(200, hz.reqs);
    if (p === '/__reset') { for (const m of fsx.cols.values()) m.clear(); Object.keys(access).forEach(k => delete access[k]); Object.keys(refresh).forEach(k => delete refresh[k]); Object.keys(users).forEach(k => delete users[k]); log.length = 0; fails = 0; keepTok = false; quota = false; googleOn = true; hz.mode = 'ok'; hz.lim = 3; hz.delay = 0; hz.used = {}; hz.reqs.length = 0; return send(200, { ok: 1 }); }
    if (p === '/__seed') { const b = JSON.parse(body || '{}'); const us = ensure(b.email); fsx.put('progress', us.uid, { data: JSON.stringify(b.data), rev: b.rev || 1, device: b.device || 'migrate-sb', createdAt: new fsx.Ts(Date.now()), updatedAt: new fsx.Ts(Date.now()) }); return send(200, { ok: 1, uid: us.uid }); }

    /* ---- fake Google: the authorize page answers with a redirect carrying an id_token (what response_type=id_token does) ---- */
    if (p === '/__google') {
      const us = ensure(next.email); us.name = next.name;
      const redirect = q.get('redirect_uri'), nonce = q.get('nonce'), state = q.get('state');
      if (!redirect || !nonce || !state || q.get('response_type') !== 'id_token') return send(400, { error: 'bad authorize request' });
      const payload = { iss: 'https://accounts.google.com', aud: q.get('client_id'), sub: us.sub, email: us.email, name: us.name, picture: 'https://example.invalid/p.png', nonce, iat: nowS(), exp: nowS() + 3600 };
      const jwt = [b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' })), b64(JSON.stringify(payload)), 'sig'].join('.');
      return send(200, { location: redirect + '#id_token=' + jwt + '&state=' + encodeURIComponent(state) });
    }

    /* ---- Firebase Auth ---- */
    if (p.startsWith('/g/identitytoolkit.googleapis.com/') && q.get('key') !== API_KEY) return send(400, gerr(400, 'INVALID_ARGUMENT', 'API key not valid. Please pass a valid API key.'));
    if (p === '/g/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp') {
      if (!googleOn) return send(400, gerr(400, 'INVALID_ARGUMENT', 'OPERATION_NOT_ALLOWED'));
      const b = JSON.parse(body || '{}'), m = /id_token=([^&]+)/.exec(b.postBody || ''); if (!m || !/providerId=google\.com/.test(b.postBody)) return send(400, gerr(400, 'INVALID_ARGUMENT', 'INVALID_IDP_RESPONSE'));
      let pl; try { pl = JSON.parse(Buffer.from(decodeURIComponent(m[1]).split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()); } catch (e) { return send(400, gerr(400, 'INVALID_ARGUMENT', 'INVALID_IDP_RESPONSE')); }
      const us = Object.values(users).find(x => x.sub === pl.sub) || ensure(pl.email); us.name = pl.name || us.name;
      const t = mint(us);
      return send(200, { kind: 'identitytoolkit#VerifyAssertionResponse', idToken: t.at, refreshToken: t.rt, expiresIn: '3600', localId: us.uid, email: us.email, displayName: us.name, photoUrl: 'https://example.invalid/p.png', isNewUser: false });
    }
    if (p === '/g/identitytoolkit.googleapis.com/v1/accounts:lookup') return send(400, gerr(400, 'INVALID_ARGUMENT', 'INVALID_ID_TOKEN'));
    if (p === '/g/identitytoolkit.googleapis.com/v1/accounts:delete') {
      const b = JSON.parse(body || '{}'), uid = tokenUid(b.idToken), c = claims(b.idToken);
      if (!uid && !(c && c.sub && !userBy(c.sub))) return send(400, gerr(400, 'INVALID_ARGUMENT', 'INVALID_ID_TOKEN'));
      if (c && nowS() - c.auth_time > 300) return send(400, gerr(400, 'INVALID_ARGUMENT', 'CREDENTIAL_TOO_OLD_LOGIN_AGAIN'));
      const us = userBy(c.sub); if (!us) return send(400, gerr(400, 'INVALID_ARGUMENT', 'USER_NOT_FOUND'));
      delete users[us.email]; if (!keepTok) Object.keys(access).forEach(t => { if (access[t].uid === us.uid) delete access[t]; }); Object.keys(refresh).forEach(t => { if (refresh[t].uid === us.uid) delete refresh[t]; });
      return send(200, { kind: 'identitytoolkit#DeleteAccountResponse' });
    }
    if (p === '/g/securetoken.googleapis.com/v1/token') {
      if (q.get('key') !== API_KEY) return send(400, gerr(400, 'INVALID_ARGUMENT', 'API key not valid. Please pass a valid API key.'));
      const rt = new URLSearchParams(body || '').get('refresh_token'), r0 = refresh[rt]; if (!r0 || !userBy(r0.uid)) return send(400, gerr(400, 'INVALID_ARGUMENT', 'TOKEN_EXPIRED'));
      const at = idToken(userBy(r0.uid), r0.authTime);
      return send(200, { access_token: at, id_token: at, refresh_token: rt, expires_in: '3600', token_type: 'Bearer', user_id: r0.uid, project_id: '1' });
    }

    /* ---- Firestore REST (rules enforced) ---- */
    const FSP = '/g/firestore.googleapis.com/v1/projects/' + PROJECT + '/databases/(default)/documents';
    if (p.startsWith('/g/firestore.googleapis.com/')) {
      if (quota) return send(429, gerr(429, 'RESOURCE_EXHAUSTED', 'Quota exceeded.'));
      if (fails > 0) { fails--; return send(503, gerr(503, 'UNAVAILABLE', 'boom')); }
      const uid = authUid(req); if (!uid) return send(401, gerr(401, 'UNAUTHENTICATED', 'Request had invalid authentication credentials.'));
      if (req.method === 'GET' && p.startsWith(FSP + '/')) {
        const [col, rawId] = p.slice(FSP.length + 1).split('/'), id = decodeURIComponent(rawId || '');
        if (!['progress', 'horus_chat'].includes(col) || id !== uid) return send(403, gerr(403, 'PERMISSION_DENIED', 'Missing or insufficient permissions.'));
        const d = fsx.col(col).get(id); if (!d) return send(404, gerr(404, 'NOT_FOUND', 'Document not found'));
        return send(200, toDoc(col, id, d, q.getAll('mask.fieldPaths').length ? q.getAll('mask.fieldPaths') : null));
      }
      if (req.method === 'POST' && p === FSP + ':runQuery') {
        const sq = (JSON.parse(body || '{}').structuredQuery) || {}, from = ((sq.from || [])[0] || {}).collectionId, ff = sq.where && sq.where.fieldFilter;
        if (from !== 'progress_backups' || !ff || ff.field.fieldPath !== 'uid' || ff.op !== 'EQUAL' || val(ff.value) !== uid) return send(403, gerr(403, 'PERMISSION_DENIED', 'Missing or insufficient permissions.'));
        const out = []; for (const [id, d] of fsx.col('progress_backups')) if (d.uid === uid) out.push({ document: toDoc('progress_backups', id, { uid: d.uid }), readTime: new Date().toISOString() });
        return send(200, out.length ? out : [{ readTime: new Date().toISOString() }]);
      }
      if (req.method === 'POST' && p === FSP + ':commit') {
        const writes = JSON.parse(body || '{}').writes || [], plan = [];
        for (const w of writes) {
          if (w.delete) { const n = parseName(w.delete); if (!n || !mayDelete(uid, n.col, n.id)) return send(403, gerr(403, 'PERMISSION_DENIED', 'Missing or insufficient permissions.')); plan.push({ del: n }); continue; }
          const n = parseName(w.update && w.update.name); if (!n) return send(400, gerr(400, 'INVALID_ARGUMENT', 'bad name'));
          const cur = fsx.col(n.col).get(n.id) || null, patch = {}, mask = w.updateMask && w.updateMask.fieldPaths;
          for (const [k, f] of Object.entries((w.update && w.update.fields) || {})) if (!mask || mask.includes(k)) patch[k] = val(f);
          if (!allowed(uid, n.col, n.id, !!cur, cur, patch, w.updateTransforms)) return send(403, gerr(403, 'PERMISSION_DENIED', 'Missing or insufficient permissions.'));
          if (w.currentDocument && w.currentDocument.exists === false && cur) return send(409, gerr(409, 'ALREADY_EXISTS', 'Document already exists'));
          if (w.currentDocument && w.currentDocument.exists === true && !cur) return send(404, gerr(404, 'NOT_FOUND', 'No document to update'));
          const out = Object.assign({}, cur || {}, patch); for (const t of (w.updateTransforms || [])) out[t.fieldPath] = new fsx.Ts(Date.now());
          plan.push({ set: n, out });
        }
        for (const s of plan) { if (s.del) fsx.col(s.del.col).delete(s.del.id); else fsx.col(s.set.col).set(s.set.id, s.out); }
        return send(200, { writeResults: plan.map(() => ({ updateTime: new Date().toISOString() })), commitTime: new Date().toISOString() });
      }
      return send(404, gerr(404, 'NOT_FOUND', 'no such path ' + p));
    }

    /* ---- Horus: in production this is the Supabase Edge Function at <supabase url>/functions/v1/horus; here a scripted stand-in (same contract and texts as tools/cloud/mock-supabase.js) ---- */
    if (p === '/sb/functions/v1/horus') {
      if (!req.headers.apikey) return send(401, { code: 401, message: 'Missing authorization header' });
      const id = authUid(req); if (!id) return send(401, { ok: false, err: 'auth' });
      const left = () => Math.max(0, hz.lim - (hz.used[id] || 0));
      if (req.method === 'GET') return send(200, q.get('me') ? { ok: true, left: left(), lim: hz.lim } : { ok: true, v: 'mock', ready: { gemini: true, db: true, fb: true } });
      const b = JSON.parse(body || '{}'); hz.reqs.push(b);
      const reply = () => {
        if (hz.mode === 'limit' || left() <= 0) return send(429, { ok: false, err: 'limit', left: 0, lim: hz.lim });
        if (hz.mode === 'busy') return send(503, { ok: false, err: 'busy' });
        if (hz.mode === 'ai') return send(502, { ok: false, err: 'ai' });
        if (hz.mode === 'slow') return send(429, { ok: false, err: 'slow' });
        if (hz.mode === 'auth') return send(401, { ok: false, err: 'auth' });
        if (hz.mode === 'off') return send(503, { ok: false, err: 'off' });
        hz.used[id] = (hz.used[id] || 0) + 1;
        const gen = hz.mode === 'general';
        const ss = gen ? [] : [{ h: 'Glycolysis', b: 'Lippincott Biochemistry', c: 'Ch 8', p: '98' }];
        const pre = gen ? 'الإجابة غير موجودة بشكل واضح في المصدر المتاح، لذلك الشرح التالي مبني على المعرفة الطبية العامة للذكاء الاصطناعي.\n\n' : '';
        if (b.mode === 'q') {
          const keys = (b.q && b.q.keys) || [], diff = keys.length && keys[0] !== 'b';
          return send(200, { ok: true, a: pre + 'بص يا دكترة، الإجابة **B** لأن الـ UMN lesion بتزوّد tone.\n- A غلط\n- C غلط', st: gen ? 'general' : 'book', ss, ca: 'B', kd: !!diff, cached: false, left: left(), lim: hz.lim });
        }
        return send(200, { ok: true, a: pre + 'بص يا دكترة، ده رد تجريبي عن «' + String(b.text || '').slice(0, 40) + '».\n\nالنقطة هنا إن الـ **glycolysis** بتحوّل glucose لـ pyruvate:\n- مرحلة الاستثمار\n- مرحلة العائد', st: gen ? 'general' : 'book', ss, cached: false, left: left(), lim: hz.lim });
      };
      if (hz.delay) setTimeout(reply, hz.delay); else reply();
      return;
    }
    send(404, { error: 'not found', path: p });
  }
  const server = http.createServer((req, res) => { let b = ''; req.on('data', d => b += d); req.on('end', () => { handle(req, res, b).catch(e => { try { res.writeHead(500); res.end(String(e && e.stack || e)); } catch (x) { /* closed */ } }); }); });
  return { server, fsx, users };
}
if (import.meta.url === 'file://' + process.argv[1]) { const port = +process.argv[2] || 8791; create().server.listen(port, '127.0.0.1', () => console.log('mock firebase on', port)); }
