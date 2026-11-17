/* سيرفر وهمي يحاكي اللي js/cloud.js بيستخدمه من Supabase: تسجيل جوجل (PKCE) + token/refresh/user/logout + جدول progress بصلاحيات الصف (RLS).
   للاختبار بس. node tools/cloud/mock-supabase.js 8790
   تحكّم من الاختبارات:  /__next?email=a@x.com&name=..   المستخدم اللي «جوجل» هيرجّعه في تسجيل الدخول الجاي
                         /__expire?email=..             يبوّظ التوكنات الحالية (401) عشان نجرّب التجديد
                         /__revoke?email=..             يلغي refresh tokens (الجلسة ماتت)
                         /__fail?n=3                    أول n طلبات على /rest بترجع 500
                         /__rows  /__reset  /__log
   حورس (js/horus-chat.js): /functions/v1/horus (GET ?me=1 و POST chat|q) + جدول horus_chat بـ RLS.
                         /__horus?mode=ok|general|long|limit|busy|ai|slow|auth|off&lim=3&delay=0&reset=1   /__horusreqs   /__chat */
'use strict';
const http = require('http'), crypto = require('crypto');
const ANON = 'sb_publishable_testkey';       // new-style publishable key: must go in `apikey` only (a Bearer with it is rejected, like the real platform)
function create() {
  const users = {};                    // email -> {id,email,meta}
  const codes = {};                    // code -> {uid, challenge}
  const access = {};                   // token -> {uid, exp}
  const refresh = {};                  // token -> uid
  const rows = {};                     // uid -> {user_id,data,rev,updated_at,device}
  const backups = [];
  const chat = {};                     // uid -> {user_id,msgs,updated_at}  (horus_chat)
  const hz = { lim: 3, used: {}, mode: 'ok', delay: 0, reqs: [] };
  let next = { email: 'student@example.com', name: 'Student One' };
  let fails = 0; let googleOn = true; const log = [];
  const uid = email => (users[email] || (users[email] = { id: crypto.randomUUID(), email, meta: {} })).id;
  const b64 = b => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  function userObj(email, name) { const u = users[email]; return { id: u.id, email, user_metadata: { full_name: name || next.name, avatar_url: '' } }; }
  function tokens(email, name) {
    const u = users[email], at = 'at_' + crypto.randomBytes(12).toString('hex'), rt = 'rt_' + crypto.randomBytes(12).toString('hex');
    access[at] = { uid: u.id, exp: Date.now() + 3600e3 }; refresh[rt] = u.id;
    return { access_token: at, refresh_token: rt, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor((Date.now() + 3600e3) / 1000), user: userObj(email, name) };
  }
  const authUser = req => { const m = /^Bearer (.+)$/.exec(req.headers.authorization || ''); const a = m && access[m[1]]; return a && a.exp > Date.now() ? a.uid : null; };
  function handle(req, res, body) {
    const u = new URL(req.url, 'http://x'), p = u.pathname, q = u.searchParams;
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization,apikey,content-type,prefer,x-client-info', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS', 'Access-Control-Expose-Headers': '*' };
    const send = (st, o, extra) => { res.writeHead(st, Object.assign({ 'Content-Type': 'application/json' }, cors, extra || {})); res.end(o === undefined ? '' : JSON.stringify(o)); };
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
    log.push(req.method + ' ' + p + (u.search || '').slice(0, 80));
    /* ---- test controls ---- */
    if (p === '/__next') { next = { email: q.get('email'), name: q.get('name') || next.name }; return send(200, { ok: 1 }); }
    if (p === '/__expire') { const id = uid(q.get('email')); Object.keys(access).forEach(t => { if (access[t].uid === id) access[t].exp = 1; }); return send(200, { ok: 1 }); }
    if (p === '/__revoke') { const id = uid(q.get('email')); Object.keys(refresh).forEach(t => { if (refresh[t] === id) delete refresh[t]; }); return send(200, { ok: 1 }); }
    if (p === '/__fail') { fails = +q.get('n') || 0; return send(200, { ok: 1 }); }
    if (p === '/__rows') return send(200, rows);
    if (p === '/__backups') return send(200, backups);
    if (p === '/__log') return send(200, log);
    if (p === '/__prov') { googleOn = q.get('google') !== '0'; return send(200, { ok: 1, googleOn }); }
    if (p === '/__horus') { if (q.get('reset')) { hz.used = {}; hz.reqs.length = 0; hz.mode = 'ok'; hz.delay = 0; hz.lim = 3; } if (q.get('mode')) hz.mode = q.get('mode'); if (q.get('lim')) hz.lim = +q.get('lim'); if (q.get('delay')) hz.delay = +q.get('delay'); return send(200, { ok: 1, hz: { lim: hz.lim, mode: hz.mode, delay: hz.delay } }); }
    if (p === '/__horusreqs') return send(200, hz.reqs);
    if (p === '/__chat') return send(200, chat);
    if (p === '/__reset') { Object.keys(chat).forEach(k => delete chat[k]); hz.used = {}; hz.reqs.length = 0; hz.mode = 'ok'; hz.delay = 0; hz.lim = 3; Object.keys(rows).forEach(k => delete rows[k]); log.length = 0; fails = 0; googleOn = true; backups.length = 0; return send(200, { ok: 1 }); }
    if (p === '/__seed') { const b = JSON.parse(body || '{}'); const id = uid(b.email); rows[id] = { user_id: id, data: b.data, rev: b.rev || 1, updated_at: new Date().toISOString(), device: 'seed' }; return send(200, { ok: 1, id }); }
    if ((req.headers.authorization || '') === 'Bearer ' + ANON) return send(401, { code: 401, message: 'Invalid JWT' });
    /* ---- auth ---- */
    if (p === '/auth/v1/settings') {
      if (req.headers.apikey !== ANON) return send(401, { message: 'No API key found in request' });
      return send(200, { external: { google: googleOn, email: true, github: false }, disable_signup: false, mailer_autoconfirm: false });
    }
    if (p === '/auth/v1/authorize') {
      if (q.get('provider') !== 'google') return send(400, { error: 'unsupported provider' });
      const redirect = q.get('redirect_to'); if (!redirect) return send(400, { error: 'redirect_to required' });
      uid(next.email);
      const code = crypto.randomBytes(10).toString('hex'); codes[code] = { email: next.email, name: next.name, challenge: q.get('code_challenge') || null, method: q.get('code_challenge_method') };
      const to = new URL(redirect); to.searchParams.set('code', code);
      res.writeHead(302, Object.assign({ Location: to.toString() }, cors)); return res.end();
    }
    if (p === '/auth/v1/token') {
      if (req.headers.apikey !== ANON) return send(401, { message: 'No API key found in request' });
      const b = JSON.parse(body || '{}'), gt = q.get('grant_type');
      if (gt === 'pkce') {
        const c = codes[b.auth_code]; if (!c) return send(400, { error: 'invalid_grant', error_description: 'invalid flow state' });
        if (c.challenge) { const want = b64(crypto.createHash('sha256').update(b.code_verifier || '').digest()); if (want !== c.challenge) return send(400, { error: 'invalid_grant', error_description: 'code challenge does not match' }); }
        delete codes[b.auth_code]; return send(200, tokens(c.email, c.name));
      }
      if (gt === 'refresh_token') {
        const id = refresh[b.refresh_token]; if (!id) return send(400, { error: 'invalid_grant', error_description: 'Invalid Refresh Token' });
        delete refresh[b.refresh_token]; const email = Object.keys(users).find(e => users[e].id === id); return send(200, tokens(email));
      }
      return send(400, { error: 'unsupported_grant_type' });
    }
    if (p === '/auth/v1/user') { const id = authUser(req); if (!id) return send(401, { msg: 'invalid JWT' }); const email = Object.keys(users).find(e => users[e].id === id); return send(200, userObj(email)); }
    if (p === '/auth/v1/logout') { const m = /^Bearer (.+)$/.exec(req.headers.authorization || ''); if (m) delete access[m[1]]; return send(204); }
    if (p === '/rest/v1/rpc/delete_my_account') {
      if (req.headers.apikey !== ANON) return send(401, { message: 'No API key found in request' });
      const id = authUser(req); if (!id) return send(401, { code: 'PGRST301', message: 'JWT expired' });
      delete rows[id]; const email = Object.keys(users).find(e => users[e].id === id); if (email) delete users[email];
      Object.keys(access).forEach(t => { if (access[t].uid === id) delete access[t]; }); Object.keys(refresh).forEach(t => { if (refresh[t] === id) delete refresh[t]; });
      return send(204);
    }
    /* ---- horus edge function (يحاكي العقد: tools/horus/edge/src/core.js) ---- */
    if (p === '/functions/v1/horus') {
      if (req.headers.apikey !== ANON) return send(401, { message: 'No API key found in request' });
      const id = authUser(req); if (!id) return send(401, { ok: false, err: 'auth' });
      const left = () => Math.max(0, hz.lim - (hz.used[id] || 0));
      if (req.method === 'GET') return send(200, q.get('me') ? { ok: true, left: left(), lim: hz.lim } : { ok: true, v: 'mock', ready: { gemini: true, db: true } });
      const b = JSON.parse(body || '{}'); hz.reqs.push(b);
      const reply = () => {
        if (hz.mode === 'limit' || left() <= 0) return send(429, { ok: false, err: 'limit', left: 0, lim: hz.lim });
        if (hz.mode === 'busy') return send(503, { ok: false, err: 'busy' });
        if (hz.mode === 'ai') return send(502, { ok: false, err: 'ai' });
        if (hz.mode === 'slow') return send(429, { ok: false, err: 'slow' });
        if (hz.mode === 'auth') return send(401, { ok: false, err: 'auth' });
        if (hz.mode === 'off') return send(503, { ok: false, err: 'off' });
        hz.used[id] = (hz.used[id] || 0) + 1;
        if (hz.mode === 'long' && b.mode !== 'q') {     // a complete, long answer (~6 K chars): the client must show every line and keep it whole
          const items = []; for (let i = 1; i <= 80; i++) items.push('- العنصر ' + i + ' من 80 في القائمة الكاملة، سطر قصير للتأكد إن مفيش حاجة بتتقص LAST' + i);
          return send(200, { ok: true, a: 'بص يا دكترة، دي القائمة كاملة:\n' + items.join('\n'), st: 'book', ss: [{ h: 'Axilla', b: 'Module 101', c: 'Ch 1', p: '36' }], cached: false, left: left(), lim: hz.lim });
        }
        const gen = hz.mode === 'general';
        const ss = gen ? [] : [{ h: 'Glycolysis', b: 'Lippincott Biochemistry', c: 'Ch 8', p: '98' }];
        if (b.mode === 'q') {
          const keys = (b.q && b.q.keys) || [], diff = keys.length && keys[0] !== 'b';
          return send(200, { ok: true, a: (gen ? 'الإجابة غير موجودة بشكل واضح في المصدر المتاح، لذلك الشرح التالي مبني على المعرفة الطبية العامة للذكاء الاصطناعي.\n\n' : '') + 'بص يا دكترة، الإجابة **B** لأن الـ UMN lesion بتزوّد tone.\n- A غلط\n- C غلط', st: gen ? 'general' : 'book', ss, ca: 'B', kd: !!diff, cached: false, left: left(), lim: hz.lim });
        }
        return send(200, { ok: true, a: (gen ? 'الإجابة غير موجودة بشكل واضح في المصدر المتاح، لذلك الشرح التالي مبني على المعرفة الطبية العامة للذكاء الاصطناعي.\n\n' : '') + 'بص يا دكترة، ده رد تجريبي عن «' + String(b.text || '').slice(0, 40) + '».\n\nالنقطة هنا إن الـ **glycolysis** بتحوّل glucose لـ pyruvate:\n- مرحلة الاستثمار\n- مرحلة العائد', st: gen ? 'general' : 'book', ss, cached: false, left: left(), lim: hz.lim });
      };
      if (hz.delay) setTimeout(reply, hz.delay); else reply();
      return;
    }
    if (p === '/rest/v1/horus_chat') {
      if (req.headers.apikey !== ANON) return send(401, { message: 'No API key found in request' });
      const id = authUser(req); if (!id) return send(401, { code: 'PGRST301', message: 'JWT expired' });
      if (req.method === 'GET') { const v = q.get('user_id'); const r = chat[id]; return send(200, (r && (!v || v === 'eq.' + id)) ? [r] : []); }
      if (req.method === 'POST') {
        const b = JSON.parse(body || '{}'); if (b.user_id !== id) return send(403, { code: '42501', message: 'new row violates row-level security policy for table "horus_chat"' });
        if (!Array.isArray(b.msgs) || b.msgs.length > 200 || JSON.stringify(b.msgs).length > 400000) return send(400, { code: 'P0001', message: 'bad msgs' });
        chat[id] = { user_id: id, msgs: b.msgs, updated_at: new Date().toISOString() }; return send(201);
      }
    }
    /* ---- progress table (RLS: auth.uid() = user_id) ---- */
    if (p === '/rest/v1/progress') {
      if (req.headers.apikey !== ANON) return send(401, { message: 'No API key found in request' });
      if (fails > 0) { fails--; return send(500, { message: 'boom' }); }
      const id = authUser(req); if (!id) return send(401, { code: 'PGRST301', message: 'JWT expired' });
      const eq = k => { const v = q.get(k); return v && v.startsWith('eq.') ? v.slice(3) : null; };
      const sel = (r, cols) => { if (!cols || cols === '*') return r; const o = {}; cols.split(',').forEach(c => { o[c] = r[c]; }); return o; };
      if (req.method === 'GET') {
        const f = eq('user_id'); const r = rows[id]; const out = (r && (!f || f === id)) ? [sel(r, q.get('select'))] : [];
        return send(200, out);
      }
      if (req.method === 'POST') {
        const b = JSON.parse(body || '{}'); if (b.user_id !== id) return send(403, { code: '42501', message: 'new row violates row-level security policy for table "progress"' });
        if (rows[id]) return send(409, { code: '23505', message: 'duplicate key value violates unique constraint "progress_pkey"' });
        rows[id] = { user_id: id, data: b.data, rev: b.rev || 1, updated_at: new Date().toISOString(), device: b.device || '' };
        return send(201, [rows[id]]);
      }
      if (req.method === 'PATCH') {
        const f = eq('user_id'), rv = eq('rev'); const r = rows[id];
        if (!r || f !== id || (rv != null && String(r.rev) !== rv)) return send(200, []);
        const b = JSON.parse(body || '{}'); backups.push({ rev: r.rev, n: Object.keys(r.data.ans || {}).length });
        if (b.data !== undefined) r.data = b.data; if (b.rev !== undefined) r.rev = b.rev; if (b.device !== undefined) r.device = b.device; r.updated_at = new Date().toISOString();
        return send(200, [r]);
      }
    }
    send(404, { error: 'not found', path: p });
  }
  return http.createServer((req, res) => { let b = ''; req.on('data', d => b += d); req.on('end', () => { try { handle(req, res, b); } catch (e) { res.writeHead(500); res.end(String(e)); } }); });
}
module.exports = { create, ANON };
if (require.main === module) { const port = +process.argv[2] || 8790; create().listen(port, '127.0.0.1', () => console.log('mock supabase on', port)); }
