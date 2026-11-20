// Firebase ID-token verification for Horus (RS256 + Google JWKS), with locally generated RSA keys and a fake JWKS endpoint.
// node tools/horus/tests/firebase.test.mjs
import assert from 'assert';
import { webcrypto } from 'node:crypto';
import { makeFirebaseVerifier, tokenKind, FbAuthError, JWKS_URL } from '../edge/src/firebase.js';
import { makeHandler } from '../edge/src/core.js';
import { makeBackend, ENV, req } from './fake-backend.mjs';

let pass = 0, fail = 0;
async function t(name, fn) { try { await fn(); pass++; console.log('  ok  ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + '\n      ' + (e && e.stack || e).split('\n').slice(0, 4).join('\n      ')); } }
const subtle = webcrypto.subtle, enc = new TextEncoder();
const b64u = b => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const PID = 'imhotep-test';
const NOW = 1_800_000_000_000;

async function newKey(kid) {
  const kp = await subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const jwk = await subtle.exportKey('jwk', kp.publicKey);
  return { kid, priv: kp.privateKey, jwk: { kty: 'RSA', alg: 'RS256', use: 'sig', kid, n: jwk.n, e: jwk.e } };
}
async function sign(key, payload, headerOver) {
  const h = b64u(enc.encode(JSON.stringify(Object.assign({ alg: 'RS256', kid: key.kid, typ: 'JWT' }, headerOver || {}))));
  const p = b64u(enc.encode(JSON.stringify(payload)));
  const sig = await subtle.sign({ name: 'RSASSA-PKCS1-v1_5' }, key.priv, enc.encode(h + '.' + p));
  return h + '.' + p + '.' + b64u(new Uint8Array(sig));
}
const claims = (over) => Object.assign({ iss: 'https://securetoken.google.com/' + PID, aud: PID, sub: 'uid-ana-0000-1111', iat: NOW / 1000 - 100, auth_time: NOW / 1000 - 200, exp: NOW / 1000 + 3000, email: 'ana@example.com', firebase: { sign_in_provider: 'google.com', identities: {} } }, over || {});

/** fake Google: serves the JWKS, counts hits, can be taken down */
function fakeGoogle(keys) {
  const st = { hits: 0, down: false, keys };
  const f = async (u, init) => {
    if (String(u) === JWKS_URL) {
      st.hits++;
      if (st.down) return new Response('down', { status: 503 });
      return new Response(JSON.stringify({ keys: st.keys.map(k => k.jwk) }), { status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=19000, must-revalidate, no-transform' } });
    }
    return null;
  };
  return { st, f };
}
async function rej(p, re) { try { await p; } catch (e) { assert(e instanceof FbAuthError, 'FbAuthError expected, got ' + (e && e.stack)); if (re) assert(re.test(e.message), e.message); return; } assert.fail('should have been rejected'); }

console.log('firebase token verifier');
const k1 = await newKey('kid-1'), k2 = await newKey('kid-2'), evil = await newKey('kid-1');   // evil has the SAME kid but a different private key
let clock = NOW;
const mk = (keys, over) => { const g = fakeGoogle(keys); const v = makeFirebaseVerifier(Object.assign({ projectId: PID, fetch: g.f, now: () => clock }, over || {})); return { g, v }; };

await t('tokenKind routes RS256 to firebase and anything else to supabase', async () => {
  assert.equal(tokenKind(await sign(k1, claims())), 'firebase');
  assert.equal(tokenKind(b64u(enc.encode('{"alg":"HS256","typ":"JWT"}')) + '.e30.x'), 'other');
  assert.equal(tokenKind(b64u(enc.encode('{"alg":"ES256","kid":"x"}')) + '.e30.x'), 'other');
  assert.equal(tokenKind('nope'), 'other'); assert.equal(tokenKind(''), 'other'); assert.equal(tokenKind('a.b.c'), 'other');
});
await t('valid token: returns the uid (sub), caches keys (one JWKS fetch for many tokens)', async () => {
  const { g, v } = mk([k1, k2]);
  const u = await v(await sign(k1, claims())); assert.equal(u.id, 'uid-ana-0000-1111'); assert.equal(u.email, 'ana@example.com');
  await v(await sign(k2, claims({ sub: 'other' }))); await v(await sign(k1, claims())); assert.equal(g.st.hits, 1);
});
await t('imported users keep the Supabase uuid: sub is passed through untouched', async () => {
  const { v } = mk([k1]); const id = '3f2b8c1e-9d4a-4e7b-8a21-0c5d6e7f8a90';
  assert.equal((await v(await sign(k1, claims({ sub: id })))).id, id);
});
await t('wrong signature (same kid, attacker key) is rejected', async () => { const { v } = mk([k1]); await rej(v(await sign(evil, claims())), /signature/); });
await t('tampered payload is rejected', async () => {
  const { v } = mk([k1]); const tok = (await sign(k1, claims())).split('.'); tok[1] = b64u(enc.encode(JSON.stringify(claims({ sub: 'victim' }))));
  await rej(v(tok.join('.')), /signature/);
});
await t('alg none / HS256 / missing kid are rejected', async () => {
  const { v } = mk([k1]);
  await rej(v(b64u(enc.encode('{"alg":"none"}')) + '.' + b64u(enc.encode(JSON.stringify(claims()))) + '.'), /alg/);
  await rej(v(await sign(k1, claims(), { alg: 'HS256' })), /alg/);
  await rej(v(await sign(k1, claims(), { kid: undefined })), /alg/);
});
await t('unknown kid is rejected (after at most one refetch per minute)', async () => {
  const { g, v } = mk([k1]); await v(await sign(k1, claims())); assert.equal(g.st.hits, 1);
  const ghost = await newKey('ghost'); clock += 1000;
  await rej(v(await sign(ghost, claims())), /kid/); assert.equal(g.st.hits, 1, 'no refetch inside the 60 s window');
  clock += 61000; await rej(v(await sign(ghost, claims())), /kid/); assert.equal(g.st.hits, 2);
  clock = NOW;
});
await t('key rotation: a token with a new kid works after one refetch', async () => {
  const g = fakeGoogle([k1]); const v = makeFirebaseVerifier({ projectId: PID, fetch: g.f, now: () => clock });
  await v(await sign(k1, claims())); g.st.keys = [k1, k2]; clock = NOW + 120000;
  assert.equal((await v(await sign(k2, claims({ exp: clock / 1000 + 3000, iat: clock / 1000 - 10 })))).id, 'uid-ana-0000-1111'); clock = NOW;
});
await t('wrong audience / wrong issuer / other project are rejected', async () => {
  const { v } = mk([k1]);
  await rej(v(await sign(k1, claims({ aud: 'someone-else' }))), /audience/);
  await rej(v(await sign(k1, claims({ iss: 'https://securetoken.google.com/someone-else' }))), /audience/);
  await rej(v(await sign(k1, claims({ iss: 'https://accounts.google.com' }))), /audience/);
});
await t('expired, future iat, missing sub, non-google provider are rejected', async () => {
  const { v } = mk([k1]);
  await rej(v(await sign(k1, claims({ exp: NOW / 1000 - 1 }))), /expired/);
  await rej(v(await sign(k1, claims({ iat: NOW / 1000 + 600 }))), /iat/);
  await rej(v(await sign(k1, claims({ sub: '' }))), /sub/);
  await rej(v(await sign(k1, claims({ sub: undefined }))), /sub/);
  await rej(v(await sign(k1, claims({ firebase: { sign_in_provider: 'anonymous' } }))), /provider/);
  for (const p of ['password', 'phone', 'facebook.com']) await rej(v(await sign(k1, claims({ firebase: { sign_in_provider: p } }))), /provider/);
  await rej(v(await sign(k1, claims({ firebase: undefined }))), /provider/);
});
await t('a custom token (only the owner\'s service account can mint one; used by the selftest) is accepted', async () => { const { v } = mk([k1]); const r = await v(await sign(k1, claims({ sub: 'selftest-abc', firebase: { sign_in_provider: 'custom' } }))); assert.equal(r.id, 'selftest-abc'); });
await t('garbage is rejected with FbAuthError, not a crash', async () => { const { v } = mk([k1]); await rej(v('a.b'), /malformed/); await rej(v('!!!.@@@.###'), /malformed/); });
await t('Google unreachable: cached keys keep working; a cold start fails loudly (not as "bad token")', async () => {
  const { g, v } = mk([k1]); await v(await sign(k1, claims())); g.st.down = true; clock = NOW + 7 * 3600 * 1000;      // cache expired
  assert.equal((await v(await sign(k1, claims({ exp: clock / 1000 + 3000, iat: clock / 1000 - 10 })))).id, 'uid-ana-0000-1111'); clock = NOW;
  const cold = mk([k1]); cold.g.st.down = true;
  try { await cold.v(await sign(k1, claims())); assert.fail('should throw'); } catch (e) { assert(!(e instanceof FbAuthError), 'a JWKS outage is not an auth failure'); }
});
await t('concurrent first requests share one JWKS fetch', async () => {
  const { g, v } = mk([k1]); const toks = await Promise.all([1, 2, 3, 4].map(() => sign(k1, claims())));
  await Promise.all(toks.map(x => v(x))); assert.equal(g.st.hits, 1);
});
await t('no projectId configured: everything is rejected', async () => { const v = makeFirebaseVerifier({ projectId: '', fetch: async () => null, now: () => clock }); await rej(v(await sign(k1, claims())), /not configured/); });

console.log('horus handler with Firebase tokens');
function setup(envOver) {
  const be = makeBackend(); const g = fakeGoogle([k1]);
  const fetcher = async (u, init) => (String(u) === JWKS_URL ? g.f(u, init) : be.fetch(u, init));
  const h = makeHandler(ENV(envOver), { fetch: fetcher, now: () => clock });
  return { be, g, h, st: be.st };
}
const QEN = 'Which nerve supplies the deltoid muscle? the axillary nerve';
const J = async r => r.json();
clock = NOW;
await t('a Firebase student can ask; quota is counted on the Firebase uid', async () => {
  const s = setup({ FIREBASE_PROJECT_ID: PID }); const tok = await sign(k1, claims({ sub: 'u-fb-1' }));
  const r = await s.h(req('POST', { mode: 'chat', text: QEN, sid: 'anatomy' }, { token: tok })); const b = await J(r);
  assert.equal(r.status, 200, JSON.stringify(b)); assert.equal(b.ok, true); assert.equal(b.left, 9);
  assert([...s.st.usage.keys()].some(k => k.startsWith('u:u-fb-1|')), 'usage keyed by the Firebase uid: ' + [...s.st.usage.keys()]);
  assert(!s.st.calls.includes('auth'), 'Supabase Auth is not called for a Firebase token');
});
await t('an imported student (same uid as in Supabase) continues the SAME daily count', async () => {
  const s = setup({ FIREBASE_PROJECT_ID: PID });
  await s.h(req('POST', { mode: 'chat', text: QEN, sid: 'anatomy' }, { token: 'tok-ana' }));                               // old Supabase session -> user-ana
  const tok = await sign(k1, claims({ sub: 'user-ana' }));
  const r = await s.h(req('POST', { mode: 'chat', text: 'another different question about the deltoid muscle innervation', sid: 'anatomy' }, { token: tok })); const b = await J(r);
  assert.equal(r.status, 200, JSON.stringify(b)); assert.equal(b.left, 8, 'second question of the day for the same uid');
});
await t('health check says whether Firebase sign-in is switched on (a boolean, never the project id)', async () => {
  for (const [env, want] of [[{ FIREBASE_PROJECT_ID: PID }, true], [{}, false]]) {
    const s = setup(env); const r = await s.h(new Request('http://x/functions/v1/horus', { method: 'GET' })); const b = await r.json();
    assert.equal(r.status, 200); assert.equal(b.ready.fb, want); assert(!JSON.stringify(b).includes(PID));
  }
});
await t('Supabase tokens keep working while Firebase is enabled (old clients during the switch)', async () => {
  const s = setup({ FIREBASE_PROJECT_ID: PID }); const r = await s.h(req('POST', { mode: 'chat', text: QEN, sid: 'anatomy' }, { token: 'tok-bob' })); assert.equal(r.status, 200);
});
await t('FIREBASE_PROJECT_ID not set: a Firebase token is refused (401) and Gemini is untouched', async () => {
  const s = setup(); const tok = await sign(k1, claims());
  const r = await s.h(req('POST', { mode: 'chat', text: QEN, sid: 'anatomy' }, { token: tok })); assert.equal(r.status, 401); assert.equal(s.st.geminiBodies.length, 0);
});
await t('token of ANOTHER Firebase project / forged signature / expired -> 401, Gemini untouched', async () => {
  const s = setup({ FIREBASE_PROJECT_ID: PID });
  for (const tok of [await sign(k1, claims({ aud: 'x', iss: 'https://securetoken.google.com/x' })), await sign(evil, claims()), await sign(k1, claims({ exp: NOW / 1000 - 5 }))]) {
    const r = await s.h(req('POST', { mode: 'chat', text: QEN, sid: 'anatomy' }, { token: tok })); assert.equal(r.status, 401);
  }
  assert.equal(s.st.geminiBodies.length, 0);
});
await t('Google keys unreachable on a cold start -> 503 svc (not 401, so the student is not logged out)', async () => {
  const s = setup({ FIREBASE_PROJECT_ID: PID }); s.g.st.down = true; const tok = await sign(k1, claims());
  const r = await s.h(req('POST', { mode: 'chat', text: QEN, sid: 'anatomy' }, { token: tok })); const b = await J(r); assert.equal(r.status, 503); assert.equal(b.err, 'svc');
});
await t('GET ?me=1 works with a Firebase token and shows the remaining count', async () => {
  const s = setup({ FIREBASE_PROJECT_ID: PID }); const tok = await sign(k1, claims({ sub: 'u-fb-2' }));
  const r = await s.h(req('GET', null, { token: tok, query: '?me=1' })); const b = await J(r); assert.equal(r.status, 200); assert.equal(b.left, 10); assert.equal(b.lim, 10);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
