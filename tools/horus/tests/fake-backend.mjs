// In-memory stand-ins for Supabase (auth + PostgREST rpc/rest) and Gemini, used by the handler tests.
import fs from 'fs';
export function makeBackend(opts) {
  opts = opts || {};
  const rows = JSON.parse(fs.readFileSync(new URL('../out/passages.json', import.meta.url)));
  rows.forEach((r, i) => { r.id = i + 1; });
  const st = { usage: new Map(), cache: new Map(), calls: [], geminiBodies: [], gemini: [], restFail: !!opts.restFail, users: new Map(), cacheRead: 0 };
  st.users.set('tok-ana', 'user-ana'); st.users.set('tok-bob', 'user-bob');
  st.script = []; // queue of gemini behaviours: function(body, n) -> {status, text} | undefined (default behaviour)
  const J = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { 'content-type': 'application/json' } });
  async function fakeFetch(u, init) {
    u = String(u); init = init || {};
    const h = init.headers || {};
    const body = init.body ? JSON.parse(init.body) : null;
    if (u.includes('/auth/v1/user')) {
      const t = String(h.authorization || '').replace(/^Bearer /, '');
      st.calls.push('auth');
      if (!st.users.has(t)) return J({ msg: 'bad jwt' }, 401);
      return J({ id: st.users.get(t), email: 'x@example.invalid' });
    }
    if (u.includes('/rest/v1/rpc/')) {
      if (h.apikey !== 'sb_secret_test') return J({ message: 'bad key' }, 401);
      const name = u.split('/rpc/')[1];
      st.calls.push(name);
      if (name === 'horus_take') {
        const k = body.p_scope + '|' + body.p_day, n = st.usage.get(k) || 0;
        if (body.p_limit < 1 || n >= body.p_limit) return J(-1);
        st.usage.set(k, n + 1); return J(n + 1);
      }
      if (name === 'horus_give_back') { const k = body.p_scope + '|' + body.p_day; st.usage.set(k, Math.max(0, (st.usage.get(k) || 0) - 1)); return new Response(null, { status: 204 }); }
      if (name === 'horus_peek') return J(st.usage.get(body.p_scope + '|' + body.p_day) || 0);
      if (name === 'horus_cache_get') { const v = st.cache.get(body.p_key); if (v) { st.cacheRead++; return J(v.ans); } return new Response('null', { status: 200 }); }
      if (name === 'horus_cache_put') { st.cache.set(body.p_key, { ans: body.p_ans, kind: body.p_kind, q: body.p_q }); return new Response(null, { status: 204 }); }
      return J({ message: 'unknown rpc' }, 404);
    }
    if (u.includes('/rest/v1/horus_passages')) {
      st.calls.push('passages');
      if (st.restFail) return J({ message: 'down' }, 500);
      const sid = /sid=eq\.(\w+)/.exec(u)[1];
      return J(rows.filter(r => r.sid === sid).sort((a, b) => a.ord - b.ord || a.seq - b.seq));
    }
    if (u.includes('generativelanguage.googleapis.com')) {
      const model = /models\/([^:]+):/.exec(u)[1];
      st.geminiBodies.push({ model, body, key: h['x-goog-api-key'], url: u });
      const n = st.geminiBodies.length;
      const sys = body.systemInstruction.parts[0].text;
      const last = body.contents[body.contents.length - 1].parts[0].text;
      let r;
      for (const f of st.script) { r = f({ model, sys, last, body, n }); if (r) break; }
      if (!r) r = defaultReply({ sys, last });
      if (r.status && r.status !== 200) return new Response(r.text || 'err', { status: r.status });
      return J({ candidates: [{ content: { parts: [{ text: r.text }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 1000, candidatesTokenCount: 200, totalTokenCount: 1200 } });
    }
    return J({ message: 'unrouted ' + u }, 500);
  }
  function defaultReply({ sys, last }) {
    if (sys.startsWith('You convert')) return { text: JSON.stringify({ k: 'axillary nerve deltoid shoulder' }) };
    if (/OUTPUT: return ONLY[\s\S]*"letter"/.test(sys)) return { text: JSON.stringify({ topic: 'medical', grounded: /\[1\] Book:/.test(last), letter: 'B', answer: 'بص يا دكترة، الإجابة B هي الصح لأن الفكرة الأساسية موجودة في الكتاب، والباقي غلط.', cite: [1] }) };
    return { text: JSON.stringify({ topic: 'medical', grounded: /\[1\] Book:/.test(last), answer: 'بص يا دكترة، الفكرة هنا إن الـ structure ده بيتغذّى بالـ nerve المناسب، وده اللي الكتاب بيقوله.', cite: [1] }) };
  }
  return { st, fetch: fakeFetch, rows };
}
export const ENV = (over) => {
  const m = Object.assign({ SUPABASE_URL: 'https://proj.supabase.co', SUPABASE_SECRET_KEYS: '{"default":"sb_secret_test"}', SUPABASE_PUBLISHABLE_KEYS: '{"default":"sb_publishable_test"}', GEMINI_API_KEY: 'AIzaSyFAKE-KEY-FOR-TESTS', HORUS_DEV: '1' }, over || {});
  return k => m[k];
};
export const req = (method, body, o) => {
  o = o || {};
  const headers = { 'content-type': 'application/json', origin: o.origin || 'https://fpj2222hs9-stack.github.io' };
  if (o.token !== null) headers.authorization = 'Bearer ' + (o.token || 'tok-ana');
  return new Request('https://proj.supabase.co/functions/v1/horus' + (o.query || ''), { method, headers, body: body ? JSON.stringify(body) : undefined });
};
