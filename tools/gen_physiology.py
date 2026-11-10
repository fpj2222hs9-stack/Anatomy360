#!/usr/bin/env python3
"""يولّد subjects/physiology/physiology.content.js من بنك أسئلة الدم (د. محمد ماهر، MHR).
المصدر: Blood_MCQ_Bank_MHR_112416.pdf (185 سؤال + جدول المفاتيح في آخر صفحة).
usage: python3 tools/gen_physiology.py parsed.json subjects/physiology/physiology.content.js
parsed.json = ناتج parse.py (نص الأسئلة والمفاتيح كما في الـPDF حرفيًا)."""
import json, sys, html, re
src, out = sys.argv[1], sys.argv[2]
d = json.load(open(src, encoding='utf-8')); K = d['keys']
SECS = [('Body Fluids', 1, 9), ('Measurement of Body Fluids & Homeostasis', 10, 17), ('Plasma Proteins', 18, 48),
        ('Erythrocytes & Erythropoiesis', 49, 78), ('Vitamin B12', 79, 95), ('Iron', 96, 121),
        ('Anemia & Polycythemia', 122, 135), ('Hemostasis', 136, 172), ('Blood Groups & Rh', 173, 185)]
# تطبيع حروف مطابقة شكليًا طلعت من الـPDF (سيريليك بدل لاتيني) — المعروض في الصفحة «PO4»
HOMO = {'О': 'O', 'Р': 'P'}
def fix(t): return ''.join(HOMO.get(c, c) for c in t)
# سؤال واحد مفتاحه المطبوع مبني على خطأ مطبعي (راجعته علميًا): بيتعلّم «مشكوك فيه» والمحسوب للطالب هو المطبوع
DOUBT = {155: 'الـthrombomodulin بيرتبط بالـthrombin ويكوّن مركّبًا بينشّط الـprotein C (مش protein S)، والـprotein S عامل مساعد للـprotein C المنشَّط. فنص الاختيار D غالبًا خطأ مطبعي (المقصود protein C).'}
e = lambda t: html.escape(t, quote=False)
def sec_of(n):
    for i, (t, a, b) in enumerate(SECS):
        if a <= n <= b: return i
secs_html, gsel = [], []
for i, (title, a, b) in enumerate(SECS):
    sid = 'ph1_t%02d' % (i + 1); qs = [q for q in d['qs'] if sec_of(q['n']) == i]
    assert len(qs) == b - a + 1, (title, len(qs))
    gsel.append('<option value="%s">%s (%d)</option>' % (sid, e(title), len(qs)))
    body = ''
    for q in qs:
        n = q['n']; k = K[str(n)].lower(); letters = [o[0] for o in q['opts']]; assert k in letters, (n, k)
        attrs = 'data-id="ph1m-%03d" data-k="%s"' % (n, k)
        tags = ''
        if q['past']: tags += '<span class="gtag" dir="ltr">Past exam</span>'
        if n in DOUBT:
            attrs += ' data-alt="" data-fx="%s"' % html.escape(DOUBT[n], quote=True)
            tags += '<span class="gtag warn" dir="rtl">مفتاح الملزمة مشكوك فيه</span>'
        opts = ''.join('<li data-o="%s" tabindex="0">%s- %s</li>' % (l, l, e(fix(t))) for l, t in q['opts'])
        body += '<div class="gq" %s><p class="qt" dir="ltr">%d- %s%s</p><ul class="opts" dir="ltr">%s</ul><p class="res" hidden></p></div>' % (attrs, n, e(fix(q['stem'])), tags, opts)
    secs_html.append('<section class="tsec gsec" data-g="%s"><h3>%s <small>— %d سؤال</small></h3><div class="tbar"><button class="btn clear sm gclear" type="button" data-g="%s">Clear</button></div>%s</section>' % (sid, e(title), len(qs), sid, body))
total = len(d['qs']); assert total == 185
note = 'أسئلة اختيار من متعدد في الدم (علم وظائف الأعضاء) من بنك أسئلة د. محمد ماهر، بمفاتيحها المطبوعة في جدول المفاتيح. هذا أول فصل نزل من المادة، وباقي الفصول بتتضاف لما تنزل.'
body_html = ('<main><section id="tab-galal" class="tabpane" role="tabpanel" hidden><div class="card-bar"><p class="note">%s</p></div>'
             '<div class="gnav"><label for="gSel">القسم:</label><select id="gSel"><option value="">كل الأقسام (%d سؤال)</option>'
             '<optgroup label="Chapter 1 — Blood" data-src="maher" data-srclabel="Dr. Mohamed Maher MCQs">%s</optgroup></select></div>'
             '<div class="gpart" data-part="1" data-ch="p1"><h2 dir="ltr">Chapter 1 · Blood <small>— الدم · %d سؤال · <bdi dir="ltr">Dr. Mohamed Maher MCQs</bdi></small></h2>%s</div></section></main>'
             % (e(note), total, ''.join(gsel), total, ''.join(secs_html)))
pkg = {'headA': '<div class="eyebrow">Physiology · Dr. Mohamed Maher MCQs</div>',
       'headB': '<p class="lede">%s</p><div class="stats"><div><b>1</b><span>فصل</span></div><div><b>%d</b><span>قسمًا</span></div><div><b>%d</b><span>سؤال بمفتاح</span></div></div>' % (e(note), len(SECS), total),
       'body': body_html}
js = '/* محتوى مادة physiology (الدم فقط لحد ما ينزل باقي المادة): بنك أسئلة د. محمد ماهر. مولَّد من tools/gen_physiology.py */\n(function(M){(M.pkg=M.pkg||{})["physiology"]=' + json.dumps(pkg, ensure_ascii=False).replace('</', '<\\/') + '})(window.MG=window.MG||{});\n'
open(out, 'w', encoding='utf-8', newline='\n').write(js)
print('wrote', out, len(js.encode('utf-8')), 'bytes;', total, 'questions;', len(SECS), 'sections')
