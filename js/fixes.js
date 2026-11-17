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

/* مفاتيح مضافة لأسئلة الملزمة اللي ماكانش ليها مفتاح مطبوع (غير الأسئلة اللي اتصحّح مفتاحها فوق).
   المفتاح هنا بيتاخد من كتاب القسم نفسه (ISK 101 · التشريح) ومكتوب مصدره (src) وبيظهر للطالب تحت السؤال.
   السؤال اللي ليه مفتاح مطبوع ما بيتلمسش هنا. وأي سؤال مضاف مش بيدخل في مؤشر الطالب إلا بعد ما يجاوبه (علشان مؤشر حد ما ينزلش بسبب الإضافة).
     k   المفتاح الصحيح      src  مكانه في الكتاب      fx  شرح مختصر بيظهر للطالب      on  تاريخ الإضافة
     dr  1 = الإجابة النموذجية للدكتور أحمد جلال («Axilla MCQs – Model Answer») بتطابق المفتاح ده (اتراجعت 15 نوفمبر 2026)
     dm  ملاحظة بتتكتب بدل الجملة الافتتاحية لما في تفصيلة تتقال صراحة (سؤال 9) */
IM.ADDKEYS={
  'g2_axilla-1':{k:'c',on:'2026-11-13',dr:1,src:'ISK 101 · ص169 جدول 4.1',
    fx:'الجدار الجانبي (Humeral) للإبط: الأخدود ثنائي الرأس في عظمة العضد + الرأس القصير للـbiceps + الـcoracobrachialis. الـsubclavius من الجدار الأمامي، والرأس الطويل للـbiceps ما بيشاركش.'},
  'g2_axilla-2':{k:'b',on:'2026-11-13',dr:1,src:'ISK 101 · ص169 جدول 4.1',
    fx:'الثنية الأمامية للإبط (Anterior axillary fold) = الحافة السفلية للـpectoralis major، والـpectoralis minor أعمق منها.'},
  'g2_axilla-3':{k:'b',on:'2026-11-13',dr:1,src:'ISK 101 · ص169 جدول 4.1',
    fx:'الجدار الخلفي (Subscapular): الـsubscapularis (الجزء الجانبي) + الـteres major + الـlatissimus dorsi.'},
  'g2_axilla-4':{k:'c',on:'2026-11-13',dr:1,src:'ISK 101 · ص169 + ص171',
    fx:'محتويات الإبط: الشريان والوريد الإبطي، حبال (cords) الضفيرة العضدية وفروعها، الغدد الليمفاوية، الدهون، وذيل الثدي. أما الـtrunks فبتقع في الرقبة فوق الترقوة.'},
  'g2_axilla-5':{k:'b',on:'2026-11-13',dr:1,src:'ISK 101 · ص169 جدول 4.1',
    fx:'الجدار الأمامي: pectoralis major + (subclavius وclavipectoral fascia وpectoralis minor). الـteres major من الجدار الخلفي.'},
  'g2_axilla-6':{k:'c',on:'2026-11-13',dr:1,src:'ISK 101 · ص150',
    fx:'الـclavipectoral fascia بتغلّف الـpectoralis minor، والغشاء اللي بيغطيه بيكمل لتحت كـsuspensory ligament للـaxillary fascia (أرضية الإبط).'},
  'g2_axilla-7':{k:'c',on:'2026-11-13',dr:1,src:'ISK 101 · ص161 (deltoid) + ص173',
    fx:'الألياف الوسطى للـdeltoid بتبعّد الذراع من 15 لـ90 درجة، وعصبها الـaxillary (circumflex) nerve (C5, 6).'},
  'g2_axilla-8':{k:'a',on:'2026-11-13',dr:1,src:'ISK 101 · ص166',
    fx:'الفراغ المثلثي العلوي (Upper triangular space): فوق بالـteres minor (من الخلف) والـsubscapularis (من الأمام)، وتحت بالـteres major، وجانبيًا بالرأس الطويل للـtriceps، ويعدّي منه الـcircumflex scapular artery بس. أما الـaxillary nerve فبيعدّي من الـquadrangular space.'},
  'g2_axilla-9':{k:'c',on:'2026-11-13',dr:1,src:'ISK 101 · ص169 جدول 4.1',
    dm:'المفتاح ده (c) مطابق للإجابة النموذجية للدكتور أحمد جلال: النص المكتوب عنده «Pectoralis major and minor share in the formation of its anterior wall» وده الاختيار c في الموقع (الجدول عنده كاتب الحرف A لكن النص اللي جنبه بيطابق c)، وكتاب القسم (ISK 101 · ص169 جدول 4.1) بيأكده.',
    fx:'الجدار الأمامي فيه الـpectoralis major (طبقة سطحية) والـpectoralis minor (ضمن الـaxillary septum العميق). الخلفي: subscapularis وteres major وlatissimus dorsi (مش teres minor)، والأضيق هو الجانبي مش الإنسي.'},
  'g2_axilla-10':{k:'b',on:'2026-11-13',dr:1,src:'ISK 101 · ص170-171',
    fx:'نص الكتاب بيسمّي قمة الإبط «cervico-axillary canal» وحدودها في شكل 4.1 (مش مكتوبة في النص). المفتاح هنا بالاستبعاد من نص الكتاب: الشريان الإبطي بيبدأ عند الحافة الخارجية للضلع الأول (فاختيار a غلط)، والـroots في الرقبة والـdivisions بس في قمة الإبط (فاختيار c غلط)، واللي بيعدّي القناة هو الأوعية الإبطية (فاختيار d غلط). والمعروف في التشريح إن حدودها الخلفية هي الحافة العلوية للـscapula (b)، والدكتور أحمد جلال أكّد (b) في الإجابة النموذجية.'},
  'g2_axilla-11':{k:'c',on:'2026-11-13',dr:1,src:'ISK 101 · ص169 + ص150',
    fx:'الـaxillary septum (الطبقة العميقة من الجدار الأمامي) = subclavius + clavipectoral fascia + pectoralis minor + suspensory ligament. الـaxillary sheath مش منه.'},
  'g2_axilla-12':{k:'a',on:'2026-11-13',dr:1,src:'ISK 101 · ص169 جدول 4.1',
    fx:'الجدار الإنسي (Costal): الأضلاع الأربعة العليا بعضلاتها الوربية + الجزء العلوي من الـserratus anterior.'},
  'g2_axilla-13':{k:'b',on:'2026-11-13',dr:1,src:'ISK 101 · ص169 جدول 4.1',
    fx:'الـsubscapularis من الجدار الخلفي للإبط، مش الأمامي.'},
  'g2_axilla-14':{k:'b',on:'2026-11-13',dr:1,src:'ISK 101 · ص169 + ص171-172',
    fx:'الـroots بتقع في الرقبة، ومحتويات الإبط فيها الـcords بس. باقي العبارات صح: الجدار الخلفي (subscapularis وteres major وlatissimus dorsi)، والاتصال بالرقبة بالـcervico-axillary canal، والـserratus anterior في الجدار الإنسي.'},
  'g2_axilla-15':{k:'c',on:'2026-11-13',dr:1,src:'ISK 101 · ص169 + ص171-172',
    fx:'الـtrunks في الرقبة فوق الترقوة والـdivisions في قمة الإبط خلف الترقوة، أما اللي جوه الإبط فهي الـcords وفروعها (ومنها الـaxillary nerve).'},
  'g2_axilla-16':{k:'c',on:'2026-11-13',dr:1,src:'ISK 101 · ص169 جدول 4.1',
    fx:'الإبط بيتصل بالرقبة عن طريق الـcervico-axillary canal (قمته). الـpectoralis major وminor في الجدار الأمامي مش الإنسي، والخلفي مش subscapularis لوحده، والـroots في الرقبة.'}
};

/* بتتنادى من bank.js قبل ما السؤال يتسجّل (قبل حساب «بيتحسب»). بتتجاهل أي سؤال اتصحّح في الداتا نفسها أو ملغي. */
IM.applyFix=function(Q){
  var A=IM.ADDKEYS[Q.id];
  if(A&&!Q.keys.length&&!Q.canc&&!(IM.FIXES[Q.id]&&IM.FIXES[Q.id].off)){
    Q.keys=[A.k]; Q.alt=''; Q.added=true; Q.late=A.on;
    Q.fx=(A.dm||(A.dr?'المفتاح ده متطابق بين كتاب القسم ('+A.src+') والإجابة النموذجية للدكتور أحمد جلال (Axilla MCQs).':'المفتاح ده مأخوذ من كتاب القسم ('+A.src+') لأن الملزمة ماطبعتش له مفتاح.'))+' '+A.fx;
    return Q;
  }
  var F=IM.FIXES[Q.id]; if(!F||Q.bk||Q.canc) return Q;
  if(F.off){ Q.keys=[]; Q.alt=''; Q.rv=F.rv||'السؤال موقوف لحد المراجعة.'; Q.late=F.on; return Q; }
  if(!Q.keys.length) return Q;
  Q.bk=Q.keys.join(','); Q.keys=String(F.k).split(',').map(function(x){return x.trim()}).filter(Boolean);
  Q.fx=F.fx||''; Q.fix=true; Q.alt=''; Q.late=F.on;
  return Q;
};
})();
