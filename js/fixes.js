/* Imhotep · إمحتب — تصحيحات المفاتيح الجديدة (طبقة فوق الداتا).
   ملفات الأسئلة الأصلية في subjects/ بتفضل زي ما هي بالبايت (tools/verify_data.py بيثبت ده)،
   والتصحيحات اللي حصلت بعد كده بتتسجّل هنا. كل مدخل:
     k   المفتاح الصحيح (حرف، أو حروف مفصولة بفاصلة لو أكتر من إجابة مقبولة)
     fx  سبب التصحيح، بيظهر للطالب تحت السؤال وفي صفحة «تصحيحات المفاتيح»
     on  تاريخ التصحيح
     off لو true: السؤال مكسور في الملف الأصلي فبيتوقّف من التقييم والاختبارات (rv = السبب)
   المفتاح المطبوع في الملزمة بيتاخد تلقائيًا من الداتا (data-k) ويتحفظ كـ «القديم».
   أي سؤال اتصحّح جوه الداتا نفسها (data-bk) اتراجع مع الدكتور قبل كده ومش بيتلمس هنا. */
(function(){
'use strict';
var IM=window.IM;

IM.FIXES={
  'b05-036':{k:'a',on:'2026-11-06',
    fx:'الـmyoglobin وسلاسل الـhemoglobin لهم نفس الطيّة الكروية (globin fold)، أي tertiary structure متشابه، لكن تتابع الأحماض الأمينية (primary structure) مختلف. والـmyoglobin سلسلة واحدة فمفيش له quaternary structure. فالصحيح a، والمطبوع b بيقول إن الـtertiary مختلف وده عكس الحقيقة.'},
  'b08-033':{k:'d',on:'2026-11-06',
    fx:'الـnucleotide يتكوّن من قاعدة نيتروجينية + سكر خماسي (pentose) + فوسفات، كما في كتاب د. هشام. أما قاعدة + سكر فهي الـnucleoside (الاختيار b).'},
  'b08-034':{k:'b',on:'2026-11-06',
    fx:'الـS-adenosyl methionine (SAM) هو الـactive methionine والمانح الرئيسي لمجموعة الميثيل في التفاعلات الحيوية، كما في كتاب د. هشام. أما FAD وNAD فهما ناقلان للإلكترونات وليسا مانحين للميثيل.'},
  'b08-035':{k:'d',on:'2026-11-06',
    fx:'الـuridine هو قاعدة اليوراسيل (pyrimidine) متصلة بالـribose، أي nucleoside. ولو أُضيفت له فوسفات يصير nucleotide وهو UMP.'},
  'b08-036':{k:'d',on:'2026-11-06',
    fx:'الـnucleoside (قاعدة + pentose) يتحوّل إلى nucleotide بإضافة فوسفات، كما في كتاب د. هشام. أما الـpentose فهو موجود فيه أصلًا.'},
  'b08-037':{k:'d',on:'2026-11-06',
    fx:'الـGMP (guanosine monophosphate) هو nucleotide: قاعدة guanine + ribose + فوسفات واحدة، وهو مذكور ضمن الـnucleotides في كتاب د. هشام. أما القاعدة وحدها فهي guanine، والـnucleoside هو guanosine.'},
  'g2_cubital-9':{off:true,on:'2026-11-06',
    rv:'نص الاختيار a مقطوع في الملف الأصلي (بينتهي عند «the brachialis and» من غير الباقي، والمعروف إن أرضية الحفرة المرفقية هي الـbrachialis والـsupinator). واختيارات b وc وd كلها صحيحة تشريحيًا، فالسؤال بالشكل ده له أكثر من إجابة صحيحة. أُوقف من التقييم والاختبارات لحد ما نعيده بنصه الصحيح. لو عندك صفحته الأصلية ابعتها.'}
};

/* بتتنادى من bank.js قبل ما السؤال يتسجّل (قبل حساب «بيتحسب»). بتتجاهل أي سؤال اتصحّح في الداتا نفسها أو ملغي. */
IM.applyFix=function(Q){
  var F=IM.FIXES[Q.id]; if(!F||Q.bk||Q.canc) return Q;
  if(F.off){ Q.keys=[]; Q.alt=''; Q.rv=F.rv||'السؤال موقوف لحد المراجعة.'; Q.late=F.on; return Q; }
  if(!Q.keys.length) return Q;
  Q.bk=Q.keys.join(','); Q.keys=String(F.k).split(',').map(function(x){return x.trim()}).filter(Boolean);
  Q.fx=F.fx||''; Q.fix=true; Q.alt=''; Q.late=F.on;
  return Q;
};
})();
