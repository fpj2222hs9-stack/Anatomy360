#!/usr/bin/env python3
"""يقرا ANS_MCQ.pdf («MCQs in Autonomic Nervous System»، د. MHR) ويطلّع tools/ans_parsed.json بنص الأسئلة والمفاتيح حرفيًا.
usage: python3 tools/parse_ans_pdf.py <ANS_MCQ.pdf> tools/ans_parsed.json

- العلامة المائية («vip academy» و«MHR») حروفها بتتفصل في النص المستخرج فبتتشال سطور الحروف المفردة.
- جدول المفاتيح في آخر صفحة (100 مفتاح). السؤال 101 مالوش مفتاح واختياراته ناقصة (a-c بس) فبيتحط في dropped ومابيدخلش البنك.
- حاجات في الملف الأصلي بتتسجّل في notes ومابتتصلّحش بصمت:
    * الاختيارات المطبوعة بحروف ناقصة (7: a,b,d,e | 66: a,c,d,e | 100: b,c,d) بتفضل بحروفها لأن المفتاح بيشاور عليها.
    * السؤال 88 رابع اختياراته مطبوع a تاني: بيتسمّى d (خطأ طباعة واضح).
    * السؤال 71: الحروف اليونانية (α1 α2 β1 β2) في خط Symbol وبتطلع حروف خاصة (U+F061/F062)، بتتحوّل لحروفها وبتتأكد من الصفحة.
    * علامات شاردة في النص نفسه (M) (A) (H) (R) € موجودة في الملف وبتفضل زي ما هي."""
import json, re, subprocess, sys

pdf, out = sys.argv[1], sys.argv[2]
raw = subprocess.run(['pdftotext', '-raw', pdf, '-'], capture_output=True, check=True).stdout.decode('utf-8', 'replace').replace('\f', '\n')
SYMBOL = {'\uf061': 'α', '\uf062': 'β'}      # خط Symbol: الحروف اليونانية بتطلع من النص المستخرج كحروف خاصة (U+F061 = α، U+F062 = β)
lines = []
for l in raw.split('\n'):
    for k, v in SYMBOL.items(): l = l.replace(k, v)
    s = l.strip()
    if not s or (len(s) <= 2 and s.isalpha()) or s in ('MHR', 'vip academy', 'vip', 'academy'):
        continue
    lines.append(s)

# ---- key table (last page): "1 B 26 E 51 D 76 B"
keys = {}
ki = next(i for i, l in enumerate(lines) if re.match(r'^1\s+[A-Za-z]\s+26\s+[A-Za-z]\b', l))
for l in lines[ki:]:
    for m in re.finditer(r'(\d{1,3})\s+([A-Za-z])\b', l):
        keys[int(m.group(1))] = m.group(2)
body = lines[:ki]

QRE = re.compile(r'^(\d{1,3})\s*\.\s*(\S.*)$')
ORE = re.compile(r'^([a-f])\s*[-.)]\s*(\S.*)$')
HEAD = {'Sympathetic', 'Parasympathetic'}
qs, cur, mode, headings = [], None, None, {}
pending_head = None
started = False
for s in body:
    if not started:
        if QRE.match(s) and QRE.match(s).group(1) == '1': started = True
        else: continue
    if re.fullmatch(r'\d{1,2}', s):        # page number
        continue
    if s in HEAD:
        pending_head = s; continue
    m = QRE.match(s)
    if m and int(m.group(1)) == (cur['n'] + 1 if cur else 1):
        cur = {'n': int(m.group(1)), 'stem': m.group(2).strip(), 'opts': [], 'notes': []}
        qs.append(cur); mode = 'stem'
        if pending_head: headings[cur['n']] = pending_head; pending_head = None
        continue
    if cur is None: continue
    mo = ORE.match(s)
    if mo:
        letter = mo.group(1)
        if letter in [o[0] for o in cur['opts']]:
            nxt = chr(ord(cur['opts'][-1][0]) + 1)
            cur['notes'].append('option letter %s printed twice in the source; the second one is labelled %s' % (letter, nxt))
            letter = nxt
        cur['opts'].append([letter, mo.group(2).strip()]); mode = 'opt'; continue
    if mode == 'stem' and not cur['opts']: cur['stem'] += ' ' + s
    elif cur['opts']: cur['opts'][-1][1] += ' ' + s
    else: cur['stem'] += ' ' + s

# ---- fixes for things the text layer loses (checked against the page images)
for q in qs:
    if q['n'] == 71:
        assert [o[1] for o in q['opts'][:4]] == ['α1 receptors', 'α2 receptors', 'β1 receptors', 'β2 receptors'], q['opts']
        q['notes'].append('Greek letters come from the Symbol font in the PDF (restored, checked against the page image)')
    letters = [o[0] for o in q['opts']]
    if letters != [chr(97 + i) for i in range(len(letters))]:
        q['notes'].append('option letters as printed: ' + ','.join(letters))

dropped = []
final = []
for q in qs:
    if q['n'] not in keys:
        dropped.append({'n': q['n'], 'why': 'no key in the key table and only %d options printed' % len(q['opts']), 'stem': q['stem']}); continue
    final.append(q)
assert [q['n'] for q in final] == list(range(1, 101)), [q['n'] for q in final][:5]
for q in final:
    assert keys[q['n']].lower() in [o[0] for o in q['opts']], (q['n'], keys[q['n']], q['opts'])
json.dump({'source': 'ANS_MCQ.pdf (MCQs in Autonomic Nervous System, Dr. MHR)', 'qs': final, 'keys': {str(k): v for k, v in sorted(keys.items())},
           'headings': headings, 'dropped': dropped}, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('questions', len(final), 'keys', len(keys), 'dropped', [d['n'] for d in dropped], 'headings', headings)
print('notes:', {q['n']: q['notes'] for q in final if q['notes']})
