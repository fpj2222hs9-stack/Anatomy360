// JS BM25 must rank like the Python one (tools/ai/imai/retrieve.py) on the real passages.
import fs from 'fs';
import { execFileSync } from 'child_process';
import { buildSources, focusedQuery, chatQuery, runSources, pack } from '../edge/src/retrieve.js';
const rows = JSON.parse(fs.readFileSync(new URL('../out/passages.json', import.meta.url)));
rows.forEach((r, i) => { r.id = i + 1; });
const S = buildSources(rows);
const qs = JSON.parse(fs.readFileSync(new URL('../../ai/data/questions.json', import.meta.url)));
const list = (Array.isArray(qs) ? qs : Object.values(qs)).filter(q => q && q.stem && q.opts && q.keys && q.keys.length);
const pick = []; for (let i = 0; i < list.length && pick.length < 60; i += Math.floor(list.length / 60)) pick.push(list[i]);
fs.writeFileSync('/tmp/parity-q.json', JSON.stringify(pick));
const py = JSON.parse(execFileSync('python3', ['-c', `
import json,sys
sys.path.insert(0,'${new URL('../../ai', import.meta.url).pathname}')
from imai import retrieve
rows=json.load(open('${new URL('../out/passages.json', import.meta.url).pathname}'))
for i,r in enumerate(rows):
    r['id']=i+1
    r['text']=((r['heading'] or 'Relevant section')+'\\n'+r['body']).strip()
by={}
for r in rows: by.setdefault(r['sid'],{}).setdefault(r['src'],[]).append(r)
qs=json.load(open('/tmp/parity-q.json'))
out=[]
for q in qs:
    srcs=by.get(q['sid'])
    if not srcs: out.append(None); continue
    ordered=sorted(srcs.items(), key=lambda kv: (kv[1][0]['ord'], kv[0]))
    meta={k:{'tier':v[0]['ord'],'boost':v[0].get('boost',1)} for k,v in ordered}
    ret=retrieve.LocalRetriever([(k,v) for k,v in ordered],{},meta)
    hits=ret._run(retrieve.focused_query(q),6)
    out.append([[round(sc,4), idx.p[i]['id']] for sc,i,idx in hits])
print(json.dumps(out))
`], { maxBuffer: 1 << 26 }).toString());
let same = 0, tot = 0, bad = 0;
pick.forEach((q, n) => {
  const srcs = S[q.sid]; if (!srcs) return;
  const hits = runSources(srcs, focusedQuery(q), 6, 4.0).map(([sc, i, idx]) => [Math.round(sc * 1e4) / 1e4, idx.p[i].id]);
  tot++;
  const a = JSON.stringify(hits.map(h => h[1])), b = JSON.stringify((py[n] || []).map(h => h[1]));
  if (a === b) same++; else { bad++; if (bad < 4) console.log('DIFF', q.id, a, b, hits[0], py[n] && py[n][0]); }
});
console.log(`parity: ${same}/${tot} identical top-6 id lists`);
if (same < tot * 0.95) process.exit(1);
