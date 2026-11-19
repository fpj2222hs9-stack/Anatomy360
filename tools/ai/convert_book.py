#!/usr/bin/env python3
"""تحويل كتاب (PDF أو نص مستخرج منه) لصيغة حورس: ملف .md فيه عناوين وأرقام صفحات مطبوعة.

الاستخدام:
    python3 tools/ai/convert_book.py <profile.json> <input.pdf|input.txt> <out.md>

الـ profile (tools/ai/book_profiles/*.json) بيوصف الكتاب مش بيحتوي نصه:
  book      : اسم الكتاب اللي بيظهر في الاستشهاد
  input     : {kind: "pdf" | "footer-txt", footer: regex رقم الصفحة في الذيل (footer-txt بس)}
  drop      : سطور بتتشال من كل صفحة (ذيل/رأس مطبوع)
  header    : "first-line" يعني أول سطر في كل صفحة عنوان جاري (Running title) بيتشال ويتحوّل لفصل لو chapters_from_header
  chapters  : [[رقم أول صفحة، "عنوان الفصل"], ...] (من فهرس الكتاب)
  chapters_from_header : الفصل = العنوان الجاري في أول الصفحة
  caps_heading : سطر كله حروف كبيرة = عنوان قسم
  (ملازم / ملخصات بجداول — اختياري)
  input.mode        : "layout" (الافتراضي: أعمدة الجداول جنب بعض بـ ' | ') أو "raw" (ترتيب القراءة) أو "auto" (الصفحة اللي فيها جدول بأعمدة تتقرا layout والباقي raw)
  page_from_pdf     : true = رقم الصفحة = ترتيبها في الـ PDF (للملازم اللي رقمها المطبوع = رقم صفحة الملف)
  skip_pdf_pages    : [1, 2] صفحات الـ PDF اللي بتتخطّى (الغلاف والفهرس)
  min_words         : صفحة كلماتها أقل من كده (صفحات فاصلة بين الأبواب) بتتخطّى
  expand_abbr       : true = بيفك الاختصارات الشايعة (Post. Ant. Med. Lat. Sup. Inf. n. V.) وبيصلّح حروف مقروءة غلط (brachiaI ← brachial) عشان البحث يلاقيها
  mcq               : "resolve" = صفحة أسئلة MCQ آخرها سطر إجابات نموذجي (1 -c 2-b) بيتحوّل لسطور «Model answer» فيها حرف الإجابة ونصها، وعنوان الصفحة بيبقى «<الباب> — exam MCQs»

الناتج: كل صفحة قسم لوحدها (عشان رقم الصفحة في الاستشهاد يطلع دقيق):
    # عنوان الفصل        (أول صفحة في الفصل)
    ## العنوان الحالي      (بيتكرّر في أول كل صفحة)
    [[p.117]]
    نص الصفحة...
الأشكال والصور مش بتتنقل (النص بس)، والجداول بتتحوّل لسطور فيها ' | ' بين الأعمدة.
"""
import json, os, re, subprocess, sys

PUA = re.compile('[-]')
CAPS_SKIP = re.compile(r'^(CHAPTER|PART|FIG|FIGURE|TABLE|NB|N\.B)\b', re.I)


def clean_line(ln):
    ln = ln.replace('\r', '').replace(' ', ' ')
    ln = PUA.sub('•', ln).replace('◾', '•').replace('❖', '•').replace('➢', '•').replace('▪', '•').replace('✓', '•')
    ln = ln.strip()
    ln = re.sub(r'\s{3,}', ' | ', ln)
    ln = re.sub(r'(?:\s*\|\s*)+$', '', ln)
    ln = re.sub(r'^(?:\|\s*)+', '', ln)
    return ln


def is_caps_heading(ln):
    s = ln.strip()
    if not (5 <= len(s) <= 64) or '|' in s or CAPS_SKIP.match(s):
        return False
    if s != s.upper() or not re.search(r'[A-Z]{3}', s) or re.search(r'[.:;,]\s*$', s) or re.search(r'\d', s):
        return False
    letters = [c for c in s if c.isalpha()]
    return len(letters) >= 4



_ABBR = [(r'\bPost\.(?=[\s:,;)]|$)', 'Posterior'), (r'\bpost\.(?=[\s:,;)]|$)', 'posterior'), (r'\bAnt\.(?=[\s:,;)]|$)', 'Anterior'), (r'\bant\.(?=[\s:,;)]|$)', 'anterior'),
         (r'\bMed\.(?=[\s:,;)]|$)', 'Medial'), (r'\bmed\.(?=[\s:,;)]|$)', 'medial'), (r'\bLat\.(?=[\s:,;)]|$)', 'Lateral'), (r'\blat\.(?=[\s:,;)]|$)', 'lateral'),
         (r'\bSup\.(?=[\s:,;)]|$)', 'Superior'), (r'\bsup\.(?=[\s:,;)]|$)', 'superior'), (r'\bInf\.(?=[\s:,;)]|$)', 'Inferior'), (r'\binf\.(?=[\s:,;)]|$)', 'inferior'),
         (r'\bn\.(?=[\s,;)]|$)', 'nerve'), (r'\bN\.(?=\s+[a-z(])', 'Nerve'), (r'(?<=[A-Za-z] )V\.(?=[\s,;)]|$)', 'vein')]
_ABBR = [(re.compile(a), b) for a, b in _ABBR]
_OCR = [(re.compile(r'\b([A-Za-z]{3,}a)I\b'), r'\1l'), (re.compile(r'\b([A-Za-z]{3,}a)!'), r'\1l')]


def fix_text(line):
    for rx, rep in _ABBR:
        line = rx.sub(rep, line)
    for rx, rep in _OCR:
        line = rx.sub(rep, line)
    return line


# سطر الإجابات النموذجي في آخر صفحة أسئلة: "1 -c   2-b   3-b"
MCQ_KEYS = re.compile(r'^\s*(?:\d{1,2}\s*[-–]\s*[a-eA-E]\b\s*){1,}$', re.M)
_KEY_PAIR = re.compile(r'(\d{1,2})\s*[-–]\s*([a-eA-E])\b')


def resolve_mcq(lines):
    """صفحة MCQ: السطر الأخير «1 -c 2-b» بيتبدّل بسطور «Model answer (doctor's key)» فيها الحرف ونص الاختيار. لو الصفحة مش ماشية على النمط ده بترجع من غير تغيير."""
    idx = [i for i, l in enumerate(lines) if MCQ_KEYS.match(l)]
    if len(idx) != 1:
        return lines, False
    ki = idx[0]
    pairs = [(int(n), c.lower()) for n, c in _KEY_PAIR.findall(lines[ki])]
    if not pairs or [n for n, _ in pairs] != list(range(1, len(pairs) + 1)):
        return lines, False
    body = lines[:ki]
    # start line of every question 1..n (the first matching line, in order)
    starts, pos = [], 0
    for n in range(1, len(pairs) + 1):
        pat = re.compile(r'^\s*%d\s*[-.]\s*\S' % n)
        j = next((k for k in range(pos, len(body)) if pat.match(body[k])), None)
        if j is None:
            return lines, False
        starts.append(j); pos = j + 1
    out = [l for l in body]
    ans = []
    for qi, (n, letter) in enumerate(pairs):
        blk = body[starts[qi]:(starts[qi + 1] if qi + 1 < len(starts) else len(body))]
        opt, cur = {}, None
        for l in blk[1:]:
            if not l.strip():
                cur = None            # خط فاضي = خلصت الاختيارات (اللي بعده تسميات أشكال مش جزء من الاختيار)
                continue
            for cell in re.split(r'\s{3,}', l.strip()):
                m = re.match(r'^([a-h])\s*[-.]\s*(.*)$', cell, re.I)
                if m:
                    cur = m.group(1).lower(); opt[cur] = m.group(2).strip()
                elif cur and cell.strip():
                    opt[cur] = (opt[cur] + ' ' + cell.strip()).strip()
        txt = opt.get(letter, '')
        if not txt:
            return lines, False
        ans.append("Model answer (the doctor's key) for question %d: %s) %s" % (n, letter, txt))
    return out + [''] + ans, True


def read_pages(profile, src):
    """-> [(printed_page or None, [lines])] in book order"""
    kind = profile['input']['kind']
    if kind == 'pdf':
        def pdf_pages(*flags):
            out = subprocess.run(['pdftotext'] + list(flags) + [src, '-'], capture_output=True, check=True).stdout.decode('utf-8', 'replace')
            pg = out.split('\f')
            if pg and not pg[-1].strip():
                pg.pop()
            return pg
        mode = profile['input'].get('mode', 'layout')
        lay = pdf_pages('-layout')
        if mode == 'layout':
            return [(None, p.split('\n')) for p in lay]
        rawp = pdf_pages()
        res = []
        for i, lp in enumerate(lay):
            rp = rawp[i] if i < len(rawp) else lp
            cells3 = sum(1 for l in lp.split('\n') if len(re.split(r'\s{3,}', l.strip())) >= 3)
            use_layout = mode == 'layout' or (mode == 'auto' and (cells3 >= 5 or MCQ_KEYS.search(lp)))
            res.append((None, (lp if use_layout else rp).split('\n')))
        return res
    if kind == 'footer-txt':
        foot = re.compile(profile['input']['footer'])
        copy = re.compile(profile['input'].get('copyright', r'^©\s*Faculty of Medicine'))
        with open(src, encoding='utf-8', errors='replace') as fh:
            lines = fh.read().replace('\r', '').split('\n')
        pages, buf, i = [], [], 0
        while i < len(lines):
            ln = lines[i]
            m = foot.match(ln.strip())
            if m:
                n = int(m.group(1)) if m.groups() and m.group(1) else None
                pages.append((n, buf)); buf = []
                if i + 1 < len(lines) and copy.match(lines[i + 1].strip()):
                    i += 1
            else:
                buf.append(ln)
            i += 1
        if any(l.strip() for l in buf):
            pages.append((None, buf))
        return pages
    raise SystemExit('unknown input kind: %r' % kind)


def printed_number(lines):
    """a line with only digits near the bottom = the printed page number"""
    ls = [l.strip() for l in lines if l.strip()]
    for l in reversed(ls[-6:]):
        if re.fullmatch(r'\d{1,3}', l):
            return int(l)
    return None


def convert(profile, src):
    pages = read_pages(profile, src)
    drops = [re.compile(x, re.I) for x in profile.get('drop', [])]
    chap_tab = sorted((int(p), t) for p, t in profile.get('chapters', []))
    from_header = bool(profile.get('chapters_from_header'))
    min_page = int(profile.get('first_page', 1))
    out, info = [], {'pages': 0, 'words': 0, 'skipped': [], 'gaps': [], 'chapters': []}
    cur_chapter, cur_head, last_no = None, None, None
    header_skip = profile.get('header') == 'first-line'
    skip_pdf = set(int(x) for x in profile.get('skip_pdf_pages', []))
    min_words = int(profile.get('min_words', 0))
    for idx, (no, lines) in enumerate(pages):
        if idx + 1 in skip_pdf:
            continue
        body = [l for l in lines]
        if profile.get('page_from_pdf'):
            no = idx + 1
        if no is None:
            no = printed_number(body)
        # remove printed header/footer noise
        keep = []
        for ln in body:
            s = ln.strip()
            if any(d.match(s) for d in drops):
                continue
            if no is not None and re.fullmatch(str(no), s):
                continue
            keep.append(ln)
        ne = [i for i, l in enumerate(keep) if l.strip()]
        running = ''
        if header_skip and ne:
            first = keep[ne[0]].strip()
            if len(first) < 60 and not re.search(r'[.!?]$', first):
                running = clean_line(first); keep[ne[0]] = ''
        if profile.get('expand_abbr'):
            keep = [fix_text(l) for l in keep]
        is_mcq = False
        if profile.get('mcq') == 'resolve':
            keep, is_mcq = resolve_mcq(keep)
        text = [clean_line(l) for l in keep]
        if is_mcq:
            text = [l.replace(' | ', ' ') for l in text]      # صفحة أسئلة: مفيش جداول، الفراغات الكبيرة جوه السؤال مش أعمدة
        if min_words and sum(len(l.split()) for l in text) < min_words:
            if any(text):
                info['skipped'].append(idx + 1)
            continue
        if no is None and last_no is not None and any(text):
            no = last_no + 1
        if no is None or no < min_page or not any(text):
            if any(text):
                info['skipped'].append(idx + 1)
            continue
        if last_no is not None and no != last_no + 1:
            info['gaps'].append((last_no, no))
        last_no = no
        # chapter for this page
        chap = None
        if from_header and running:
            chap = running
        if not from_header:
            for p0, t in chap_tab:
                if p0 <= no:
                    chap = t
        chap = chap or cur_chapter or 'Book'
        if chap != cur_chapter:
            out.append('# ' + chap)
            cur_chapter, cur_head = chap, chap
            info['chapters'].append((no, chap))
        else:
            out.append('## ' + cur_head)
        if is_mcq:
            out[-1] = '## ' + cur_chapter + ' \u2014 exam MCQs (past exams, with the doctor\'s model answers)'
            info['mcq_pages'] = info.get('mcq_pages', 0) + 1
        out.append('[[p.%d]]' % no)
        for ln in text:
            if not ln:
                continue
            if profile.get('caps_heading', True) and is_caps_heading(ln):
                cur_head = ln
                out.append('## ' + ln)
                continue
            if CAPS_SKIP.match(ln) and ln.upper() == ln and len(ln) < 14:
                continue
            out.append(ln)
            info['words'] += len(ln.split())
        info['pages'] += 1
    return '\n'.join(out) + '\n', info


def main():
    if len(sys.argv) != 4:
        raise SystemExit(__doc__)
    prof = json.load(open(sys.argv[1], encoding='utf-8'))
    md, info = convert(prof, sys.argv[2])
    os.makedirs(os.path.dirname(os.path.abspath(sys.argv[3])), exist_ok=True)
    with open(sys.argv[3], 'w', encoding='utf-8') as f:
        f.write(md)
    print('pages: %d  words: %d  chapters: %d%s' % (info['pages'], info['words'], len(info['chapters']), ('  mcq pages: %d' % info['mcq_pages']) if info.get('mcq_pages') else ''))
    if info['gaps']:
        print('page-number gaps (printed pages without text or footer):', info['gaps'])
    if info['skipped']:
        print('skipped (no page number):', info['skipped'])
    for p, t in info['chapters']:
        print('  p.%-4d %s' % (p, t))


if __name__ == '__main__':
    main()
