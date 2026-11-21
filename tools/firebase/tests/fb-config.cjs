/* fb-config: the SHIPPED js/cloud-config.js (real projectId / apiKey / clientId) must produce a correct Google sign-in request on the real site origins.
   The page is served from the local files but under the real origin (https://imhotep-lac.vercel.app and the GitHub Pages path) through Playwright routes;
   Google is a stub that only records the request. Nothing real is contacted.   usage: node tools/firebase/tests/fb-config.cjs   (site tree on :8770) */
const { chromium } = require('playwright');
const LOCAL = process.env.SITE_LOCAL || 'http://127.0.0.1:8770';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const MIME = { html: 'text/html; charset=utf-8', js: 'application/javascript', css: 'text/css', json: 'application/json', png: 'image/png', jpg: 'image/jpeg', svg: 'image/svg+xml', webp: 'image/webp', woff2: 'font/woff2', mp4: 'video/mp4' };
async function run(b, origin, basePath) {
  const ctx = await b.newContext({ viewport: { width: 1100, height: 900 }, serviceWorkers: 'block' });
  const google = [], other = [];
  await ctx.route('**/*', async route => {
    const u = new URL(route.request().url());
    if (u.origin === origin) {                                  /* the real origin: answer from the local tree */
      let path = u.pathname; if (basePath !== '/' && path.startsWith(basePath)) path = '/' + path.slice(basePath.length); if (path === '/') path = '/index.html';
      const r = await fetch(LOCAL + path + u.search).catch(() => null);
      if (!r || !r.ok) return route.fulfill({ status: 404, body: 'nf' });
      return route.fulfill({ status: 200, contentType: MIME[path.split('.').pop()] || 'application/octet-stream', body: Buffer.from(await r.arrayBuffer()) });
    }
    if (u.hostname === 'accounts.google.com') { google.push(u); return route.fulfill({ status: 200, contentType: 'text/html', body: '<title>google stub</title>' }); }
    other.push(u.hostname); return route.abort();               /* everything else (fonts, analytics, supabase, firebase) is blocked */
  });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { try { localStorage.setItem('im_seen', JSON.stringify({ 'tour-v1': 1, 'ann-honor-1':1,'ann-fix-1120':1, 'ann-honor-ready': 1 })); } catch (e) {} });
  await p.goto(origin + basePath + 'index.html?fb=1', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.IM && IM.cloudState, { timeout: 60000 }).catch(() => {}); await p.waitForTimeout(1500);
  const st = await p.evaluate(() => ({ prov: (IM.cloudState && IM.cloudState().provider) || null, cfg: !!(window.IM.CLOUD && IM.CLOUD.fb && IM.CLOUD.fb.projectId) }));
  await p.evaluate(() => { IM.cloudSignIn(); }).catch(() => {}); await p.waitForTimeout(1500);
  const g = google[0];
  return { origin, st, g, errs, other: [...new Set(other)], q: g ? Object.fromEntries(g.searchParams) : null, base: g ? g.origin + g.pathname : null, close: () => ctx.close() };
}
(async () => {
  const cfg = require('fs').readFileSync(__dirname + '/../../../js/cloud-config.js', 'utf8');
  const val = k => (cfg.match(new RegExp(k + ":\\s*'([^']*)'")) || [])[1];
  const WANT = { projectId: val('projectId'), clientId: val('clientId') };
  ok(WANT.projectId === 'imhotep-22' && /^424706377828-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(WANT.clientId), 'the shipped config carries the owner\'s projectId and clientId');
  ok(/provider:\s*'supabase'/.test(cfg), 'provider is STILL supabase (nothing switches for the students)');
  const b = await chromium.launch();
  for (const [origin, base] of [['https://imhotep-lac.vercel.app', '/'], ['https://fpj2222hs9-stack.github.io', '/Anatomy360/']]) {
    console.log('\n== ' + origin + base);
    const r = await run(b, origin, base);
    ok(r.st.cfg && r.st.prov === 'firebase', '?fb=1 selects the Firebase provider on this origin (provider=' + r.st.prov + ')');
    ok(!!r.g, 'sign-in sends the browser to Google');
    if (r.g) {
      ok(r.base === 'https://accounts.google.com/o/oauth2/v2/auth', 'Google authorize endpoint');
      ok(r.q.client_id === WANT.clientId, 'client_id is the owner\'s client');
      ok(r.q.redirect_uri === origin + base, 'redirect_uri is exactly the registered one: ' + r.q.redirect_uri);
      ok(r.q.response_type === 'id_token' && /openid/.test(r.q.scope) && /email/.test(r.q.scope), 'response_type=id_token, scope openid email profile');
      ok(!!r.q.nonce && r.q.nonce.length >= 16 && !!r.q.state && r.q.state.length >= 16, 'a random nonce and state are included');
      ok(!/AIza|secret|service/i.test(r.g.href), 'no key or secret travels in the Google URL');
    }
    ok(!r.errs.length, 'no page errors' + (r.errs.length ? ': ' + r.errs[0] : ''));
    await r.close();
  }
  await b.close(); console.log(fails ? '\nFAILS ' + fails : '\nALL PASS'); process.exit(fails ? 1 : 0);
})();
