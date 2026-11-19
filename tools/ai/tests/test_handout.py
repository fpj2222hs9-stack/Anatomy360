"""Handout support: same-level sources + boost in LocalRetriever, line-preserving windows, MCQ answer lines, abbreviation fixes."""
import os, sys, unittest
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from imai import books, retrieve  # noqa: E402
import convert_book as cb  # noqa: E402


def P(i, heading, body, book='b'):
    return {'id': i, 'sid': 'anatomy', 'book': book, 'chapter': 'c', 'heading': heading, 'page': '1', 'body': body, 'text': heading + '\n' + body}


SAME = 'the axillary nerve winds around the surgical neck of the humerus and supplies deltoid and teres minor'
Q = {'stem': 'which nerve winds around the surgical neck of the humerus', 'opts': [{'o': 'a', 't': 'axillary nerve'}], 'keys': ['a']}


class Levels(unittest.TestCase):
    def test_same_level_and_boost(self):
        a = ('a', [P('a1', 'Axillary nerve', SAME), P('a2', 'Filler', 'tibia fibula malleolus talus ankle')])
        h = ('h', [P('h1', 'Axillary nerve', SAME), P('h2', 'Filler', 'tibia fibula malleolus talus ankle')])    # same statistics as 'a': only the boost differs
        s = ('s', [P('s1', 'Site', SAME)])
        r = retrieve.LocalRetriever([a, h, s], {'min_top_score': 0.1}, {'a': {'tier': 0, 'boost': 1}, 'h': {'tier': 0, 'boost': 1.15}, 's': {'tier': 1, 'boost': 1}})
        hits = r._run(retrieve.focused_query(Q), 6)
        ids = [idx.p[i]['id'] for _, i, idx in hits]
        self.assertEqual(ids[0], 'h1')                       # boosted handout first on equal text
        self.assertIn('a1', ids)                             # the department book is on the same level: searched together
        self.assertNotIn('s1', ids)                          # lower level not used when the first one reaches the floor
        sa = [sc for sc, i, idx in hits if idx.p[i]['id'] == 'a1'][0]
        self.assertAlmostEqual(hits[0][0] / sa, 1.15, places=6)

    def test_default_is_one_level_per_source(self):
        a = ('a', [P('a1', 'Axillary nerve', SAME)])
        s = ('s', [P('s1', 'Site', SAME)])
        r = retrieve.LocalRetriever([a, s], {'min_top_score': 0.1})
        ids = [idx.p[i]['id'] for _, i, idx in r._run(retrieve.focused_query(Q), 6)]
        self.assertEqual(ids, ['a1'])                        # as before: first source that reaches the floor wins

    def test_source_meta_from_config(self):
        cfg = {'zz': [{'id': 'x', 'kind': 'site-book'}, {'id': 'y', 'kind': 'text', 'dir': 'nowhere-here'}]}
        self.assertEqual(books.source_meta(cfg, 'zz'), {})   # nothing is ready on this machine: nothing counts


class Windows(unittest.TestCase):
    def test_keep_lines(self):
        text = '\n'.join('line %d word word word word word' % i for i in range(30))   # 7 words per line
        w = books._windows_lines(text, 50, 14)
        self.assertGreater(len(w), 1)
        for win in w:
            self.assertLessEqual(len(win.split()), 50)
            self.assertTrue(all(l.startswith('line') for l in win.split('\n')))        # only cut between lines
        self.assertTrue(set(w[0].split('\n')[-2:]) <= set(w[1].split('\n')))            # overlap
        self.assertEqual(books._windows_lines('', 50), [''])


class Mcq(unittest.TestCase):
    def test_resolve(self):
        page = ['1- The axilla contains all EXCEPT: (2024)', 'a- Axillary artery.', 'b- Fat', 'c- Trunks of the brachial plexus.', '',
                '2- The cervico-axillary canal:', 'a- Bounded medially by the first rib.', 'b- Bounded posteriorly by upper border of scapula.', '',
                'Axilla 1 all, axillary   Axilla 2', '1 -c   2-b']
        out, ok = cb.resolve_mcq(page)
        self.assertTrue(ok)
        self.assertIn("Model answer (the doctor's key) for question 1: c) Trunks of the brachial plexus.", out)
        self.assertIn("Model answer (the doctor's key) for question 2: b) Bounded posteriorly by upper border of scapula.", out)
        self.assertNotIn('1 -c   2-b', out)

    def test_not_a_mcq_page_is_untouched(self):
        page = ['Brachial plexus', '1- Roots', '2- Trunks']
        self.assertEqual(cb.resolve_mcq(page), (page, False))
        bad = ['1- Q one', 'a- x', 'b- y', '1 -c   2-b']                              # 2 answers, 1 question: not trusted
        self.assertFalse(cb.resolve_mcq(bad)[1])

    def test_fix_text(self):
        self.assertEqual(cb.fix_text('Post. cord: Lat. pectoral n. and N. to subclavius'), 'Posterior cord: Lateral pectoral nerve and Nerve to subclavius')
        self.assertEqual(cb.fix_text('trunks of the brachiaI plexus; brachia! plexus'), 'trunks of the brachial plexus; brachial plexus')
        self.assertEqual(cb.fix_text('Cephalic V. and N.supply'), 'Cephalic vein and N.supply')


if __name__ == '__main__':
    unittest.main()
