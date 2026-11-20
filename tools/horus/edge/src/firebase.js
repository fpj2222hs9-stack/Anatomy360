// Verifies a Firebase Auth ID token (RS256 JWT signed by Google) with WebCrypto only: no library, no network call per request.
// Public keys come from Google's JWKS endpoint and are cached in the isolate. Works in Deno (Supabase Edge) and Node >= 18.
//
// A token is accepted only when ALL of these hold:
//   alg RS256 and a kid that is in Google's current key set, valid RSASSA-PKCS1-v1_5 / SHA-256 signature,
//   aud == projectId, iss == https://securetoken.google.com/<projectId>, sub non-empty, exp in the future, iat not in the future,
//   firebase.sign_in_provider is 'google.com' (the students) or 'custom' (a token only the project's own service account can mint: the owner's selftest).
//   An anonymous / e-mail / phone account on the same project can never use Horus.

export const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

const dec = new TextDecoder();
function b64uBytes(s) {
  s = String(s).replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
  const bin = atob(s), a = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return a;
}
function jsonPart(s) { return JSON.parse(dec.decode(b64uBytes(s))); }

/** peek at the header only (no verification) to route a token: 'firebase' (RS256) or 'other' */
export function tokenKind(tok) {
  try { const h = jsonPart(String(tok).split('.')[0]); return h && h.alg === 'RS256' ? 'firebase' : 'other'; } catch (e) { return 'other'; }
}

export class FbAuthError extends Error { constructor(msg) { super(msg); this.name = 'FbAuthError'; } }

export function makeFirebaseVerifier(opts) {
  const projectId = String(opts.projectId || '');
  const doFetch = opts.fetch || ((...a) => fetch(...a));
  const now = opts.now || (() => Date.now());
  const url = opts.jwksUrl || JWKS_URL;
  const subtle = (opts.crypto || globalThis.crypto).subtle;
  const keys = new Map();           // kid -> CryptoKey
  let fetchedAt = -Infinity, expiresAt = 0, inflight = null;
  const MIN_REFETCH = 60 * 1000;    // never hit Google more than once a minute, even if someone sends tokens with random kids

  async function loadKeys() {
    if (inflight) return inflight;
    inflight = (async () => {
      const r = await doFetch(url);
      if (!r.ok) throw new Error('jwks ' + r.status);
      const j = await r.json();
      const cc = /max-age=(\d+)/.exec((r.headers && r.headers.get && r.headers.get('cache-control')) || '');
      const next = new Map();
      for (const k of (j && j.keys) || []) {
        if (!k || k.kty !== 'RSA' || !k.kid || (k.alg && k.alg !== 'RS256')) continue;
        next.set(k.kid, await subtle.importKey('jwk', { kty: 'RSA', n: k.n, e: k.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']));
      }
      if (!next.size) throw new Error('jwks empty');
      keys.clear(); next.forEach((v, k) => keys.set(k, v));
      fetchedAt = now(); expiresAt = fetchedAt + Math.min(Math.max((cc ? +cc[1] : 3600) * 1000, 5 * 60 * 1000), 6 * 3600 * 1000);
    })().finally(() => { inflight = null; });
    return inflight;
  }
  async function keyFor(kid) {
    if (now() >= expiresAt) { try { await loadKeys(); } catch (e) { if (!keys.size) throw e; } }   // keep serving the old keys if Google is briefly unreachable
    let k = keys.get(kid);
    if (!k && now() - fetchedAt > MIN_REFETCH) { await loadKeys(); k = keys.get(kid); }              // Google rotated keys
    return k || null;
  }

  /** returns { id, email } or throws FbAuthError */
  return async function verify(tok) {
    if (!projectId) throw new FbAuthError('firebase project not configured');
    const parts = String(tok).split('.');
    if (parts.length !== 3) throw new FbAuthError('malformed');
    let head, pay;
    try { head = jsonPart(parts[0]); pay = jsonPart(parts[1]); } catch (e) { throw new FbAuthError('malformed'); }
    if (!head || head.alg !== 'RS256' || !head.kid) throw new FbAuthError('alg');
    const key = await keyFor(head.kid);
    if (!key) throw new FbAuthError('kid');
    const ok = await subtle.verify({ name: 'RSASSA-PKCS1-v1_5' }, key, b64uBytes(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
    if (!ok) throw new FbAuthError('signature');
    const t = Math.floor(now() / 1000);
    if (!pay || pay.aud !== projectId || pay.iss !== 'https://securetoken.google.com/' + projectId) throw new FbAuthError('audience');
    if (typeof pay.sub !== 'string' || !pay.sub || pay.sub.length > 128) throw new FbAuthError('sub');
    if (!(typeof pay.exp === 'number' && pay.exp > t)) throw new FbAuthError('expired');
    if (!(typeof pay.iat === 'number' && pay.iat <= t + 60)) throw new FbAuthError('iat');
    if (pay.auth_time != null && !(typeof pay.auth_time === 'number' && pay.auth_time <= t + 60)) throw new FbAuthError('auth_time');
    const prov = pay.firebase && pay.firebase.sign_in_provider;
    if (prov !== 'google.com' && prov !== 'custom') throw new FbAuthError('provider');
    return { id: pay.sub, email: typeof pay.email === 'string' ? pay.email : '', exp: pay.exp * 1000 };
  };
}
