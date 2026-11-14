"""Prompt assembly. The prompt files in tools/ai/prompts/ are the owner's text, byte for byte: this module never edits them,
it only composes them (swap the strategy part, plug the language contract in, fill the question template)."""
import hashlib, json, os, re

from . import ROOT

PDIR = os.path.join(ROOT, 'prompts')
SCHEMA_PATH = os.path.join(ROOT, 'schema', 'explanation.schema.json')
_cache = {}

DISCLOSURE = 'الإجابة غير موجودة بشكل واضح في المصدر المتاح، لذلك الشرح التالي مبني على المعرفة الطبية العامة للذكاء الاصطناعي.'
NO_EVIDENCE = 'NO_DECISIVE_EVIDENCE'

_STRATEGY_FIRST = 'This is the focused retrieval attempt.'
_STRATEGY_LAST = 'For negative, EXCEPT, FALSE, or inverse stems, search both the stated wording and the corresponding positive rule.'
_STYLE_PLACEHOLDER = re.compile(r'^\[تعليمات الأسلوب[^\n]*\]\s*$', re.M)


def load(name):
    if name not in _cache:
        with open(os.path.join(PDIR, name), 'r', encoding='utf-8') as f:
            _cache[name] = f.read()
    return _cache[name]


def schema():
    with open(SCHEMA_PATH, 'r', encoding='utf-8') as f:
        return json.load(f)


def prompt_version():
    """Short id of the prompt set: any edit to a prompt or to the schema changes it (reported by `status`, never auto-regenerated)."""
    h = hashlib.sha256()
    for n in sorted(os.listdir(PDIR)):
        if n.endswith('.txt'):
            h.update(n.encode()); h.update(load(n).encode('utf-8'))
    with open(SCHEMA_PATH, 'rb') as f:
        h.update(f.read())
    return h.hexdigest()[:8]


# ---------- system prompts ----------
def retrieval_system(attempt):
    """File Search retrieval attempts. The expanded attempt REPLACES the strategy lines of the focused prompt with prompt 02."""
    base = load('01_retrieval_focused.txt')
    if attempt == 'focused':
        return base
    lines = base.split('\n')
    try:
        a = lines.index(_STRATEGY_FIRST)
        b = lines.index(_STRATEGY_LAST)
    except ValueError:
        raise RuntimeError('01_retrieval_focused.txt: strategy markers not found; the expanded swap cannot be done')
    return '\n'.join(lines[:a] + [load('02_retrieval_expanded.txt').rstrip('\n')] + lines[b + 1:])


def _with_style(text):
    contract = load('03_language_contract.txt').rstrip('\n')
    if not _STYLE_PLACEHOLDER.search(text):
        raise RuntimeError('style placeholder line not found in prompt')
    return _STYLE_PLACEHOLDER.sub(lambda m: contract, text)


def tutor_system(mode):
    if mode == 'grounded':
        return _with_style(load('04_grounded_tutor.txt'))
    if mode == 'knowledge':
        return _with_style(load('05_fallback_knowledge.txt'))
    raise ValueError(mode)


def retry_message():
    return load('06_language_retry.txt').rstrip('\n')


# ---------- the question message ----------
def _answer_line(q):
    if not q['keys']:
        return '(no stored answer key for this question: solve it from the evidence)'
    out = []
    for k in q['keys']:
        txt = next((o['t'] for o in q['opts'] if o['o'] == k), '')
        out.append('%s. %s' % (k.upper(), txt))
    return ' + '.join(out) if len(out) > 1 else out[0]


def build_input(q, cfg_subject=None, subject_name='', chapter_name='', case_context=''):
    """Fill prompts/input_template.txt. Empty option lines and the matching-pairs lines are dropped; options beyond E are appended."""
    cs = cfg_subject or {}
    tpl = load('input_template.txt').rstrip('\n').split('\n')
    stem = q['stem']
    if case_context:
        stem = 'Case (shared stem of this question set): ' + case_context + '\n\n' + stem
    by = {o['o'].lower(): o['t'] for o in q['opts']}
    vals = {'year': cs.get('year') or 'Not specified', 'module': cs.get('module') or 'Not specified',
            'subject': subject_name, 'chapter': chapter_name, 'question': stem, 'correct_answer': _answer_line(q)}
    out = []
    pair_line = re.compile(r'^\d+\. \{left\} => \{right\}$')
    for ln in tpl:
        m = re.match(r'^([A-E])\. \{option_([a-e])\}$', ln)
        if m:
            t = by.get(m.group(1).lower(), '')
            if t:
                out.append('%s. %s' % (m.group(1), t))
            if m.group(1) == 'E':
                for o in q['opts']:                                   # F, G, H... (a few questions have 6 or 8 options)
                    if o['o'].lower() not in 'abcde' and o['t']:
                        out.append('%s. %s' % (o['o'].upper(), o['t']))
            continue
        if ln.startswith('Matching pairs'):
            continue                                                  # header is re-added only when the question has pairs
        if pair_line.match(ln):
            pairs = q.get('pairs') or []
            if pairs:
                out.append('Matching pairs (إن وجدت):')
                for i, p in enumerate(pairs, 1):
                    out.append('%d. %s => %s' % (i, p[0], p[1]))
            continue
        out.append(re.sub(r'\{(year|module|subject|chapter|question|correct_answer)\}', lambda m2: vals[m2.group(1)], ln))
    return re.sub(r'\n{3,}', '\n\n', '\n'.join(out))


def evidence_text(blocks):
    """The evidence excerpts as the grounded prompt expects them: numbered blocks, each starting with its printed heading."""
    parts = []
    for i, b in enumerate(blocks, 1):
        parts.append('[Evidence block %d]\n%s' % (i, b['text']))
    return '\n\n'.join(parts)


def schema_text():
    return json.dumps(schema(), ensure_ascii=False, indent=1)


def tutor_user(q, blocks, mode, **kw):
    msg = build_input(q, **kw)
    if mode == 'grounded':
        msg += '\n\nFile Search evidence excerpts (the ONLY allowed source):\n' + evidence_text(blocks)
    msg += '\n\nReturn ONLY one JSON object that follows this JSON Schema (field names exactly as written):\n' + schema_text()
    return msg
