"""Deterministic checks on the model's answer. The prompts ask for a lot (Arabic-led text, exact headings, no invented citations, key-vs-book
conflict handling); the model is not trusted to police itself, so the code does. Returns (errors, language_errors, clean_entry_fragment)."""
import json, re

from . import prompts
from .util import arabic_ratio, has_arabic_early, norm_ws, starts_arabic

STATUSES = ('verified', 'answer_conflict', 'insufficient_source', 'knowledge_only')
_OPT_STATUS = {'correct': 'c', 'incorrect': 'i', 'conflict': 'x'}


def parse_json(text):
    """tolerant: strips ``` fences and takes the outermost {...}."""
    if not text:
        return None
    t = text.strip()
    t = re.sub(r'^```(?:json)?\s*|\s*```$', '', t, flags=re.I)
    try:
        v = json.loads(t)
        return v if isinstance(v, dict) else None
    except ValueError:
        pass
    a, b = t.find('{'), t.rfind('}')
    if a >= 0 and b > a:
        try:
            v = json.loads(t[a:b + 1])
            return v if isinstance(v, dict) else None
        except ValueError:
            return None
    return None


def _squash(s):
    return re.sub(r'\s+', ' ', re.sub(r'[​-‏‪-‮﻿]', '', s or '')).strip().lower()


def _letters(s, valid):
    s = str(s or '')
    if len(s) > 16:
        return None
    got = []
    for c in re.findall(r'[A-Ha-h]', s):
        c = c.upper()
        if c in valid and c not in got:
            got.append(c)
    return got


def validate(obj, q, mode, blocks):
    errors, lang = [], []
    if not isinstance(obj, dict):
        return ['not_json_object'], [], None
    for k in ('verification_status', 'summary'):
        if not isinstance(obj.get(k), str) or not obj.get(k).strip():
            errors.append('missing:' + k)
    if errors:
        return errors, lang, None
    st = obj['verification_status'].strip()
    if st not in STATUSES:
        return ['bad_status:' + st], lang, None
    if mode == 'grounded' and st == 'knowledge_only':
        return ['knowledge_only_not_allowed_with_evidence'], lang, None
    if mode == 'knowledge' and st != 'knowledge_only':
        return ['status_must_be_knowledge_only'], lang, None

    summary = norm_ws(obj['summary'])
    if st == 'insufficient_source':
        return [], [], {'st': st, 'ca': '', 'sm': summary, 'ce': '', 'oa': [], 'ss': []}

    opts = [o['o'].upper() for o in q['opts'] if o['t']]
    keys = [k.upper() for k in q['keys']]
    ca = _letters(obj.get('correct_answer'), set(opts))
    if not ca:
        errors.append('bad_correct_answer')
    ce = norm_ws(obj.get('correct_explanation'))
    if not ce:
        errors.append('missing:correct_explanation')

    # ---- option analysis: every non-empty option exactly once
    oa_raw = obj.get('option_analysis')
    oa = []
    if not isinstance(oa_raw, list) or not oa_raw:
        errors.append('missing:option_analysis')
    else:
        seen = set()
        for it in oa_raw:
            if not isinstance(it, dict):
                errors.append('bad_option_item'); continue
            L = _letters(it.get('option'), set(opts))
            s = str(it.get('status') or '').strip().lower()
            e = norm_ws(it.get('explanation'))
            if not L or len(L) != 1:
                errors.append('bad_option_letter:%s' % it.get('option')); continue
            if L[0] in seen:
                errors.append('duplicate_option:' + L[0]); continue
            if s not in _OPT_STATUS:
                errors.append('bad_option_status:%s' % s); continue
            if not e:
                errors.append('empty_option_explanation:' + L[0]); continue
            seen.add(L[0])
            oa.append({'o': L[0].lower(), 's': _OPT_STATUS[s], 'e': e})
        missing = [o for o in opts if o not in seen]
        if missing:
            errors.append('options_not_analysed:' + ','.join(missing))

    # ---- status vs the stored key
    if ca and oa:
        marked = {x['o'].upper() for x in oa if x['s'] == 'c'}
        conflicts = {x['o'].upper() for x in oa if x['s'] == 'x'}
        if marked != set(ca):
            errors.append('correct_marks_differ_from_correct_answer')
        if st == 'verified':
            if keys and set(ca) != set(keys):
                errors.append('verified_but_answer_differs_from_key')
            if conflicts:
                errors.append('conflict_mark_in_verified')
        elif st == 'answer_conflict':
            if not keys:
                errors.append('conflict_without_stored_key')
            elif set(ca) == set(keys):
                errors.append('conflict_but_answer_equals_key')
            else:
                want = {k for k in keys if k in opts}
                if conflicts != want:
                    errors.append('website_key_choice_not_marked_conflict')
                for L in sorted(set(keys) | set(ca)):                # the summary must name both answers
                    if not re.search(r'(?<![A-Za-z])%s(?![A-Za-z])' % L, summary):
                        errors.append('conflict_summary_missing_letter:' + L)
        elif st == 'knowledge_only':
            if conflicts - set(keys):
                errors.append('bad_conflict_marks')

    # ---- citations
    ss_raw = obj.get('source_sections')
    ss = []
    if st == 'knowledge_only':
        if ss_raw not in (None, [], ()):
            errors.append('knowledge_only_must_have_no_sources')
    else:
        if not isinstance(ss_raw, list) or not ss_raw:
            errors.append('missing:source_sections')
        else:
            for it in ss_raw:
                if not isinstance(it, dict):
                    errors.append('bad_citation'); continue
                try:
                    i = int(it.get('citation_index'))
                except (TypeError, ValueError):
                    errors.append('bad_citation_index'); continue
                if not (1 <= i <= len(blocks)):
                    errors.append('citation_index_out_of_range:%s' % i); continue
                blk = blocks[i - 1]
                head = norm_ws(it.get('heading'))
                if not head:
                    errors.append('empty_heading:%d' % i); continue
                if head.lower() != 'relevant section' and _squash(head) not in _squash(blk['text']):
                    errors.append('heading_not_in_block:%d' % i); continue
                quote = norm_ws(it.get('quote'))
                if quote and _squash(quote) not in _squash(blk['text']):
                    errors.append('quote_not_in_block:%d' % i); continue
                ss.append({'i': i, 'h': head, 'q': quote[:320], 'b': blk.get('book', ''), 'c': blk.get('chapter', ''), 'p': blk.get('page', '')})

    # ---- language contract (checked here, in code)
    if st == 'knowledge_only':
        if not _squash(summary).startswith(_squash(prompts.DISCLOSURE)):
            lang.append('summary_missing_disclosure')
    elif not (starts_arabic(summary) and arabic_ratio(summary) >= 0.4):
        lang.append('summary_not_arabic_led')
    if ce and not (has_arabic_early(ce) and arabic_ratio(ce) >= 0.4):
        lang.append('correct_explanation_not_arabic_led')
    for x in oa:
        if arabic_ratio(x['e']) < 0.3:
            lang.append('option_%s_not_arabic_led' % x['o'].upper())
            break

    clean = None
    if not errors and not lang:
        clean = {'st': st, 'ca': ','.join(ca), 'sm': summary, 'ce': ce, 'oa': sorted(oa, key=lambda x: x['o']), 'ss': ss}
    return errors, lang, clean
