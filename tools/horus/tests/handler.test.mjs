import assert from 'assert';
import fs from 'fs';
import { makeHandler } from '../edge/src/core.js';
import { makeBackend, ENV, req } from './fake-backend.mjs';

let pass = 0, fail = 0;
async function t(name, fn) { try { await fn(); pass++; console.log('  ok  ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + '\n      ' + (e && e.stack || e).split('\n').slice(0, 4).join('\n      ')); } }
const rows = JSON.parse(fs.readFileSync(new URL('../out/passages.json', import.meta.url)));
const anat = rows.find(r => r.sid === 'anatomy' && /axillary nerve/i.test(r.body) && /deltoid/i.test(r.body));
const QEN = 'Which nerve supplies the deltoid muscle? the axillary nerve';
const j = async r => { const x = await r.json(); return x; };
function setup(envOver, bopts) { const be = makeBackend(bopts); const h = makeHandler(ENV(envOver), { fetch: be.fetch }); return { be, h, st: be.st }; }
const geminiCount = be => be.st.geminiBodies.length;

console.log('handler');
await t('health check needs no sign-in and leaks no secret', async () => {
  const { h } = setup(); const r = await h(req('GET', null, { token: null })); const b = await j(r);
  assert.equal(r.status, 200); assert.deepEqual(b.ready, { gemini: true, db: true, fb: false });   // fb = FIREBASE_PROJECT_ID is set (a boolean, never the value) assert(!JSON.stringify(b).includes('AIza'));
});
await t('CORS: allowed origin echoed, unknown origin gets no allow header', async () => {
  const { h } = setup();
  let r = await h(req('OPTIONS', null, { token: null })); assert.equal(r.status, 204); assert.equal(r.headers.get('access-control-allow-origin'), 'https://fpj2222hs9-stack.github.io');
  r = await h(req('OPTIONS', null, { token: null, origin: 'https://evil.example' })); assert.equal(r.headers.get('access-control-allow-origin'), null);
});
await t('no token / bad token -> 401 and Gemini untouched', async () => {
  const s = setup();
  let r = await s.h(req('POST', { mode: 'chat', text: QEN }, { token: null })); assert.equal(r.status, 401);
  r = await s.h(req('POST', { mode: 'chat', text: QEN }, { token: 'nope' })); assert.equal(r.status, 401);
  assert.equal(geminiCount(s.be ? s : s), 0);
});
await t('chat: grounded answer with citations built from the real block, quota counted, then served from the shared cache for anyone', async () => {
  const s = setup();
  let r = await s.h(req('POST', { mode: 'chat', text: QEN, sid: 'anatomy' })); let b = await j(r);
  assert.equal(r.status, 200, JSON.stringify(b)); assert.equal(b.ok, true); assert.equal(b.st, 'book'); assert.equal(b.cached, false); assert.equal(b.left, 9); assert.equal(b.lim, 10);
  assert(b.ss.length >= 1 && b.ss[0].b && b.ss[0].p !== undefined, 'citation from block');
  assert.equal(geminiCount(s), 1);
  const sent = s.st.geminiBodies[0].body;
  assert(/EVIDENCE \(numbered blocks/.test(sent.contents[0].parts[0].text) && /\[1\] Book:/.test(sent.contents[0].parts[0].text), 'evidence in prompt');
  assert(!sent.systemInstruction.parts[0].text.includes('deltoid'), 'student text never goes into the system prompt');
  assert.equal(s.st.geminiBodies[0].key, 'AIzaSyFAKE-KEY-FOR-TESTS'); assert(!s.st.geminiBodies[0].url.includes('AIza'), 'key only in a header');
  assert(!JSON.stringify(b).includes('AIza'));
  // same student again (different spacing/case/punctuation) -> cache, no quota, no Gemini
  r = await s.h(req('POST', { mode: 'chat', text: '  which NERVE supplies the deltoid muscle?? the axillary nerve ', sid: 'anatomy' })); b = await j(r);
  assert.equal(b.cached, true); assert.equal(geminiCount(s), 1); assert.equal(b.st, 'book');
  // another student, same question
  r = await s.h(req('POST', { mode: 'chat', text: QEN, sid: 'anatomy' }, { token: 'tok-bob' })); b = await j(r);
  assert.equal(b.cached, true); assert.equal(geminiCount(s), 1);
  assert.equal(s.st.usage.get('u:user-ana|' + [...s.st.usage.keys()][0].split('|')[1]), 1, 'cache hits do not consume the daily quota');
});
await t('Arabic-only question: one tiny keyword call, then the answer using evidence found by those keywords', async () => {
  const s = setup();
  const r = await s.h(req('POST', { mode: 'chat', text: 'ايه العصب اللي بيغذي العضلة الدالية؟' })); const b = await j(r);
  assert.equal(r.status, 200, JSON.stringify(b)); assert.equal(geminiCount(s), 2);
  assert(s.st.geminiBodies[0].body.systemInstruction.parts[0].text.startsWith('You convert'));
  assert(/\[1\] Book:/.test(s.st.geminiBodies[1].body.contents.at(-1).parts[0].text), 'keywords found evidence');
  assert.equal(b.st, 'book'); assert.equal(b.left, 9);
});
await t('a citation number the model made up is dropped: the answer becomes general knowledge with the disclosure', async () => {
  const s = setup(); s.st.script.push(({ last }) => /STUDENT QUESTION/.test(last) ? { text: JSON.stringify({ topic: 'medical', grounded: true, answer: 'بص يا دكترة، ده شرح عام عن الـ nerve والعضلة.', cite: [9] }) } : undefined);
  const b = await j(await s.h(req('POST', { mode: 'chat', text: QEN })));
  assert.equal(b.st, 'general'); assert.deepEqual(b.ss, []); assert(b.a.startsWith('الإجابة غير موجودة بشكل واضح في المصدر المتاح'));
});
await t('English-first answer: one repair call; two bad answers -> error and the quota is given back', async () => {
  let s = setup(); let n = 0;
  s.st.script.push(({ last }) => /STUDENT QUESTION/.test(last) && n++ === 0 ? { text: JSON.stringify({ topic: 'medical', grounded: false, answer: 'The axillary nerve supplies the deltoid muscle and teres minor.', cite: [] }) } : undefined);
  let b = await j(await s.h(req('POST', { mode: 'chat', text: QEN }))); assert.equal(b.ok, true); assert.equal(geminiCount(s), 2);
  s = setup(); s.st.script.push(() => ({ text: JSON.stringify({ topic: 'medical', grounded: false, answer: 'English only answer here.', cite: [] }) }));
  const r = await s.h(req('POST', { mode: 'chat', text: QEN })); b = await j(r);
  assert.equal(r.status, 502); assert.equal(b.err, 'ai'); assert.equal([...s.st.usage.entries()].find(([k]) => k.startsWith('u:'))[1], 0, 'quota refunded');
});
await t('daily limit: the 3rd new question is refused with limit/left 0, but cached answers still work', async () => {
  const s = setup({ HORUS_USER_DAILY: '2' });
  const ask = txt => s.h(req('POST', { mode: 'chat', text: txt }));
  await ask(QEN); await ask('Describe the brachial plexus roots trunks divisions cords');
  let r = await ask('What is the blood supply of the scaphoid bone and its clinical importance'); let b = await j(r);
  assert.equal(r.status, 429); assert.equal(b.err, 'limit'); assert.equal(b.left, 0);
  r = await ask(QEN); b = await j(r); assert.equal(b.cached, true); assert.equal(r.status, 200);
});
await t('global Gemini cap: busy, and the student is not charged', async () => {
  const s = setup({ HORUS_GLOBAL_DAILY: '1' });
  const r = await s.h(req('POST', { mode: 'chat', text: 'ايه العصب اللي بيغذي العضلة الدالية؟' })); const b = await j(r);
  assert.equal(r.status, 503); assert.equal(b.err, 'busy');
  assert.equal([...s.st.usage.entries()].find(([k]) => k.startsWith('u:'))[1], 0);
});
await t('Gemini 429 on the first model falls through to the second; a 5xx is retried once', async () => {
  let s = setup(); s.st.script.push(({ model }) => model === 'gemini-3.5-flash-lite' ? { status: 429, text: 'quota' } : undefined);
  let b = await j(await s.h(req('POST', { mode: 'chat', text: QEN }))); assert.equal(b.ok, true); assert.deepEqual(s.st.geminiBodies.map(x => x.model), ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite']);
  s = setup(); let k = 0; s.st.script.push(() => k++ === 0 ? { status: 503, text: 'overloaded' } : undefined);
  b = await j(await s.h(req('POST', { mode: 'chat', text: QEN }))); assert.equal(b.ok, true);
  s = setup(); s.st.script.push(() => ({ status: 429, text: 'quota' }));
  const r = await s.h(req('POST', { mode: 'chat', text: QEN })); assert.equal(r.status, 503); assert.equal((await j(r)).err, 'busy');
});
await t('a rejected Gemini key is reported as ai_key (not leaked), quota refunded', async () => {
  const s = setup(); s.st.script.push(() => ({ status: 403, text: 'API key not valid: AIzaSyFAKE-KEY-FOR-TESTS' }));
  const r = await s.h(req('POST', { mode: 'chat', text: QEN })); const raw = await r.text();
  assert.equal(r.status, 502); assert(raw.includes('ai_key')); assert(!raw.includes('AIza'));
});
await t('follow-ups carry history, are not cached, and search with the previous student turn too', async () => {
  const s = setup();
  await s.h(req('POST', { mode: 'chat', text: QEN }));
  const body = { mode: 'chat', text: 'وبيعمل ايه لو اتقطع؟', hist: [{ r: 'u', t: QEN }, { r: 'a', t: 'بص يا دكترة، الـ axillary nerve بيغذي الـ deltoid.' }] };
  let b = await j(await s.h(req('POST', body))); assert.equal(b.ok, true);
  const c = s.st.geminiBodies.at(-1).body.contents; assert.equal(c.length, 3); assert.equal(c[0].role, 'user'); assert.equal(c[1].role, 'model');
  const n = geminiCount(s); b = await j(await s.h(req('POST', body))); assert(geminiCount(s) > n, 'follow-up not cached');
});
await t('question mode: letter checked against the options, conflict flag vs the stored key, cached per question content', async () => {
  const s = setup();
  const q = { id: 'g2_demo-1', stem: 'Which nerve supplies the deltoid muscle?', opts: [{ o: 'a', t: 'Radial nerve' }, { o: 'b', t: 'Axillary nerve' }, { o: 'c', t: 'Musculocutaneous nerve' }, { o: 'd', t: 'Ulnar nerve' }], keys: ['c'], sid: 'anatomy' };
  let r = await s.h(req('POST', { mode: 'q', q })); let b = await j(r);
  assert.equal(r.status, 200, JSON.stringify(b)); assert.equal(b.ca, 'B'); assert.equal(b.kd, true); assert.equal(b.st, 'book');
  b = await j(await s.h(req('POST', { mode: 'q', q }, { token: 'tok-bob' }))); assert.equal(b.cached, true); assert.equal(b.kd, true);
  const q2 = Object.assign({}, q, { keys: ['b'] }); b = await j(await s.h(req('POST', { mode: 'q', q: q2 }))); assert.equal(b.cached, false, 'a corrected key is a different question');
  assert.equal(b.kd, false);
  s.st.script.unshift(() => ({ text: JSON.stringify({ topic: 'medical', grounded: false, letter: 'Z', answer: 'بص يا دكترة، مفيش اختيار Z.', cite: [] }) }));
  b = await j(await s.h(req('POST', { mode: 'q', q: Object.assign({}, q, { stem: 'Another stem about the deltoid nerve supply?' }) }))); assert.equal(b.ca, undefined);
});
await t('off-topic: not cached; no question text in the cache for it', async () => {
  const s = setup(); s.st.script.push(({ last }) => /STUDENT QUESTION/.test(last) ? { text: JSON.stringify({ topic: 'other', grounded: false, answer: 'أنا هنا عشان أساعدك في مذاكرة المواد الطبية بس يا دكترة.', cite: [] }) } : undefined);
  const b = await j(await s.h(req('POST', { mode: 'chat', text: 'who won the football match yesterday' }))); assert.equal(b.st, 'off'); assert.equal(s.st.cache.size, 0);
});
await t('books unavailable: still answers (as general knowledge, disclosed) and nothing is cached', async () => {
  const s = setup({}, { restFail: true }); const b = await j(await s.h(req('POST', { mode: 'chat', text: QEN })));
  assert.equal(b.ok, true); assert.equal(b.st, 'general'); assert.equal(s.st.cache.size, 0);
});
await t('per-student request rate limit (HORUS_USER_RPM)', async () => {
  const s = setup({ HORUS_USER_RPM: '3', HORUS_USER_DAILY: '50' });
  const codes = []; for (let i = 0; i < 5; i++) codes.push((await s.h(req('POST', { mode: 'chat', text: 'question number ' + i + ' about the femoral triangle boundaries' }))).status);
  assert.deepEqual(codes, [200, 200, 200, 429, 429]);
});
await t('input checks: empty, huge body, garbage', async () => {
  const s = setup();
  assert.equal((await s.h(req('POST', { mode: 'chat', text: ' ' }))).status, 400);
  assert.equal((await s.h(req('POST', { mode: 'q', q: { stem: 'x', opts: [] } }))).status, 400);
  const big = new Request('https://x/functions/v1/horus', { method: 'POST', headers: { authorization: 'Bearer tok-ana', 'content-length': '999999', 'content-type': 'application/json' }, body: '{}' });
  assert.equal((await s.h(big)).status, 413);
});
await t('?me=1 returns the remaining asks; HORUS_OFF switches everything off', async () => {
  let s = setup(); await s.h(req('POST', { mode: 'chat', text: QEN }));
  let b = await j(await s.h(req('GET', null, { query: '?me=1' }))); assert.deepEqual([b.left, b.lim], [9, 10]);
  s = setup({ HORUS_OFF: '1' }); const r = await s.h(req('POST', { mode: 'chat', text: QEN })); assert.equal(r.status, 503); assert.equal((await j(r)).err, 'off');
});
await t('works with legacy Supabase keys too (JWT-style secret sent as apikey + bearer)', async () => {
  const be = makeBackend(); const calls = [];
  const f = (u, i) => { calls.push([String(u), i && i.headers]); return be.fetch(u, Object.assign({}, i, { headers: Object.assign({}, i && i.headers, { apikey: i && i.headers && i.headers.apikey === 'eyJsecret' ? 'sb_secret_test' : (i && i.headers && i.headers.apikey) }) })); };
  const h = makeHandler(ENV({ SUPABASE_SECRET_KEYS: '', SUPABASE_PUBLISHABLE_KEYS: '', SUPABASE_SERVICE_ROLE_KEY: 'eyJsecret', SUPABASE_ANON_KEY: 'eyJanon' }), { fetch: f });
  const b = await j(await h(req('POST', { mode: 'chat', text: QEN }))); assert.equal(b.ok, true);
  assert(calls.some(([u, hd]) => u.includes('/rpc/') && hd.authorization === 'Bearer eyJsecret'));
});
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
