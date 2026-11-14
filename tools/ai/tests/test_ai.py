"""Offline tests (no network, no keys):  python3 -m unittest discover -s tools/ai/tests -v"""
import copy, datetime, json, os, re, subprocess, sys, tempfile, unittest

HERE = os.path.dirname(os.path.abspath(__file__))
AI = os.path.dirname(HERE)
sys.path.insert(0, AI)
from imai import books, budget, pipeline, prompts, providers, retrieve, store, validate   # noqa: E402
from imai.util import q_hash, fnv1a, read_json                                             # noqa: E402

PROMPT_FILES = ['input_template.txt', '01_retrieval_focused.txt', '02_retrieval_expanded.txt', '03_language_contract.txt', '04_grounded_tutor.txt',
                '05_fallback_knowledge.txt', '06_language_retry.txt']


def mkq(i='q1', keys=('b',), n=4, stem='Which structure passes through the carpal tunnel?', **kw):
    q = {'id': i, 'sid': 'anatomy', 'subject': 'Anatomy', 'part': {'id': 'p', 'num': 1, 'en': 'Upper Limb', 'ar': ''}, 'sec': {'id': 's', 'en': 'Hand', 'ar': ''},
         'n': '1', 'stem': stem, 'opts': [{'o': 'abcdefgh'[k], 't': t} for k, t in enumerate(['Ulnar nerve', 'Median nerve', 'Radial nerve', 'Axillary nerve', 'Musculocutaneous nerve', 'Suprascapular nerve', 'x', 'y'][:n])],
         'keys': list(keys), 'canc': False, 'alt': '', 'review': False, 'fix': False, 'bk': '', 'block': '', 'caseOf': '', 'fig': '', 'tags': []}
    q.update(kw)
    q['h'] = q_hash(q)
    return q


def passages(extra=()):
    P = [('Carpal tunnel', 'The median nerve passes through the carpal tunnel together with the tendons of flexor digitorum superficialis and profundus. Compression gives carpal tunnel syndrome with thenar wasting.'),
         ('Erythrocyte structure', 'The erythrocyte is a biconcave disc without a nucleus and with hemoglobin as its main protein.'),
         ('Ulnar nerve', 'The ulnar nerve passes behind the medial epicondyle and enters the hand superficial to the flexor retinaculum through Guyon canal.'),
         ('Neighbour heading', 'Text that follows the carpal tunnel section and gives extra context about the flexor retinaculum attachments.')] + list(extra)
    out = []
    for k, (h, b) in enumerate(P):
        out += books._mk('t:%d' % k, 'anatomy', 'Test book', 'Upper Limb', h, str(10 + k), b, 260)
    return out


def mk_pipeline(scenario=None, chain=('mock',), rpd=1000, extra_cfg=None, passages_list=None, floor=0.5):
    cfg = {'pipeline': {'allow_knowledge_fallback': True, 'max_repairs_per_stage': 1}, 'retrieval': {'min_top_score': floor, 'focused_k': 4, 'expanded_k': 6},
           'subjects': {'anatomy': {'year': '2', 'module': 'MSK'}}}
    if extra_cfg:
        cfg.update(extra_cfg)
    pc = {n: {'kind': 'mock', 'rpm': 0, 'rpd': rpd, 'tz': 'UTC'} for n in chain}
    bud = budget.Budget(None, pc, persist=False)
    provs = {n: providers.Mock(n, pc[n], scenario) for n in chain}
    R = retrieve.LocalRetriever([('src', passages_list if passages_list is not None else passages())], cfg['retrieval'])
    tmp = tempfile.mkdtemp()
    P = pipeline.Pipeline(cfg, bud, provs, list(chain), lambda sid: R, {}, os.path.join(tmp, 'conflicts.jsonl'))
    return P, provs, bud, tmp


class PromptsVerbatim(unittest.TestCase):
    def test_files_are_untouched_and_present(self):
        for n in PROMPT_FILES:
            t = prompts.load(n)
            self.assertTrue(t.strip(), n)
        self.assertTrue(prompts.load('01_retrieval_focused.txt').startswith('You are a meticulous medical curriculum retrieval specialist.'))
        self.assertIn('NO_DECISIVE_EVIDENCE', prompts.load('01_retrieval_focused.txt'))
        self.assertTrue(prompts.load('06_language_retry.txt').startswith('CRITICAL RETRY: The previous summary violated the language contract.'))
        self.assertIn('answer_conflict', prompts.load('04_grounded_tutor.txt'))
        self.assertIn(prompts.DISCLOSURE, prompts.load('05_fallback_knowledge.txt'))

    def test_expanded_swaps_only_the_strategy(self):
        f, e = prompts.retrieval_system('focused'), prompts.retrieval_system('expanded')
        self.assertEqual(f, prompts.load('01_retrieval_focused.txt'))
        self.assertNotIn('This is the focused retrieval attempt.', e)
        self.assertNotIn('Prioritize the exact distinctive stem phrase', e)
        self.assertIn(prompts.load('02_retrieval_expanded.txt').strip().split('\n')[0], e)
        self.assertTrue(e.startswith('You are a meticulous medical curriculum retrieval specialist.'))
        self.assertIn('Do not require word-for-word overlap.', e)               # the shared part is kept
        self.assertTrue(e.rstrip().endswith('naming which retrieved fact supports or contradicts the answer and options.'))

    def test_language_contract_is_plugged_in(self):
        for mode in ('grounded', 'knowledge'):
            s = prompts.tutor_system(mode)
            self.assertNotIn('[تعليمات الأسلوب', s)
            self.assertIn('NON-NEGOTIABLE LANGUAGE CONTRACT', s)
            self.assertIn('Keep the response concise and useful for exam revision.', s)
        g = prompts.tutor_system('grounded')
        self.assertLess(g.index('For grounded MCQs'), g.index('NON-NEGOTIABLE'))
        self.assertLess(g.index('NON-NEGOTIABLE'), g.index('For every evidence block'))

    def test_prompt_version_changes_with_text(self):
        v = prompts.prompt_version()
        self.assertRegex(v, r'^[0-9a-f]{8}$')


class InputTemplate(unittest.TestCase):
    def test_options_and_key(self):
        m = prompts.build_input(mkq(n=6), {'year': '2', 'module': 'MSK'}, 'Anatomy', 'Upper Limb - Hand')
        self.assertIn('Year: 2\nModule: MSK\nSubject: Anatomy\nChapter: Upper Limb - Hand', m)
        self.assertIn('B. Median nerve', m)
        self.assertIn('F. Suprascapular nerve', m)                              # beyond the template's A-E
        self.assertIn('Stored answer key:\nB. Median nerve', m)
        self.assertNotIn('Matching pairs', m)
        self.assertNotIn('{', m)

    def test_missing_options_and_no_key(self):
        m = prompts.build_input(mkq(n=2, keys=()))
        self.assertNotIn('C.', m)
        self.assertIn('no stored answer key', m)

    def test_case_context(self):
        m = prompts.build_input(mkq(), case_context='Case: a 40 year old woman ...')
        self.assertIn('Case (shared stem of this question set): Case: a 40 year old woman', m)

    def test_pairs(self):
        q = mkq(); q['pairs'] = [['A', 'x'], ['B', 'y']]
        m = prompts.build_input(q)
        self.assertIn('Matching pairs (إن وجدت):\n1. A => x\n2. B => y', m)


class HashParity(unittest.TestCase):
    def test_fnv_known_values(self):
        self.assertEqual(fnv1a(''), '811c9dc5')
        self.assertEqual(fnv1a('a'), 'e40c292c')

    @unittest.skipUnless(os.path.exists(os.path.join(AI, 'data', 'questions.json')), 'export the bank first')
    def test_every_question_hash_matches_the_browser(self):
        Q = read_json(os.path.join(AI, 'data', 'questions.json'))
        self.assertGreater(len(Q), 3000)
        bad = [q['id'] for q in Q if q_hash(q) != q['h']]
        self.assertEqual(bad, [])

    def test_hash_reacts_to_key_text_and_option_changes(self):
        q = mkq()
        h0 = q_hash(q)
        self.assertNotEqual(h0, q_hash(mkq(keys=('c',))))
        self.assertNotEqual(h0, q_hash(mkq(stem='Changed stem?')))
        self.assertEqual(h0, q_hash(mkq(stem='Which   structure passes through the   carpal tunnel?')))


class Retrieval(unittest.TestCase):
    def setUp(self):
        self.R = retrieve.LocalRetriever([('src', passages())], {'min_top_score': 0.5, 'focused_k': 3, 'expanded_k': 5})

    def test_finds_the_right_section_and_prints_the_heading_first(self):
        b = self.R.focused(mkq())
        self.assertTrue(b)
        self.assertEqual(b[0]['heading'], 'Carpal tunnel')
        self.assertTrue(b[0]['text'].startswith('Carpal tunnel\n'))
        self.assertIn('Erythrocyte structure', b[0]['text'])                     # the next section is included as surrounding context
        ids = [x['id'] for x in b]
        self.assertEqual(len(ids), len(set(ids)))

    def test_expanded_uses_synonyms(self):
        q = mkq(stem='Which cell contains RBC hemoglobin?', keys=('a',), n=2)
        q['opts'] = [{'o': 'a', 't': 'RBC'}, {'o': 'b', 't': 'WBC'}]
        exp = self.R.expanded(q)
        self.assertTrue(any(x['heading'] == 'Erythrocyte structure' for x in exp))

    def test_no_overlap_gives_no_hit(self):
        q = mkq(stem='zzzz qqqq xxxx', keys=('a',), n=2)
        q['opts'] = [{'o': 'a', 't': 'wwww'}, {'o': 'b', 't': 'vvvv'}]
        self.assertEqual(self.R.focused(q), [])


class Validation(unittest.TestCase):
    def setUp(self):
        self.q = mkq()
        self.blocks = [{'id': 'b1', 'text': 'Carpal tunnel\nThe median nerve passes through the carpal tunnel together with tendons.', 'book': 'Test book', 'chapter': 'Upper Limb', 'page': '10', 'score': 9}]

    def good(self, **over):
        o = {'verification_status': 'verified', 'correct_answer': 'B', 'summary': 'الفكرة إن الـ median nerve هو اللي بيعدّي في الـ carpal tunnel.',
             'correct_explanation': 'ببساطة الكتاب بيقول إن الـ median nerve بيعدّي مع الأوتار في النفق الرسغي.',
             'option_analysis': [{'option': L, 'status': 'correct' if L == 'B' else 'incorrect', 'explanation': 'هنا الاختيار ده %s مش مطابق للمصدر.' % L} for L in 'ABCD'],
             'source_sections': [{'citation_index': 1, 'heading': 'Carpal tunnel', 'quote': 'The median nerve passes through the carpal tunnel'}]}
        o.update(over)
        return o

    def run_v(self, obj, q=None, mode='grounded'):
        return validate.validate(obj, q or self.q, mode, self.blocks if mode == 'grounded' else [])

    def test_good_passes(self):
        e, l, c = self.run_v(self.good())
        self.assertEqual((e, l), ([], []))
        self.assertEqual(c['ca'], 'B')
        self.assertEqual(c['ss'][0]['p'], '10')
        self.assertEqual(c['oa'][1]['s'], 'c')

    def test_english_summary_is_a_language_error(self):
        e, l, c = self.run_v(self.good(summary='The correct answer is B because the book says so.'))
        self.assertIn('summary_not_arabic_led', l)
        self.assertIsNone(c)

    def test_invented_heading_and_quote_are_rejected(self):
        e, _, _ = self.run_v(self.good(source_sections=[{'citation_index': 1, 'heading': 'Invented heading', 'quote': ''}]))
        self.assertIn('heading_not_in_block:1', e)
        e, _, _ = self.run_v(self.good(source_sections=[{'citation_index': 1, 'heading': 'Carpal tunnel', 'quote': 'not in the book at all'}]))
        self.assertIn('quote_not_in_block:1', e)
        e, _, _ = self.run_v(self.good(source_sections=[{'citation_index': 3, 'heading': 'Carpal tunnel'}]))
        self.assertIn('citation_index_out_of_range:3', e)
        e, _, c = self.run_v(self.good(source_sections=[{'citation_index': 1, 'heading': 'Relevant section'}]))
        self.assertEqual(e, [])

    def test_verified_must_match_the_key(self):
        o = self.good(correct_answer='C', option_analysis=[{'option': L, 'status': 'correct' if L == 'C' else 'incorrect', 'explanation': 'هنا شرح الاختيار %s.' % L} for L in 'ABCD'])
        e, _, _ = self.run_v(o)
        self.assertIn('verified_but_answer_differs_from_key', e)

    def test_conflict_rules(self):
        oa = [{'option': 'A', 'status': 'incorrect', 'explanation': 'هنا مش صح.'}, {'option': 'B', 'status': 'conflict', 'explanation': 'ده مفتاح الموقع لكن الكتاب بيقول غير كده.'},
              {'option': 'C', 'status': 'correct', 'explanation': 'ده اللي الكتاب بيدعمه.'}, {'option': 'D', 'status': 'incorrect', 'explanation': 'هنا مش صح.'}]
        o = self.good(verification_status='answer_conflict', correct_answer='C', option_analysis=oa,
                      summary='هنا إجابة الموقع B بتتعارض مع الكتاب، والكتاب بيقول C، والشرح ماشي على الكتاب.')
        e, l, c = self.run_v(o)
        self.assertEqual((e, l), ([], []))
        self.assertEqual(c['st'], 'answer_conflict')
        e, _, _ = self.run_v(dict(o, summary='الكتاب بيقول C بس.'))
        self.assertIn('conflict_summary_missing_letter:B', e)
        e, _, _ = self.run_v(dict(o, correct_answer='B'))
        self.assertTrue(any(x.startswith('conflict_but_answer_equals_key') or x.startswith('correct_marks') for x in e))
        e, _, _ = self.run_v(o, q=mkq(keys=()))
        self.assertIn('conflict_without_stored_key', e)

    def test_insufficient_needs_only_a_summary(self):
        e, l, c = self.run_v({'verification_status': 'insufficient_source', 'summary': 'المقاطع مش بتحسم.'})
        self.assertEqual((e, l), ([], []))
        self.assertEqual(c['st'], 'insufficient_source')

    def test_knowledge_only_needs_the_disclosure_and_no_sources(self):
        o = self.good(verification_status='knowledge_only', summary=prompts.DISCLOSURE + ' الإجابة B.', source_sections=[])
        e, l, c = self.run_v(o, mode='knowledge')
        self.assertEqual((e, l), ([], []))
        e, l, _ = self.run_v(dict(o, summary='الإجابة B هي الأقرب.'), mode='knowledge')
        self.assertIn('summary_missing_disclosure', l)
        e, _, _ = self.run_v(dict(o, source_sections=[{'citation_index': 1, 'heading': 'x'}]), mode='knowledge')
        self.assertIn('knowledge_only_must_have_no_sources', e)
        e, _, _ = self.run_v(self.good(), mode='knowledge')
        self.assertIn('status_must_be_knowledge_only', e)

    def test_every_option_must_be_analysed_once(self):
        o = self.good()
        o['option_analysis'] = o['option_analysis'][:3]
        e, _, _ = self.run_v(o)
        self.assertIn('options_not_analysed:D', e)

    def test_parse_json_is_tolerant(self):
        self.assertEqual(validate.parse_json('```json\n{"a": 1}\n```'), {'a': 1})
        self.assertEqual(validate.parse_json('here you go {"a": 2} thanks'), {'a': 2})
        self.assertIsNone(validate.parse_json('no json'))


class PipelineFlow(unittest.TestCase):
    def test_common_case_is_one_call(self):
        P, provs, bud, _ = mk_pipeline()
        out = P.explain(mkq())
        self.assertEqual((out.reason, out.calls), ('verified', 1))
        self.assertEqual(out.entry['ca'], 'B')
        self.assertEqual(out.entry['h'], mkq()['h'])
        self.assertTrue(out.entry['ss'])

    def test_conflict_follows_the_book_and_is_logged(self):
        P, provs, bud, tmp = mk_pipeline(lambda m: 'conflict')
        out = P.explain(mkq())
        self.assertEqual(out.reason, 'answer_conflict')
        self.assertNotEqual(out.entry['ca'], 'B')
        with open(os.path.join(tmp, 'conflicts.jsonl'), encoding='utf-8') as fh:
            rows = [json.loads(x) for x in fh]
        self.assertEqual(rows[0]['website_key'], ['b'])

    def test_insufficient_goes_to_expanded_then_resolves(self):
        seq = iter(['insufficient', 'ok'])
        extra = [('Erythropoiesis', 'Erythrocyte production occurs in the bone marrow under erythropoietin stimulation.')]
        P, provs, bud, _ = mk_pipeline(lambda m: next(seq), passages_list=passages(extra))
        # the expanded attempt must bring NEW evidence: this section is reachable only through the synonym RBC <-> erythrocyte
        q = mkq(stem='Which cell has hemoglobin?', keys=('a',), n=2)
        q['opts'] = [{'o': 'a', 't': 'RBC'}, {'o': 'b', 't': 'Neuron'}]
        q['h'] = q_hash(q)
        out = P.explain(q)
        self.assertEqual(out.reason, 'verified')
        self.assertEqual(out.calls, 2)

    def test_nothing_in_the_books_falls_back_to_knowledge_with_disclosure(self):
        P, provs, bud, _ = mk_pipeline(passages_list=[])
        out = P.explain(mkq())
        self.assertEqual(out.reason, 'knowledge_only')
        self.assertTrue(out.entry['sm'].startswith(prompts.DISCLOSURE))
        self.assertEqual(out.entry['ss'], [])

    def test_english_summary_gets_the_owner_retry_prompt(self):
        P, provs, bud, _ = mk_pipeline(lambda m: 'english_first')
        seen = []
        orig = provs['mock'].generate
        provs['mock'].generate = lambda s, msgs, sc=None, meta=None: (seen.append(msgs), orig(s, msgs, sc, meta))[1]
        out = P.explain(mkq())
        self.assertEqual((out.reason, out.calls), ('verified', 2))
        self.assertTrue(seen[1][-1]['text'].startswith('CRITICAL RETRY: The previous summary violated the language contract.'))
        self.assertEqual(seen[1][1]['role'], 'model')

    def test_bad_citation_is_never_cached(self):
        P, provs, bud, _ = mk_pipeline(lambda m: 'badquote' if m['mode'] == 'grounded' else 'ok')
        out = P.explain(mkq())
        self.assertEqual(out.reason, 'knowledge_only')                          # validation rejected both grounded stages
        self.assertEqual(out.entry['ss'], [])

    def test_garbage_everywhere_is_unresolved(self):
        P, provs, bud, _ = mk_pipeline(lambda m: 'garbage')
        out = P.explain(mkq())
        self.assertIsNone(out.entry)
        self.assertEqual(out.reason, 'unresolved')

    def test_no_fallback_when_disabled(self):
        P, provs, bud, _ = mk_pipeline(lambda m: 'insufficient', extra_cfg={'pipeline': {'allow_knowledge_fallback': False, 'max_repairs_per_stage': 1}})
        out = P.explain(mkq())
        self.assertIsNone(out.entry)


class Budgets(unittest.TestCase):
    def test_daily_cap_stops_and_the_next_day_resumes(self):
        clock = {'t': datetime.datetime(2026, 11, 10, 12, 0, tzinfo=datetime.timezone.utc)}
        pc = {'mock': {'kind': 'mock', 'rpm': 0, 'rpd': 2, 'tz': 'UTC'}}
        bud = budget.Budget(None, pc, now=lambda: clock['t'], persist=False)
        P, provs, _, _ = mk_pipeline(rpd=2)
        P.budget = bud
        P.explain(mkq('a')); P.explain(mkq('b'))
        with self.assertRaises(pipeline.BudgetExhausted):
            P.explain(mkq('c'))
        clock['t'] += datetime.timedelta(days=1)
        self.assertEqual(P.explain(mkq('c')).reason, 'verified')

    def test_429_blocks_the_provider_and_the_chain_continues(self):
        P, provs, bud, _ = mk_pipeline(chain=('first', 'second'))

        def boom(*a, **k):
            raise providers.RateLimited('quota')
        provs['first'].generate = boom
        out = P.explain(mkq())
        self.assertEqual(out.reason, 'verified')
        self.assertTrue(bud.data['providers']['first']['blocked'])
        self.assertEqual(bud.data['providers']['second']['calls'], 1)

    def test_fatal_provider_error_marks_it_dead(self):
        P, provs, bud, _ = mk_pipeline(chain=('first', 'second'))

        def bad(*a, **k):
            raise providers.ProviderError('HTTP 404: model not found', fatal=True)
        provs['first'].generate = bad
        P.explain(mkq()); P.explain(mkq('x'))
        self.assertIn('first', P.dead)
        self.assertEqual(bud.data['providers'].get('first', {}).get('calls', 0), 0)


class SharedCache(unittest.TestCase):
    def test_cached_question_is_not_regenerated_and_a_changed_key_is(self):
        tmp = tempfile.mkdtemp()
        c = store.Cache(tmp)
        P, provs, bud, _ = mk_pipeline()
        q = mkq()
        c.put('anatomy', P.explain(q).entry)
        c.save('anatomy')
        c2 = store.Cache(tmp)
        pv = prompts.prompt_version()
        self.assertEqual(c2.current(q, pv), 'ok')
        q2 = mkq(keys=('c',))                                                     # the site corrected the key (js/fixes.js)
        self.assertEqual(c2.current(q2, pv), 'stale')
        e = c2.get('anatomy', 'q1'); e['pv'] = 'old'
        self.assertEqual(c2.current(q, pv), 'old-prompt')
        m = c2.write_manifest([q], pv)
        self.assertEqual(m['subjects']['anatomy']['explained'], 1)
        self.assertTrue(os.path.exists(os.path.join(tmp, 'manifest.json')))


@unittest.skipUnless(os.path.exists(os.path.join(AI, 'data', 'questions.json')), 'export the bank first')
class CliEndToEnd(unittest.TestCase):
    def run_cli(self, *args):
        return subprocess.run([sys.executable, os.path.join(AI, 'run.py')] + list(args), capture_output=True, text=True, timeout=300)

    def test_bake_is_resumable_and_idempotent_and_check_passes(self):
        tmp = tempfile.mkdtemp()
        base = ['--provider', 'mock', '--state-dir', tmp + '/state', '--cache-dir', tmp + '/cache']
        r1 = self.run_cli('bake', '--limit', '12', *base)
        self.assertEqual(r1.returncode, 0, r1.stdout + r1.stderr)
        self.assertIn('12 اتولّد', r1.stdout)
        r2 = self.run_cli('bake', '--limit', '12', *base)                          # same 12 are cached; the NEXT 12 are generated
        self.assertIn('12 اتولّد', r2.stdout)
        files = os.listdir(tmp + '/cache')
        self.assertIn('anatomy.json', files)
        self.assertIn('manifest.json', files)
        with open(tmp + '/cache/anatomy.json', encoding='utf-8') as fh:
            ids = set(json.load(fh)['items'])
        self.assertEqual(len(ids), 24)
        r3 = self.run_cli('check', '--cache-dir', tmp + '/cache')
        self.assertEqual(r3.returncode, 0, r3.stdout)
        # a mock bake must never touch the real shared cache
        self.assertFalse(os.path.exists(os.path.join(os.path.dirname(os.path.dirname(AI)), 'ai', 'anatomy.json')))


class ConvertBook(unittest.TestCase):
    """tools/ai/convert_book.py: كتاب بذيل رقم صفحة -> .md بعناوين وأرقام صفحات مطبوعة، كل صفحة قسم لوحدها"""
    PROFILE = {'book': 'T', 'input': {'kind': 'footer-txt', 'footer': r'^ISK 101 — Normal Structure of the Human Body\s*(\d+)?\s*$'},
               'drop': [r'^©\s*Faculty.*$', r'^ISK 101 — Normal Structure of the Human Body\s*\d*\s*$'], 'header': 'first-line', 'first_page': 10, 'caps_heading': True,
               'chapters': [[10, 'Basics — Skeletal System'], [12, 'Basics — Fascia']]}
    RAW = ('cover\nISK 101 — Normal Structure of the Human Body\n© Faculty of Medicine, Cairo University.\n\n'
           'Skeletal syst\n\uf0b7 Bones give shape.\nBONES\nIt is a hard tissue.\nISK 101 — Normal Structure of the Human Body 10\n© Faculty of Medicine, Cairo University.\n\n'
           'Skeletal syst\nSecond page text with a | table   col1   col2\nISK 101 — Normal Structure of the Human Body 11\n© Faculty of Medicine, Cairo University.\n\n'
           'Fascia\nCHAPTER 2\nDeep fascia covers muscles.\nISK 101 — Normal Structure of the Human Body 12\n© Faculty of Medicine, Cairo University.\n')

    def conv(self):
        sys.path.insert(0, AI)
        import convert_book
        f = os.path.join(tempfile.mkdtemp(), 'b.txt')
        with open(f, 'w', encoding='utf-8') as fh:
            fh.write(self.RAW)
        return convert_book.convert(self.PROFILE, f)

    def test_pages_chapters_headings_and_noise(self):
        md, info = self.conv()
        self.assertEqual(info['pages'], 3)
        self.assertEqual([c[0] for c in info['chapters']], [10, 12])                 # الفصل من جدول الفهرس مش من النص
        self.assertIn('# Basics — Skeletal System\n[[p.10]]', md)
        self.assertIn('[[p.11]]', md); self.assertIn('[[p.12]]', md)
        self.assertNotIn('Faculty of Medicine', md)                                   # الذيل المطبوع اتشال
        self.assertNotIn('Skeletal syst', md)                                         # العنوان الجاري اتشال من النص
        self.assertIn('• Bones give shape.', md)                                      # رمز النقطة المكسور اتحوّل
        self.assertNotIn('CHAPTER 2', md)
        self.assertIn('## BONES', md)
        self.assertIn('## BONES\n[[p.11]]', md)                                       # العنوان بيتكرّر قبل كل صفحة جديدة: القسم ما بيعدّيش حدود الصفحة
        self.assertIn('col1 | col2', md)                                              # أعمدة الجدول فضلت مفصولة

    def test_round_trip_page_numbers_are_exact(self):
        md, _ = self.conv()
        d = tempfile.mkdtemp()
        with open(os.path.join(d, 'b.md'), 'w', encoding='utf-8') as fh:
            fh.write(md)
        ps = books.from_text_file('anatomy', {'id': 'x', 'title': 'T', 'caps': False}, os.path.join(d, 'b.md'), 260)
        by_page = {}
        for p in ps:
            by_page.setdefault(p['page'], []).append(p)
        txt = {k: ' '.join(x['text'] for x in v).lower() for k, v in by_page.items()}
        self.assertIn('bones give shape', txt['10']); self.assertIn('it is a hard tissue', txt['10'])
        self.assertIn('second page text', txt['11'])
        self.assertNotIn('second page text', txt['10'])                               # مفيش نص صفحة بيتنسب لصفحة غيرها
        self.assertEqual(by_page['12'][0]['chapter'], 'Basics — Fascia')

    def test_helpers(self):
        import convert_book as cb
        self.assertTrue(cb.is_caps_heading('MICROSCOPES')); self.assertTrue(cb.is_caps_heading('DEEP FASCIA OF THE PALM'))
        self.assertFalse(cb.is_caps_heading('CHAPTER 3')); self.assertFalse(cb.is_caps_heading('Light microscope')); self.assertFalse(cb.is_caps_heading('FIG 1.2 SHOWS'))
        self.assertEqual(cb.printed_number(['text', '', '   125', '© Faculty']), 125)
        self.assertIsNone(cb.printed_number(['text only']))

    def test_profiles_contain_no_book_text(self):
        pd = os.path.join(AI, 'book_profiles')
        for f in os.listdir(pd):
            d = read_json(os.path.join(pd, f))
            self.assertTrue(d.get('book')); self.assertLess(len(json.dumps(d)), 4000)    # أرقام فصول وأسماء بس، مش نص الكتاب (الملفات دي بتتنشر)


class SourceReadiness(unittest.TestCase):
    def test_missing_text_source_does_not_count(self):
        run = __import__('run')
        srcs = {'zz': [{'id': 'zz-book', 'kind': 'text', 'dir': 'no_such_folder_zz'}]}
        self.assertFalse(run.has_source(srcs, 'zz'))                                  # غير كده الـ Action كانت هتولّد knowledge_only لمادة من غير كتابها
        self.assertEqual(books.load_sources(srcs, 'zz'), [])

    def test_present_text_source_counts_and_caps_option(self):
        run = __import__('run')
        d = tempfile.mkdtemp(); folder = os.path.join(d, 'f'); os.makedirs(folder)
        with open(os.path.join(folder, 'b.md'), 'w', encoding='utf-8') as fh:
            fh.write('# Chapter\n[[p.3]]\nSome text.\nSTRAY LABEL\nMore text after the label.\n')
        old = books.BOOKS_DIR; books.BOOKS_DIR = d
        try:
            srcs = {'zz': [{'id': 'zz-book', 'kind': 'text', 'dir': 'f'}]}
            self.assertTrue(run.has_source(srcs, 'zz'))
            on = books.load_sources(srcs, 'zz')[0][1]
            off = books.load_sources({'zz': [{'id': 'zz-book', 'kind': 'text', 'dir': 'f', 'caps': False}]}, 'zz')[0][1]
        finally:
            books.BOOKS_DIR = old
        self.assertEqual(len(on), 2)                                                   # بالافتراض سطر كله حروف كبيرة = عنوان قسم جديد
        self.assertEqual(len(off), 1)                                                  # caps:false بيقفل ده (الكتب المحوّلة عنوانها صريح)


class NoSecrets(unittest.TestCase):
    def test_no_key_like_strings_in_the_tool_files(self):
        pat = re.compile(r'(AIza[0-9A-Za-z_\-]{20,}|gsk_[0-9A-Za-z]{20,}|sk-[0-9A-Za-z]{20,}|AKfycb[0-9A-Za-z_\-]{20,})')
        for root, _, fs in os.walk(AI):
            if '__pycache__' in root or os.sep + 'data' in root:
                continue
            for f in fs:
                if f.endswith(('.py', '.json', '.txt', '.md', '.js', '.yml')):
                    with open(os.path.join(root, f), encoding='utf-8', errors='replace') as fh:
                        t = fh.read()
                    self.assertIsNone(pat.search(t), f)


if __name__ == '__main__':
    unittest.main()
