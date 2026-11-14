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


def read_pages(profile, src):
    """-> [(printed_page or None, [lines])] in book order"""
    kind = profile['input']['kind']
    if kind == 'pdf':
        out = subprocess.run(['pdftotext', '-layout', src, '-'], capture_output=True, check=True).stdout.decode('utf-8', 'replace')
        raw = out.split('\f')
        if raw and not raw[-1].strip():
            raw.pop()
        return [(None, p.split('\n')) for p in raw]
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
    for idx, (no, lines) in enumerate(pages):
        body = [l for l in lines]
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
        text = [clean_line(l) for l in keep]
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
    print('pages: %d  words: %d  chapters: %d' % (info['pages'], info['words'], len(info['chapters'])))
    if info['gaps']:
        print('page-number gaps (printed pages without text or footer):', info['gaps'])
    if info['skipped']:
        print('skipped (no page number):', info['skipped'])
    for p, t in info['chapters']:
        print('  p.%-4d %s' % (p, t))


if __name__ == '__main__':
    main()
