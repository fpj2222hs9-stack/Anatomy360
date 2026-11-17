// Levels (ord) and boost: two sources on the SAME level are searched together; boost makes a source win when the match is close; a lower level is only used when the first fails.
import assert from 'assert';
import { buildSources, runSources, chatHits, chatQuery, focusedQuery } from '../edge/src/retrieve.js';
let n = 0, id = 0;
const ok = (c, m) => { assert.ok(c, m); n++; console.log('  ok ', m); };
const row = (sid, src, ord, boost, seq, heading, body) => ({ id: ++id, sid, src, ord, seq, boost, book: src, chapter: 'Ch', heading, page: String(seq + 1), body });
const same = 'the axillary nerve winds around the surgical neck of the humerus and supplies deltoid and teres minor';
const rows = [
  row('anatomy', 'book-a', 0, 1, 0, 'Axillary nerve', same),
  row('anatomy', 'book-a', 0, 1, 1, 'Filler A', 'fibula tibia malleolus talus calcaneus ankle joint ligaments'),
  row('anatomy', 'handout', 0, 1.15, 0, 'Axillary nerve', same),
  row('anatomy', 'handout', 0, 1.15, 1, 'Only here', 'quadrangular space transmits the posterior circumflex humeral artery and the axillary nerve'),
  row('anatomy', 'site-book', 1, 1, 0, 'Axillary nerve (site)', same),
  row('histology', 'h-book', 0, 1, 0, 'Epithelium', 'simple columnar epithelium with goblet cells lines the intestine'),
];
const S = buildSources(rows).anatomy;
ok(S.map(s => s[0]).join(',') === 'book-a,handout,site-book', 'sources sorted by level, then id (stable, independent of row order)');
ok(buildSources([...rows].reverse()).anatomy.map(s => s[0]).join(',') === 'book-a,handout,site-book', 'row order from the database does not matter');
ok(S[1][1].boost === 1.15 && S[0][1].boost === 1 && S[1][1].ord === 0, 'boost and level are carried on each source');

const q = { stem: 'which nerve winds around the surgical neck of the humerus', opts: [{ o: 'a', t: 'axillary nerve' }, { o: 'b', t: 'radial nerve' }], keys: ['a'] };
const who = h => h[2].p[h[1]].src;
// two books with identical passages (so identical BM25 statistics): the only difference is the boost
const EQ = buildSources([row('anatomy', 'book-a', 0, 1, 0, 'Axillary nerve', same), row('anatomy', 'book-a', 0, 1, 1, 'Filler', 'fibula tibia malleolus talus ankle'),
  row('anatomy', 'handout', 0, 1.15, 0, 'Axillary nerve', same), row('anatomy', 'handout', 0, 1.15, 1, 'Filler', 'fibula tibia malleolus talus ankle')]).anatomy;
const eq = runSources(EQ, focusedQuery(q), 6, 0.1);
ok(who(eq[0]) === 'handout', 'same text in both books: the boosted handout ranks first');
ok(Math.abs(eq[0][0] / eq.find(h => who(h) === 'book-a')[0] - 1.15) < 1e-9, 'the boosted score is exactly 1.15 x the plain score');
const hits = runSources(S, focusedQuery(q), 6, 0.1);
ok(hits.some(h => who(h) === 'book-a') && hits.some(h => who(h) === 'handout'), 'both books of the level are in the result (searched together)');
ok(!hits.some(h => who(h) === 'site-book'), 'the lower level is not searched when the first level reaches the floor');

const q2 = { stem: 'what passes through the quadrangular space', opts: [{ o: 'a', t: 'posterior circumflex humeral artery' }], keys: ['a'] };
ok(who(runSources(S, focusedQuery(q2), 6, 0.1)[0]) === 'handout', 'a fact only the handout has is found even though the department book is on the same level');

const q3 = { stem: 'goblet cells', opts: [{ o: 'a', t: 'x' }], keys: ['a'] };
const lowFloor = runSources(S, focusedQuery({ stem: 'axillary nerve surgical neck humerus', opts: [{ o: 'a', t: 'deltoid' }], keys: [] }), 6, 1e9);
ok(lowFloor.length > 0, 'when no level reaches the floor the best hits are still returned');

const fr = chatHits(EQ, chatQuery('axillary nerve surgical neck humerus', '', ''), 7, null);
ok(who(fr[0]) === 'handout' && Math.abs(fr[0][0] / fr.find(h => who(h) === 'book-a')[0] - 1.15) < 1e-9, 'free chat: the boosted source ranks first on equal matches (x1.15)');
// without boost / levels (old rows) everything behaves as before
const old = buildSources(rows.map(r => ({ ...r, boost: undefined, ord: r.src === 'site-book' ? 1 : 0 }))).anatomy;
ok(old.every(s => s[1].boost === 1), 'rows without a boost count as 1');
console.log(`\n${n} passed`);
