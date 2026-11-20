/* Imhotep · Horus — the live-chat handler (Supabase Edge Function, also run under Node for the tests).
   POST  {mode:'chat', text, sid, hist:[{r:'u'|'a',t}]}            -> a grounded answer to a free question
   POST  {mode:'q', q:{id,stem,opts,keys,sid}}                     -> an explanation of one question ("ask Horus" fallback)
   GET   ?me=1  (signed in)                                        -> {left, lim}
   GET                                                              -> {ok, ready} (setup check, no secrets)
   Order of work: verify the student's Google session -> shared cache (free) -> daily quota -> books (BM25) -> Gemini -> check -> cache.
   Secrets come from the environment only (GEMINI_API_KEY; the Supabase keys are injected by the platform). Nothing secret is in a file. */
import { buildSources, chatQuery, chatHits, focusedQuery, expandedQuery, runSources, pack, makeSynonyms, arabicRatio, latinTokens } from './retrieve.js';
import { SYNONYM_GROUPS } from './synonyms.js';
import { PV, DISCLOSURE, CHAT_SYSTEM, Q_SYSTEM, REWRITE_SYSTEM, RETRY_AR } from './prompts.js';
import { makeFirebaseVerifier, tokenKind, FbAuthError } from './firebase.js';

const SIDS = ['anatomy', 'histology', 'physiology', 'biochemistry'];
const SUBJ = { anatomy: 'Anatomy and Embryology', histology: 'Histology', physiology: 'Physiology', biochemistry: 'Biochemistry', all: 'Basic medical sciences' };
const SYN = makeSynonyms(SYNONYM_GROUPS);
const MCQ_FLOOR = 4.0;      // same floor as the offline pipeline (tools/ai/config.json retrieval.min_top_score)
const CHAT_MIN = 0.3;       // free questions: minimum relevance ratio (0..1, see retrieve.chatHits) for a passage to be offered as evidence
const MAX_EVIDENCE_CHARS = 16000;    // room for ~7 blocks: the answer must be able to cover everything the books say about the topic
const ORIGINS = ['https://fpj2222hs9-stack.github.io', 'https://imhotep-lac.vercel.app', 'https://imhotep-dr-legacy.vercel.app'];

export class HErr extends Error {
  constructor(code, status, msg, extra) { super(msg || code); this.code = code; this.status = status; this.extra = extra || {}; }
}

export function norm(s) {
  return String(s || '').toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}
async function sha(s) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 40);
}
export function parseJson(t) {
  if (!t) return null;
  t = String(t).trim().replace(/^```(?:json)?\s*|\s*```$/gi, '');
  try { const v = JSON.parse(t); return v && typeof v === 'object' && !Array.isArray(v) ? v : null; } catch (e) { /* fall through */ }
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a >= 0 && b > a) { try { const v = JSON.parse(t.slice(a, b + 1)); return v && typeof v === 'object' ? v : null; } catch (e) { return null; } }
  return null;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
function dayIn(tz, ms) { return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms)); }

export function cleanHist(h) {
  if (!Array.isArray(h)) return [];
  const out = [];
  for (const x of h.slice(-4)) {
    if (!x || (x.r !== 'u' && x.r !== 'a')) continue;
    const t = String(x.t || '').trim().slice(0, 700);
    if (t) out.push({ r: x.r, t });
  }
  while (out.length && out[0].r !== 'u') out.shift();
  return out;
}
export function cleanQ(x) {
  if (!x || typeof x !== 'object') return null;
  const stem = String(x.stem || '').trim().slice(0, 2500);
  const opts = (Array.isArray(x.opts) ? x.opts : []).slice(0, 8)
    .map(o => ({ o: String((o && o.o) || '').toLowerCase().slice(0, 1), t: String((o && o.t) || '').trim().slice(0, 600) }))
    .filter(o => /[a-h]/.test(o.o) && o.t);
  const keys = (Array.isArray(x.keys) ? x.keys : []).map(k => String(k).toLowerCase().slice(0, 1)).filter(k => opts.some(o => o.o === k)).slice(0, 4);
  if (stem.length < 5 || opts.length < 2) return null;
  return { id: String(x.id || '').slice(0, 80), stem, opts, keys, sid: SIDS.includes(x.sid) ? x.sid : 'all' };
}

export function makeHandler(env, io) {
  io = io || {};
  const doFetch = io.fetch || ((...a) => fetch(...a));
  const now = io.now || (() => Date.now());
  const E = (k, d) => { const v = env(k); return v == null || v === '' ? d : v; };
  const N = (k, d) => { const v = Number(E(k, d)); return Number.isFinite(v) ? v : d; };
  const LIM_U = () => N('HORUS_USER_DAILY', 10);
  const LIM_G = () => N('HORUS_GLOBAL_DAILY', 400);
  const RPM = () => N('HORUS_USER_RPM', 8);
  const TTL = 15 * 60 * 1000;      // books are re-read every 15 minutes, so a newly imported book shows up without redeploying

  const keyOf = (plural, legacy) => {
    const raw = env(plural);
    if (raw) { try { const o = JSON.parse(raw); const k = o.default || Object.values(o)[0]; if (k) return String(k); } catch (e) { /* ignore */ } }
    return env(legacy) || '';
  };
  const url = () => String(E('SUPABASE_URL', '')).replace(/\/+$/, '');
  const secret = () => keyOf('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY');
  const pub = () => keyOf('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY');
  const hdr = (key, extra) => { const h = Object.assign({ apikey: key, 'content-type': 'application/json' }, extra || {}); if (key.startsWith('eyJ')) h.authorization = 'Bearer ' + key; return h; };

  /* ---------- Supabase (service role) ---------- */
  async function rpc(name, args) {
    if (!url() || !secret()) throw new HErr('noconfig', 500, 'Supabase keys are missing');
    const r = await doFetch(url() + '/rest/v1/rpc/' + name, { method: 'POST', headers: hdr(secret()), body: JSON.stringify(args || {}) });
    const t = await r.text();
    if (!r.ok) throw new HErr('db', 502, 'rpc ' + name + ' ' + r.status + ' ' + t.slice(0, 160));
    if (!t) return null;
    try { return JSON.parse(t); } catch (e) { return null; }
  }
  async function rest(path) {
    if (!url() || !secret()) throw new HErr('noconfig', 500, 'Supabase keys are missing');
    const r = await doFetch(url() + '/rest/v1/' + path, { headers: hdr(secret()) });
    const t = await r.text();
    if (!r.ok) throw new HErr('db', 502, 'rest ' + r.status + ' ' + t.slice(0, 160));
    return JSON.parse(t);
  }

  /* ---------- the books, loaded once per subject and kept for 15 minutes in this isolate (TTL) ---------- */
  const books = new Map();
  async function loadSid(sid) {
    const rows = await rest('horus_passages?select=id,sid,src,ord,seq,book,chapter,heading,page,body,boost&sid=eq.' + sid + '&order=ord.asc,seq.asc&limit=2000');
    return buildSources(rows)[sid] || [];
  }
  async function corpus(sids) {
    const S = {};
    await Promise.all(sids.map(async sid => {
      let c = books.get(sid);
      if (!c || now() - c.at > TTL) { c = { at: now(), p: loadSid(sid) }; books.set(sid, c); }
      try { S[sid] = await c.p; } catch (e) { books.delete(sid); console.error('horus: books', sid, e && e.message); S[sid] = null; }
    }));
    return S;
  }

  /* ---------- who is asking: the student's own session, either a Firebase ID token (RS256, checked locally against Google's public keys)
     or a Supabase session (asked of Supabase Auth). Firebase is only honoured when FIREBASE_PROJECT_ID is set on the function. ---------- */
  const tokens = new Map();
  let fbv = null, fbp = '';
  const fbVerifier = () => {
    const p = E('FIREBASE_PROJECT_ID', '');
    if (!p) return null;
    if (!fbv || fbp !== p) { fbp = p; fbv = makeFirebaseVerifier({ projectId: p, fetch: doFetch, now }); }
    return fbv;
  };
  async function whoIs(req) {
    const m = /^Bearer\s+(\S+)$/i.exec(req.headers.get('authorization') || '');
    if (!m) throw new HErr('auth', 401, 'sign in first');
    const tok = m[1], hit = tokens.get(tok);
    if (hit && hit.exp > now()) return { id: hit.id };
    if (tokenKind(tok) === 'firebase') {
      const v = fbVerifier();
      if (!v) throw new HErr('auth', 401, 'firebase sign-in is not enabled here');
      try { const u = await v(tok); return { id: u.id }; }
      catch (e) {
        if (e instanceof FbAuthError) throw new HErr('auth', 401, 'bad session');
        throw new HErr('svc', 503, 'could not load Google signing keys: ' + (e && e.message));
      }
    }
    if (!url() || !pub()) throw new HErr('noconfig', 500, 'Supabase keys are missing');
    const r = await doFetch(url() + '/auth/v1/user', { headers: { apikey: pub(), authorization: 'Bearer ' + tok } });
    if (!r.ok) throw new HErr('auth', 401, 'session expired');
    const u = await r.json().catch(() => null);
    if (!u || !u.id) throw new HErr('auth', 401, 'bad session');
    if (tokens.size > 2000) tokens.clear();
    tokens.set(tok, { id: u.id, exp: now() + 60000 });
    return { id: u.id };
  }
  const recent = new Map();
  function tooFast(id) {
    const t = now(), a = (recent.get(id) || []).filter(x => t - x < 60000);
    if (a.length >= RPM()) return true;
    a.push(t); recent.set(id, a);
    if (recent.size > 5000) recent.clear();
    return false;
  }

  /* ---------- Gemini ---------- */
  async function gemini(system, contents, o) {
    o = o || {};
    const key = env('GEMINI_API_KEY');
    if (!key) throw new HErr('noconfig', 500, 'GEMINI_API_KEY is not set');
    const g = await rpc('horus_take', { p_scope: 'g', p_day: dayIn('America/Los_Angeles', now()), p_limit: LIM_G() });
    if (g < 0) throw new HErr('busy', 503, 'global daily limit reached');
    const models = String(E('HORUS_MODELS', 'gemini-3.5-flash-lite,gemini-3.1-flash-lite')).split(',').map(s => s.trim()).filter(Boolean);
    const gc = { temperature: o.temperature == null ? 0.3 : o.temperature, maxOutputTokens: o.maxOut || 4096, responseMimeType: 'application/json' };
    const th = E('HORUS_THINKING', ''); if (th) { try { gc.thinkingConfig = JSON.parse(th); } catch (e) { /* ignore */ } }
    const body = JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents, generationConfig: gc });
    let last = { status: 0, body: '' };
    for (const model of models) {
      for (let attempt = 0; attempt < 2; attempt++) {
        let res;
        const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 40000);
        try {
          res = await doFetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent',
            { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key }, body, signal: ac.signal });
        } catch (e) { last = { status: 0, body: String(e && e.message) }; clearTimeout(tm); await sleep(500); continue; }
        clearTimeout(tm);
        if (res.ok) {
          const j = await res.json().catch(() => ({}));
          const c = (j.candidates || [{}])[0] || {};
          const text = ((c.content || {}).parts || []).filter(p => !p.thought).map(p => p.text || '').join('');
          if (!text) { last = { status: 200, body: 'empty reply (finish: ' + c.finishReason + ')' }; break; }
          return { text, model, usage: j.usageMetadata || {} };
        }
        last = { status: res.status, body: (await res.text().catch(() => '')).slice(0, 200) };
        if (res.status === 429 || res.status === 404 || res.status === 400) break;     // try the next model
        if (res.status === 401 || res.status === 403) throw new HErr('ai_key', 502, 'Gemini rejected the key');
        await sleep(900);                                                                // 5xx: one retry on the same model
      }
    }
    console.error('horus: gemini failed', last.status, last.body);
    throw new HErr(last.status === 429 ? 'busy' : 'ai', last.status === 429 ? 503 : 502, 'Gemini unavailable (' + last.status + ')');
  }

  /* ---------- one answer ---------- */
  function evidenceText(blocks) {
    if (!blocks.length) return 'EVIDENCE: (none found in the books)';
    let out = 'EVIDENCE (numbered blocks from the books):\n', used = 0;
    blocks.forEach((b, i) => {
      const t = b.text.slice(0, Math.max(0, MAX_EVIDENCE_CHARS - used));
      if (!t) return;
      used += t.length;
      out += '\n[' + (i + 1) + '] Book: ' + b.book + (b.chapter ? ' | Chapter: ' + b.chapter : '') + (b.page ? ' | Page: ' + b.page : '') + '\n' + t + '\n';
    });
    return out;
  }

  function judge(obj, blocks, q) {
    if (!obj) return { retry: 'not_json' };
    const answer = String(obj.answer || '').trim().slice(0, 6000);
    if (!answer) return { retry: 'empty' };
    const topic = obj.topic === 'other' ? 'other' : 'medical';
    if (topic === 'medical' && arabicRatio(answer) < 0.25) return { retry: 'not_arabic' };
    let grounded = obj.grounded === true && blocks.length > 0;
    const cites = [...new Set((Array.isArray(obj.cite) ? obj.cite : []).map(Number).filter(i => Number.isInteger(i) && i >= 1 && i <= blocks.length))];
    if (grounded && !cites.length) grounded = false;                               // a "grounded" answer must point at a real block
    const out = { st: topic === 'other' ? 'off' : (grounded ? 'book' : 'general'), a: answer, ss: [] };
    if (out.st === 'general') out.a = DISCLOSURE + '\n' + answer;
    if (out.st === 'book') out.ss = cites.slice(0, 4).map(i => ({ h: blocks[i - 1].heading || '', b: blocks[i - 1].book, c: blocks[i - 1].chapter, p: blocks[i - 1].page }));
    if (q) {
      const valid = new Set(q.opts.map(o => o.o.toUpperCase()));
      const ca = [...new Set((String(obj.letter || '').toUpperCase().match(/[A-H]/g) || []).filter(l => valid.has(l)))];
      if (ca.length && out.st !== 'off') {
        out.ca = ca.join(',');
        const keys = q.keys.map(k => k.toUpperCase());
        out.kd = keys.length > 0 && (keys.length !== ca.length || keys.some(k => !ca.includes(k)));
      }
    }
    return { out };
  }

  async function answer(p) {
    const sids = p.q ? (p.q.sid === 'all' ? SIDS : [p.q.sid]) : (p.sid === 'all' ? SIDS : [p.sid]);
    const S = await corpus(sids);
    const loaded = sids.some(s => S[s] && S[s].length);
    /* keywords: Arabic-only questions need English terms to search an English book */
    let kw = '';
    if (!p.q && latinTokens(p.text).length < 2) {
      try {
        const r = await gemini(REWRITE_SYSTEM, [{ role: 'user', parts: [{ text: p.text }] }], { maxOut: 120, temperature: 0 });
        const o = parseJson(r.text); kw = o && typeof o.k === 'string' ? o.k.slice(0, 300) : '';
      } catch (e) { if (e instanceof HErr && (e.code === 'busy' || e.code === 'noconfig' || e.code === 'ai_key')) throw e; }
    }
    /* retrieval */
    let blocks = [];
    if (loaded) {
      if (p.q) {
        let hits = [];
        for (const sid of sids) for (const h of runSources(S[sid] || [], focusedQuery(p.q), 6, MCQ_FLOOR)) hits.push(h);
        hits.sort((a, b) => b[0] - a[0]); hits = hits.slice(0, 6);
        if (!hits.length || hits[0][0] < MCQ_FLOOR) {
          const h2 = [];
          for (const sid of sids) for (const [, idx] of S[sid] || []) for (const [sc, i] of idx.top(expandedQuery(p.q, idx, SYN), 8)) h2.push([sc, i, idx]);
          h2.sort((a, b) => b[0] - a[0]);
          if (h2.length && (!hits.length || h2[0][0] > hits[0][0])) hits = h2.slice(0, 8);
        }
        blocks = hits.length && hits[0][0] >= MCQ_FLOOR * 0.75 ? pack(hits) : [];
      } else {
        const prev = [...p.hist].reverse().find(x => x.r === 'u');
        const qt = chatQuery(p.text, kw, prev && prev.t);
        let hits = [];
        for (const sid of sids) for (const h of chatHits(S[sid] || [], qt, 7, SYN)) hits.push(h);
        hits.sort((a, b) => b[0] - a[0]);
        const top = hits.length ? hits[0][0] : 0;
        hits = top >= CHAT_MIN ? hits.filter(h => h[0] >= Math.max(CHAT_MIN, top * 0.45)).slice(0, 7) : [];
        hits = hits.map(h => [h[3], h[1], h[2]]);          // pack() wants [rawScore, index, Index]
        blocks = pack(hits);
      }
    }
    /* the model */
    let user;
    if (p.q) {
      const q = p.q;
      const keyTxt = q.keys.length ? q.keys.map(k => k.toUpperCase() + '. ' + ((q.opts.find(o => o.o === k) || {}).t || '')).join(' + ') : '(no stored answer key)';
      user = evidenceText(blocks) + '\n\nSUBJECT: ' + SUBJ[q.sid] + '\nQUESTION:\n' + q.stem + '\n' + q.opts.map(o => o.o.toUpperCase() + '. ' + o.t).join('\n') + '\n\nSTORED WEBSITE ANSWER KEY: ' + keyTxt;
    } else {
      user = evidenceText(blocks) + '\n\nSTUDENT QUESTION:\n' + p.text;
    }
    const contents = [];
    for (const h of p.hist) contents.push({ role: h.r === 'u' ? 'user' : 'model', parts: [{ text: h.t }] });
    contents.push({ role: 'user', parts: [{ text: user }] });
    const system = p.q ? Q_SYSTEM : CHAT_SYSTEM;
    let r = await gemini(system, contents, { maxOut: p.q ? 3000 : 4096 });
    let v = judge(parseJson(r.text), blocks, p.q);
    if (v.retry) {
      contents.push({ role: 'model', parts: [{ text: r.text }] }, { role: 'user', parts: [{ text: RETRY_AR }] });
      r = await gemini(system, contents, { maxOut: p.q ? 3000 : 4096 });
      v = judge(parseJson(r.text), blocks, p.q);
      if (v.retry) throw new HErr('ai', 502, 'the model gave an unusable answer (' + v.retry + ')');
    }
    return Object.assign(v.out, { m: r.model, t: Math.floor(now() / 1000) }, { _loaded: loaded });
  }

  /* ---------- http ---------- */
  function corsFor(origin) {
    const allow = String(E('HORUS_ORIGINS', ORIGINS.join(','))).split(',').map(s => s.trim()).filter(Boolean);
    if (E('HORUS_DEV', '') === '1' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) allow.push(origin);
    const h = { vary: 'origin', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info', 'access-control-max-age': '86400' };
    if (allow.includes(origin)) h['access-control-allow-origin'] = origin;
    return h;
  }
  const J = (o, status, cors) => new Response(JSON.stringify(o), { status: status || 200, headers: Object.assign({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, cors) });

  async function ask(req, user) {
    if (Number(req.headers.get('content-length') || 0) > 30000) throw new HErr('bad', 413, 'too large');
    let b; try { b = await req.json(); } catch (e) { throw new HErr('bad', 400, 'bad json'); }
    if (!b || typeof b !== 'object') throw new HErr('bad', 400, 'bad body');
    const mode = b.mode === 'q' ? 'q' : 'chat';
    const sid = SIDS.includes(b.sid) ? b.sid : 'all';
    let text = '', q = null, hist = [];
    if (mode === 'chat') {
      text = String(b.text || '').trim().slice(0, 1200);
      if (text.length < 2) throw new HErr('bad', 400, 'empty question');
      hist = cleanHist(b.hist);
    } else {
      q = cleanQ(b.q);
      if (!q) throw new HErr('bad', 400, 'bad question');
    }
    if (tooFast(user.id)) throw new HErr('slow', 429, 'too many requests, wait a moment');

    /* shared cache first: a repeated question costs nothing */
    let key = null;
    if (mode === 'q') key = 'q|' + PV + '|' + await sha(q.id + '|' + q.stem + '|' + q.opts.map(o => o.o + ':' + o.t).join('|') + '|' + q.keys.join(','));
    else if (!hist.length) key = 'c|' + PV + '|' + sid + '|' + await sha(norm(text));
    if (key) {
      let hit = null;
      try { hit = await rpc('horus_cache_get', { p_key: key }); } catch (e) { console.error('horus: cache read', e && e.message); }
      if (hit && hit.a) return { ok: true, a: hit.a, st: hit.st, ss: hit.ss || [], ca: hit.ca, kd: hit.kd, cached: true, lim: LIM_U() };
    }

    /* daily quota (only for answers that really call the model) */
    const dayU = dayIn('Africa/Cairo', now()), scope = 'u:' + user.id;
    const n = await rpc('horus_take', { p_scope: scope, p_day: dayU, p_limit: LIM_U() });
    if (n < 0) throw new HErr('limit', 429, 'daily limit reached', { lim: LIM_U(), left: 0 });
    try {
      const out = await answer({ q, text, hist, sid });
      const loaded = out._loaded; delete out._loaded;
      if (key && loaded && out.st !== 'off') {
        try { await rpc('horus_cache_put', { p_key: key, p_kind: mode, p_sid: mode === 'q' ? q.sid : sid, p_q: mode === 'q' ? q.stem : text, p_ans: out }); } catch (e) { console.error('horus: cache write', e && e.message); }
      }
      return { ok: true, a: out.a, st: out.st, ss: out.ss, ca: out.ca, kd: out.kd, cached: false, left: Math.max(0, LIM_U() - n), lim: LIM_U() };
    } catch (e) {
      try { await rpc('horus_give_back', { p_scope: scope, p_day: dayU }); } catch (e2) { /* ignore */ }
      throw e;
    }
  }

  return async function handle(req) {
    const cors = corsFor(req.headers.get('origin') || '');
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    try {
      if (E('HORUS_OFF', '') === '1') throw new HErr('off', 503, 'Horus is switched off');
      const u = new URL(req.url);
      if (req.method === 'GET' && !u.searchParams.has('me')) {
        return J({ ok: true, v: PV, ready: { gemini: !!env('GEMINI_API_KEY'), db: !!(url() && secret()), fb: !!env('FIREBASE_PROJECT_ID') }, lim: { user: LIM_U(), global: LIM_G() } }, 200, cors);
      }
      const user = await whoIs(req);
      if (req.method === 'GET') {
        const n = await rpc('horus_peek', { p_scope: 'u:' + user.id, p_day: dayIn('Africa/Cairo', now()) });
        return J({ ok: true, left: Math.max(0, LIM_U() - (Number(n) || 0)), lim: LIM_U() }, 200, cors);
      }
      if (req.method !== 'POST') throw new HErr('bad', 405, 'method');
      return J(await ask(req, user), 200, cors);
    } catch (e) {
      if (e instanceof HErr) {
        if (e.status >= 500) console.error('horus:', e.code, e.message);
        return J(Object.assign({ ok: false, err: e.code }, e.extra), e.status, cors);
      }
      console.error('horus unhandled:', e && e.message);
      return J({ ok: false, err: 'server' }, 500, cors);
    }
  };
}
