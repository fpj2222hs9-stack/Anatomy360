/* Imhotep · إمحتب — عن إمحتب: رسالة من صاحب الموقع + مصدر الأسئلة والداتا */
(function(){
'use strict';
var IM=window.IM, h=IM.h, icon=IM.icon;

/* مصدر الداتا والأسئلة */
var CREDITS=[
  {sid:'anatomy',en:'Anatomy',ar:'التشريح',dr:'د. أحمد جلال'},
  {sid:'biochemistry',en:'Biochemistry',ar:'الكيمياء الحيوية',dr:'د. هشام عصمت'},
  {sid:'histology',en:'Histology',ar:'الهستولوجيا',dr:'د. أحمد زهرة'},
  {sid:'physiology',en:'Physiology',ar:'وظائف الأعضاء',dr:'د. محمد ماهر'}
];
IM.CREDITS=CREDITS;

/* small credit lines: the doctor's name next to the subject (kept out of the question screen on purpose) */
function creditOf(sid){ for(var i=0;i<CREDITS.length;i++) if(CREDITS[i].sid===sid) return CREDITS[i]; return null; }
IM.creditOf=creditOf;
IM.creditLine=function(sids,o){
  o=o||{}; var list=(sids||[]).map(creditOf).filter(Boolean);
  if(!list.length) return null;
  var el=h('div.cr-line'+(o.cls?'.'+o.cls:''),{title:'مصدر الأسئلة والمفاتيح المطبوعة'});
  el.appendChild(icon('user',13));
  el.appendChild(h('span.cr-k',{text:'مصدر الأسئلة:'}));
  list.forEach(function(c,i){
    if(i) el.appendChild(h('span.cr-sep',{'aria-hidden':'true',text:'·'}));
    el.appendChild(h('span.cr-n',{},h('b',{text:c.dr}),list.length>1?h('span.cr-s',{text:' ('+c.ar+')'}):null));
  });
  return el;
};

IM.screens.about=function(view){
  var u=IM.st.user, wrap=h('div.ab'); view.appendChild(wrap);
  wrap.appendChild(h('div.pg-h',{},h('div',{},IM.eyebrow('عن إمحتب'),h('h1.display',{text:'رسالة من صاحب الموقع'})),h('p.muted',{text:'كلمتين من اللي عمل الموقع، وشكر للي اتبنى على شغلهم.'})));

  var letter=h('article.card.ab-letter',{},
    h('div.ab-mark',{html:IM.pyr(6,{anim:true,size:74})}),
    h('div.ab-body',{},
      h('p.ab-hi.display',{text:'أهلًا بيك'+(u&&u.name?' يا '+u.name:'')}),
      h('p',{text:'أنا سيف يسري، وإمحتب عملته بنفسي من أول سطر لآخر سطر.'}),
      h('p',{text:'الفكرة إنه يبقى عندنا مكان واحد نحل فيه أسئلة موادنا، ونشوف إحنا واقفين فين بالظبط، ونرجع للغلطات لحد ما نثبّتها. بنيته بسيط ومريح، وتقدّمك محفوظ عندك على جهازك.'}),
      h('p',{text:'كل أسئلة الموقع مصدرها دكاترتنا، وأنا بس رتّبتها ونظّمتها عشان تذاكرها بطريقة أسهل. فشكر كبير ليهم، وهتلاقي أسماءهم تحت.'}),
      h('p',{text:'ولو لقيت سؤال مفتاحه شكله غلط، دوس «اعترض على المفتاح» جوه السؤال وابعتهولي. كل ملاحظة منكم بتخلّي الموقع أدق للدفعة كلها.'}),
      h('p',{text:'ذاكر بهدوء، وحُلّ بتركيز، وخلّي كل لفافة تقرّبك درجة من القمة. وبالتوفيق ليك ولينا كلنا.'}),
      h('div.ab-sign',{},h('span.display.ab-by',{text:'سيف يسري'}),h('span.sig.ab-en',{dir:'ltr'},h('span.sig-by',{text:'Made By'}),' ',h('span.sig-name',{text:'Dr.Saif Youssry'})))));
  wrap.appendChild(letter);

  wrap.appendChild(IM.section('مصدر الأسئلة والداتا','أسئلة كل مادة ومفاتيحها المطبوعة جاية من دكاترتنا.'));
  var cr=h('div.ab-cr',{});
  CREDITS.forEach(function(c){
    var S=IM.subject(c.sid);
    cr.appendChild(h('div.card.ab-c.'+(S?S.cls:'sub-all'),{},
      h('div.ab-cs',{},h('span.chip.sub',{},h('span.dot'),c.en)),
      h('h3.display',{text:c.ar}),
      h('div.ab-dr',{},icon('user',18),h('b',{text:c.dr}))));
  });
  wrap.appendChild(cr);
  wrap.appendChild(h('p.muted.ab-note',{text:'الأسئلة معروضة بمفاتيحها المطبوعة زي ما وصلتني. أي مفتاح اتصحّح بعد مراجعة بيظهر معلَّم جوه الموقع.'}));

  wrap.appendChild(h('div.card.ab-priv',{},icon('lock',20),h('p.muted',{text:'تقدّمك وإجاباتك محفوظين على جهازك بس. الموقع بيستخدم إحصائيات زيارات عامة (Google Analytics) عشان نعرف كام واحد بيستخدمه.'}),IM.boardOn&&IM.boardOn()?h('p.muted',{text:'لوحة الشرف اختيارية: لو اشتركت فيها بس، اسم الظهور ومرحلتك ومؤشرك ونقاطك وعدد الأسئلة اللي جاوبتها بتتبعت لشيت خاص بالموقع على Google وبتظهر لباقي المشتركين. مفيش إجابات ولا واتساب ولا صور. وتقدر تلغي اشتراكك في أي وقت من صفحة لوحة الشرف.'}):null));
  wrap.appendChild(h('div.ab-back',{},h('a.btn.primary',{href:'#/'},icon('home',18),'الرئيسية'),h('a.btn.ghost',{href:'#/train'},'ورشة الألواح')));
  return {destroy:function(){}};
};
})();
