#!/usr/bin/env python3
"""Imhotep explainer: bake grounded explanations into the shared cache (<site>/ai/*.json). Zero cost: free-tier quotas only, resumable.

  python3 tools/ai/run.py status                       coverage per subject + today's quota usage
  python3 tools/ai/run.py plan [--subject S] [-n 20]   the next questions the batch would do
  python3 tools/ai/run.py bake [--limit N] [--subject S] [--provider P] [--ids a,b] [--refresh-old] [--retry-failed]
  python3 tools/ai/run.py coverage [--subject S] [--csv f]  كام سؤال ليه سند في الكتب (بحث محلي بس، من غير موديل ولا تكلفة)
  python3 tools/ai/run.py check                        validate the cache files (exit 1 on problems)
  python3 tools/ai/run.py conflicts                    questions where the book contradicts the website key
Keys come from environment variables only (names in config.json): GEMINI_API_KEY, GROQ_API_KEY ...
The questions/books snapshot is tools/ai/data/*.json, made by:  NODE_PATH=$(npm root -g) node tools/ai/export_bank.js .
"""
import argparse, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from imai import ROOT, CACHE_DIR, prompts, books, retrieve, providers, store, budget, pipeline, validate   # noqa: E402
from imai.util import read_json, write_json, q_hash, arabic_ratio, starts_arabic                           # noqa: E402

FAIL_LIMIT = 3


def load_all(a=None):
    cfg = read_json(os.path.join(ROOT, 'config.json'))
    srcs = read_json(os.path.join(ROOT, 'sources.json'))
    Q = read_json(os.path.join(ROOT, 'data', 'questions.json'))
    if not Q:
        sys.exit('مفيش tools/ai/data/questions.json. شغّل: NODE_PATH=$(npm root -g) node tools/ai/export_bank.js .')
    return cfg, srcs, Q, {q['id']: q for q in Q}


def priority_ids(state):
    p = os.path.join(state, 'priority.txt')
    if not os.path.exists(p):
        return []
    with open(p, encoding='utf-8') as f:
        return [x.strip() for x in f if x.strip() and not x.startswith('#')]


def order(Q, cfg, state, subject=None):
    pr = priority_ids(state)
    rank = {sid: i for i, sid in enumerate((cfg.get('pipeline') or {}).get('subject_order') or ['anatomy', 'biochemistry', 'histology', 'physiology'])}
    by = {q['id']: q for q in Q}
    first = [by[i] for i in pr if i in by]
    firstset = {q['id'] for q in first}
    rest = sorted((q for q in Q if q['id'] not in firstset), key=lambda q: rank.get(q['sid'], 99))     # stable: file order inside a subject
    out = first + rest
    return [q for q in out if not subject or q['sid'] == subject]


def has_source(srcs, sid):
    """في مصدر فعلاً (النص موجود على الجهاز ده)، مش بس مكتوب في sources.json. غير كده المادة بتتخطّى بدل ما تتولّد من غير كتاب."""
    return any(books.source_ready(s, sid) for s in (srcs.get(sid) or []))


def todo_list(Q, cfg, srcs, cache, state, subject=None, ids=None, refresh_old=False, retry_failed=False):
    pcfg = cfg.get('pipeline', {})
    pv = prompts.prompt_version()
    fails = read_json(os.path.join(state, 'failures.json'), {}) or {}
    out, why = [], {}
    for q in order(Q, cfg, state, subject):
        if ids and q['id'] not in ids:
            continue
        if not q['stem'] or not q['opts']:
            continue
        if pcfg.get('skip_cancelled', True) and q['canc']:
            why['cancelled'] = why.get('cancelled', 0) + 1; continue
        if pcfg.get('skip_subjects_without_source', True) and not has_source(srcs, q['sid']):
            why['no-source:' + q['sid']] = why.get('no-source:' + q['sid'], 0) + 1; continue
        cur = cache.current(q, pv)
        if cur == 'ok' or (cur == 'old-prompt' and not refresh_old):
            continue
        f = fails.get(q['id'])
        if f and f.get('h') == q['h'] and f.get('n', 0) >= FAIL_LIMIT and not retry_failed:
            why['failed-%d-times' % FAIL_LIMIT] = why.get('failed-%d-times' % FAIL_LIMIT, 0) + 1; continue
        out.append(q)
    return out, why


def make_retriever_factory(cfg, srcs, provs):
    rc = cfg.get('retrieval', {})
    cache = {}

    def get(sid):
        if sid in cache:
            return cache[sid]
        r = None
        if has_source(srcs, sid):
            if rc.get('kind') == 'file_search':
                fp = rc.get('file_search', {})
                p = provs.get(fp.get('provider'))
                r = retrieve.FileSearchRetriever(p, fp['store'], prompts) if p else None
            else:
                r = retrieve.LocalRetriever(books.load_sources(srcs, sid, rc.get('max_block_words', 260)), rc, books.source_meta(srcs, sid))
        cache[sid] = r
        return r
    return get


def cmd_status(a):
    cfg, srcs, Q, _ = load_all()
    cache = store.Cache(a.cache_dir or CACHE_DIR)
    pv = prompts.prompt_version()
    bud = budget.Budget(os.path.join(a.state_dir or os.path.join(ROOT, 'state'), 'ledger.json'), cfg['providers'])
    print('نسخة البرومبتات:', pv)
    print('%-13s %9s %8s %7s %9s %10s  %s' % ('المادة', 'الأسئلة', 'جاهز', 'قديم', 'برومبت-قديم', 'خلاص؟', 'المصادر'))
    for sid in sorted({q['sid'] for q in Q}):
        qs = [q for q in Q if q['sid'] == sid and not q['canc']]
        c = {'ok': 0, 'stale': 0, 'old-prompt': 0, 'none': 0}
        for q in qs:
            c[cache.current(q, pv)] += 1
        listed = srcs.get(sid) or []
        n_src = sum(1 for x in listed if books.source_ready(x, sid))
        why = ('%d مصدر' % n_src) if n_src else ('مصدر متسجّل بس نصه مش موجود هنا (هيتخطّى)' if listed else 'مفيش مصدر (هيتخطّى)')
        print('%-13s %9d %8d %7d %9d %10s  %s' % (sid, len(qs), c['ok'] + c['old-prompt'], c['stale'], c['old-prompt'], 'لا' if c['none'] + c['stale'] else 'ايوه', why))
    print('\nالحصة النهارده:')
    for n in cfg['chain']:
        s = bud.summary()[n]
        print('  %-18s %5d / %-6s %s' % (n, s['calls'], s['rpd'], 'مقفول (429)' if s['blocked'] else ''))
    conf = os.path.join(a.state_dir or os.path.join(ROOT, 'state'), 'conflicts.jsonl')
    if os.path.exists(conf):
        print('\nتعارضات مع الكتاب مسجّلة:', sum(1 for _ in open(conf, encoding='utf-8')))


def cmd_plan(a):
    cfg, srcs, Q, _ = load_all()
    state = a.state_dir or os.path.join(ROOT, 'state')
    cache = store.Cache(a.cache_dir or CACHE_DIR)
    todo, why = todo_list(Q, cfg, srcs, cache, state, a.subject, set(a.ids.split(',')) if a.ids else None, a.refresh_old, a.retry_failed)
    print('المتبقي:', len(todo), '| متخطّى:', why)
    for q in todo[:a.n]:
        print(' ', q['id'], q['sid'], q['part']['en'][:30], '|', q['stem'][:70].replace('\n', ' '))


def cmd_bake(a):
    cfg, srcs, Q, by_id = load_all()
    state = a.state_dir or os.path.join(ROOT, 'state')
    os.makedirs(state, exist_ok=True)
    chain = [a.provider] if a.provider else list(cfg['chain'])
    pcfg = cfg['providers']
    temp = float((cfg.get('pipeline') or {}).get('temperature', 0.2))
    provs = {}
    for n in chain:
        p = providers.build(n, pcfg[n], temp)
        if p.ready():
            provs[n] = p
        else:
            print('  تخطّي %s: متغيّر البيئة %s مش موجود' % (n, pcfg[n].get('key_env')))
    chain = [n for n in chain if n in provs]
    if not chain:
        sys.exit('مفيش مزوّد جاهز (محتاج مفتاح في متغيّر بيئة). للتجربة من غير شبكة: --provider mock')
    mock = all(pcfg[n]['kind'] == 'mock' for n in chain)
    cache_dir = a.cache_dir or (os.path.join(state, 'mock-cache') if mock else CACHE_DIR)
    if mock:
        print('⚠ مزوّد وهمي: الشروح بتتكتب في', cache_dir, '(مش في ai/) وبلا حصة.')
    cache = store.Cache(cache_dir)
    bud = budget.Budget(os.path.join(state, 'ledger.json'), pcfg, persist=not mock)
    pipe = pipeline.Pipeline(cfg, bud, provs, chain, make_retriever_factory(cfg, srcs, provs), by_id, os.path.join(state, 'conflicts.jsonl'))
    todo, why = todo_list(Q, cfg, srcs, cache, state, a.subject, set(a.ids.split(',')) if a.ids else None, a.refresh_old, a.retry_failed)
    if a.limit:
        todo = todo[:a.limit]
    print('هنعالج %d سؤال | متخطّى: %s | المزوّدين: %s' % (len(todo), why, ', '.join(chain)))
    fails_path = os.path.join(state, 'failures.json')
    fails = read_json(fails_path, {}) or {}
    done = failed = 0
    stopped = ''
    for i, q in enumerate(todo, 1):
        try:
            out = pipe.explain(q)
        except pipeline.BudgetExhausted as e:
            stopped = str(e)
            break
        if out.entry:
            cache.put(q['sid'], out.entry)
            cache.save(q['sid'])
            fails.pop(q['id'], None)
            done += 1
            print('  [%d/%d] %s ← %s (%d مكالمة)' % (i, len(todo), q['id'], out.reason, out.calls))
        else:
            f = fails.get(q['id']) or {'n': 0}
            fails[q['id']] = {'n': f['n'] + 1, 'h': q['h'], 'reason': out.reason, 'log': out.log[-3:]}
            failed += 1
            print('  [%d/%d] %s ✗ %s' % (i, len(todo), q['id'], out.reason))
        write_json(fails_path, fails)
    cache.write_manifest(Q, prompts.prompt_version())
    print('\nخلص: %d اتولّد، %d فشل%s' % (done, failed, ('، وقفنا: ' + stopped + ' (كمّل بعدين، هيكمّل من مكانه)') if stopped else ''))
    print('الحصة:', json.dumps(bud.summary(), ensure_ascii=False))


def cmd_coverage(a):
    """قياس بحث بحت (مفيش موديل): لكل سؤال بنسأل الاسترجاع المحلي ونشوف الإجابة المخزّنة موجودة في المقاطع اللي رجعت ولا لأ.
    strong = كل كلمات إجابة المفتاح تقريباً في المقاطع | partial = جزء منها | weak = البحث رجّع مقاطع بس من غير إجابة واضحة | none = مفيش مقطع فوق الحد."""
    import csv, collections
    cfg, srcs, Q, _ = load_all()
    rc = cfg.get('retrieval', {})
    floor = rc.get('min_top_score', 4.0)
    rows, out = [], {}
    for sid in sorted({q['sid'] for q in Q}):
        if a.subject and sid != a.subject:
            continue
        if not has_source(srcs, sid):
            print('%-13s مفيش مصدر' % sid); continue
        loaded = books.load_sources(srcs, sid, rc.get('max_block_words', 260))
        r = retrieve.LocalRetriever(loaded, rc, books.source_meta(srcs, sid))
        qs = [q for q in Q if q['sid'] == sid and not q['canc'] and q['stem'] and q['opts']]
        cnt = collections.Counter(); bysrc = collections.Counter(); chap = collections.Counter(); chap_ok = collections.Counter()
        for q in qs:
            blocks = r.focused(q)
            top = blocks[0]['score'] if blocks else 0.0
            keytxt = ' '.join(o['t'] for o in q['opts'] if o['o'] in q['keys'])
            kt = set(retrieve.tokenize(keytxt))
            ev = set(retrieve.tokenize(' '.join(b['text'] for b in blocks[:3])))
            cov = (len(kt & ev) / len(kt)) if kt else None
            if not blocks or top < floor:
                lv = 'none'
            elif cov is None:
                lv = 'weak'
            elif cov >= 0.85:
                lv = 'strong'
            elif cov >= 0.5:
                lv = 'partial'
            else:
                lv = 'weak'
            src = blocks[0]['id'].split(':')[0] if blocks else ''
            cnt[lv] += 1; bysrc[(src, lv)] += 1
            if blocks:
                chap[blocks[0]['chapter']] += 1
                if lv in ('strong', 'partial'):
                    chap_ok[blocks[0]['chapter']] += 1
            rows.append([q['id'], sid, lv, '%.1f' % top, '' if cov is None else '%.2f' % cov, src, blocks[0]['chapter'] if blocks else '', blocks[0]['page'] if blocks else '',
                         q['stem'][:90].replace('\n', ' ')])
        n = len(qs)
        out[sid] = (n, cnt)
        print('\n%s: %d سؤال' % (sid, n))
        for lv in ('strong', 'partial', 'weak', 'none'):
            print('  %-8s %5d  %5.1f%%' % (lv, cnt[lv], 100.0 * cnt[lv] / max(1, n)))
        if len({k[0] for k in bysrc}) > 1:
            for (sd, lv), c in sorted(bysrc.items()):
                print('    من %-22s %-8s %d' % (sd, lv, c))
        print('  الفصول اللي بترجع (أول مقطع): سند كويّس / كل الأسئلة اللي راحتله')
        for c, k in chap.most_common(a.n):
            print('    %-62s %4d / %d' % (c[:62], chap_ok[c], k))
    if a.csv:
        with open(a.csv, 'w', encoding='utf-8-sig', newline='') as f:
            w = csv.writer(f); w.writerow(['id', 'subject', 'level', 'top_score', 'key_coverage', 'source', 'chapter', 'page', 'stem'])
            w.writerows(rows)
        print('\nCSV:', a.csv)


def cmd_check(a):
    cfg, srcs, Q, by_id = load_all()
    cdir = a.cache_dir or CACHE_DIR
    cache = store.Cache(cdir)
    problems = 0
    for sid in sorted({q['sid'] for q in Q}):
        f = cache._file(sid)
        n = stale = 0
        for qid, e in f['items'].items():
            n += 1
            q = by_id.get(qid)
            if not q:
                print('✗ %s: السؤال مش موجود في البنك' % qid); problems += 1; continue
            if e.get('h') != q_hash(q):
                stale += 1; continue
            opts = {o['o'].upper() for o in q['opts']}
            bad = []
            if e['st'] not in ('verified', 'answer_conflict', 'knowledge_only'):
                bad.append('status')
            if not (starts_arabic(e['sm']) and arabic_ratio(e['sm']) >= 0.4):
                bad.append('summary-language')
            if not e['ca'] or not set(e['ca'].split(',')) <= opts:
                bad.append('correct-answer')
            if {x['o'].upper() for x in e['oa']} != opts:
                bad.append('options-coverage')
            if e['st'] == 'verified' and q['keys'] and set(e['ca'].split(',')) != {k.upper() for k in q['keys']}:
                bad.append('verified-differs-from-key')
            if e['st'] != 'knowledge_only' and not e['ss']:
                bad.append('no-citation')
            if e['st'] == 'knowledge_only' and e['ss']:
                bad.append('citation-in-knowledge-only')
            if bad:
                print('✗ %s: %s' % (qid, ', '.join(bad))); problems += 1
        print('%-13s %5d شرح، منهم %d قديم (السؤال/المفتاح اتغيّر وهيتعاد توليده)' % (sid, n, stale))
    print('المشاكل:', problems)
    sys.exit(1 if problems else 0)


def cmd_conflicts(a):
    p = os.path.join(a.state_dir or os.path.join(ROOT, 'state'), 'conflicts.jsonl')
    if not os.path.exists(p):
        print('مفيش تعارضات مسجّلة.'); return
    for ln in open(p, encoding='utf-8'):
        c = json.loads(ln)
        src = c['sources'][0] if c['sources'] else {}
        print('%s | مفتاح الموقع %s ← الكتاب %s%s | %s p.%s' % (c['id'], '+'.join(k.upper() for k in c['website_key']), c['book_answer'],
                                                              ' (سؤال مراجَع!)' if c.get('reviewed') else '', src.get('h', ''), src.get('p', '')))
        print('    ', c['summary'][:160])


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('cmd', choices=['status', 'plan', 'bake', 'check', 'conflicts', 'coverage'])
    ap.add_argument('--subject'); ap.add_argument('--provider'); ap.add_argument('--ids')
    ap.add_argument('--limit', type=int, default=0); ap.add_argument('-n', type=int, default=20)
    ap.add_argument('--refresh-old', action='store_true'); ap.add_argument('--retry-failed', action='store_true')
    ap.add_argument('--cache-dir'); ap.add_argument('--state-dir'); ap.add_argument('--csv')
    a = ap.parse_args()
    {'status': cmd_status, 'plan': cmd_plan, 'bake': cmd_bake, 'check': cmd_check, 'conflicts': cmd_conflicts, 'coverage': cmd_coverage}[a.cmd](a)


if __name__ == '__main__':
    main()
