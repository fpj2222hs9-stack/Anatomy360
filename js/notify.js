/* Imhotep · إمحتب — مركز الإشعارات والتحديثات (الجرس).
   جديد الموقع + تنبيهات تخصّك. حالة «اتقرا / لسه» محفوظة على الجهاز (im_seen → n:<id>، وim_notes للتنبيهات الشخصية). */
(function(){
'use strict';
var IM=window.IM, h=IM.h, icon=IM.icon;

/* جديد الموقع — الأحدث أول. date = اليوم اللي نزل فيه التحديث */
var UPDATES=[
  {id:'idx-1122',date:'2026-11-22',icon:'award',title:'اتغيّر حساب المؤشر والتقييم الأسبوعي',
   text:'الانتظام (الستريك اليومي) بقى 5 نقاط بس من 100 بدل 15، وزادت نقط التثبيت (55) والدقة (25) عشان المؤشر يقيس مذاكرتك أكتر من حضورك. مؤشرك اتحسب من جديد تلقائيًا بالنظام الجديد. أي خرطوشة وصلتلها بتفضل ليك. والتقييم الأسبوعي بقى كله من أسئلة جاوبتها قبل كده، مفيش فيه سؤال جديد عليك.',
   link:{label:'إزاي اتحسب مؤشرك',hash:'#/cartouche'}},
  {id:'axilla-keys',date:'2026-11-13',icon:'book',title:'16 سؤال في الإبط (Axilla) بقى ليهم مفتاح',
   text:'أسئلة الإبط اللي كانت من غير مفتاح مطبوع في الملزمة اتجاوبت من كتاب القسم (ISK 101)، وبقت بتتحسب. تحت كل سؤال بتلاقي المصدر وصفحة الكتاب وشرح مختصر. مؤشرك ما بيتأثرش: السؤال بيدخل المؤشر لما تجاوبه.',
   link:{label:'ابدأ من الورشة',hash:'#/train'}},
  {id:'phys-ans',date:'2026-11-11',icon:'book',title:'وظائف الأعضاء: الجهاز العصبي اللاإرادي',
   text:'نزل الفصل التاني من وظائف الأعضاء: 100 سؤال في الجهاز العصبي اللاإرادي من بنك أسئلة د. محمد ماهر (المقدمة والعقد العصبية، السمبثاوي، الباراسمبثاوي، والناقلات والمستقبلات والأدوية). تقدر تذاكرها من ورشة الألواح، وبرضه برّه مؤشر إمحتب لحد ما تكمل المادة.',
   link:{label:'ابدأ من الورشة',hash:'#/train'}},
  {id:'phys-blood',date:'2026-11-08',icon:'book',title:'مادة وظائف الأعضاء: فصل الدم',
   text:'نزل أول فصل من وظائف الأعضاء: 185 سؤال في الدم من بنك أسئلة د. محمد ماهر، في تسعة أقسام (سوائل الجسم، بروتينات البلازما، كرات الدم الحمراء، فيتامين B12، الحديد، الأنيميا، التجلط، فصائل الدم). تقدر تذاكرها من ورشة الألواح واللفافة الشاملة. لحد ما تكمل المادة، أسئلتها مش بتدخل في مؤشر إمحتب.',
   link:{label:'ابدأ من الورشة',hash:'#/train'}},
  {id:'weekly-1108',date:'2026-11-08',icon:'water',title:'التقييم الأسبوعي وطريقك للـ100',
   text:'غلطتك الأولى مابقتش بتفضل معاك للأبد: كل غلطة أول مرة بتتمحي بالتدريج لما تراجعها صح، والمراجعة الأخيرة في التقييم الأسبوعي (60 سؤال أغلبهم من أخطائك القديمة، والنجاح 85%). كمان الدقة بقت كاملة عند 90%، والانتظام عند 26 يوم من 30، وامتحان الطبيب الأول بيتفتح من مؤشر 98 ونجاحه 97%.',
   link:{label:'طريقك للـ100',hash:'#/cartouche'}},
  {id:'mixed-tabs',date:'2026-11-06',icon:'mix',title:'اختار الألواح في اللفافة الشاملة',
   text:'في اللفافة الشاملة تقدر دلوقتي تختار الألواح (الفصول) اللي عايز الأسئلة تتسحب منها في كل مادة، بدل ما تاخد المادة كلها.',
   link:{label:'جرّب اللفافة الشاملة',hash:'#/mixed'}},
  {id:'fix-1106',date:'2026-11-06',icon:'scale',title:'اتصحّح مفتاح 6 أسئلة كيمياء حيوية',
   text:'بعد بلاغات الطلبة ومراجعة كتاب د. هشام، اتصحّح مفتاح خمس أسئلة في النيوكليوتيدات وسؤال الميوجلوبين والهيموجلوبين. هتلاقيهم في صفحة التصحيحات بالمفتاح القديم والجديد. وسؤال في الحفرة المرفقية اتوقّف لحد ما نعيده بنصه الصحيح.',
   link:{label:'شوف التصحيحات',hash:'#/corrections'}},
  {id:'cartouche',date:'2026-11-05',icon:'award',title:'خراطيش إمحتب ومؤشر مستواك',
   text:'مستواك بقى له مؤشر واحد من 100 بيتحسب من تقدّمك الفعلي، وبيفتح لك خرطوشة بتتطوّر مع كل مرحلة: SCRIBE ← VIZIER ← PHARAOH ← IMHOTEP. الخرطوشة مش بتنزل أبدًا.',
   link:{label:'شوف خرطوشتك',hash:'#/cartouche'}},
  {id:'bell',date:'2026-11-05',icon:'bell',title:'مركز الإشعارات والتحديثات',
   text:'الجرس ده مكان جديد الموقع وتنبيهاتك، وبيفتكر إنت قريت إيه. الإعدادات وحسابك بيفتحوا من دايرة صورتك.'},
  {id:'mixed',date:'2026-11-05',icon:'mix',title:'اللفافة الشاملة',
   text:'أسئلة متخلطة من كل المواد في لفافة واحدة، بتدريب عادي أو بالساعة المائية، زي الامتحان الشامل.',
   link:{label:'جرّب اللفافة الشاملة',hash:'#/mixed'}},
  {id:'sun50',date:'2026-11-05',icon:'sun',title:'الشمس بقت تطلع بعد 50 إجابة',
   text:'الشروق دلوقتي محتاج 50 إجابة في اليوم. الأيام اللي قبل 5 نوفمبر محفوظة بهدفها القديم، فسلسلتك مش بتتأثر.'},
  {id:'about',date:'2026-11-05',icon:'user',title:'عن إمحتب ومصدر الأسئلة',
   text:'رسالة من صاحب الموقع، وأسماء الدكاترة اللي الأسئلة والمفاتيح منهم، وهتلاقيها كمان جنب كل مادة.',
   link:{label:'اقرا الرسالة',hash:'#/about'}},
  {id:'tour',date:'2026-11-04',icon:'info',title:'جولة تعريفية بالموقع',
   text:'جولة قصيرة بتظلّل كل زرار وتشرح استخدامه. تقدر تشوفها تاني في أي وقت.',
   link:{label:'شوف الجولة',act:'tour'}}
];
IM.UPDATES=UPDATES;

/* ---------- مراجعة 20 نوفمبر: أرقامها من js/fixes.js + إشعار على الشاشة مرة واحدة + مدخل في الجرس ---------- */
var FX_ON='2026-11-20', FX_ON2='2026-11-21', FX_ANN='ann-fix-1120', FX_SINCE='2026-11-22';      /* اللي اتسجّل جديد من FX_SINCE ورا ماشافش المفاتيح القديمة أصلًا فمش بنقوله */
/* بنحسب من js/fixes.js: من غير `only` = كل التصحيحات من مراجعة 20 نوفمبر ورا (الإشعار على الشاشة)، ومع `only` = دفعة يوم واحد (مدخل الجرس) */
function fixStats(only){
  var f=IM.FIXES||{}, g=IM.GONE||{}, r=IM.REVIEW||{}, o={fix:0,bio:0,ana:0,rv:0,gone:0};
  function inn(d){ return only?d===only:(d||'')>=FX_ON; }
  Object.keys(f).forEach(function(id){ var x=f[id]; if(!inn(x.on)||x.off) return; o.fix++; if(/^b\d/.test(id)) o.bio++; else o.ana++; if(x.rvw) o.rv++; });
  Object.keys(r).forEach(function(id){ if(inn(r[id].on)) o.rv++; });
  Object.keys(g).forEach(function(id){ if(inn(g[id].on)) o.gone++; });
  return o;
}
function cnt(n){ return n===1?'سؤال واحد':n===2?'سؤالين':(n>=3&&n<=10)?n+' أسئلة':n+' سؤال'; }
function split(st){ var a=[]; if(st.bio) a.push(st.bio+' كيمياء حيوية'); if(st.ana) a.push(st.ana+' تشريح'); return a.join(' و'); }
IM.fixStats=fixStats; IM.FIX_LAST=FX_ON;      /* «المراجعة الأخيرة» في صفحة التصحيحات = من FX_ON ورا */
(function(){
  [[FX_ON,'fix-1120','تصحيحات ومراجعة جديدة للأسئلة'],[FX_ON2,'fix-1121','تصحيحات جديدة للأسئلة']].forEach(function(b){
    var st=fixStats(b[0]); if(!st.fix&&!st.gone) return;
    var t=[]; if(st.fix) t.push('اتصحّح مفتاح '+cnt(st.fix)+' ('+split(st)+')'); if(st.gone) t.push('اتشال '+cnt(st.gone)+' ملغي أو معيب'); if(st.rv) t.push('وبقى '+cnt(st.rv)+' قيد المراجعة مع الدكتور');
    UPDATES.unshift({id:b[1],date:b[0],icon:'scale',title:b[2],text:t.join('، ')+'. تفاصيل كل سؤال في صفحة التصحيحات.',link:{label:'شوف الأسئلة المصححة',hash:'#/corrections'}});
  });
})();
function fxSeen(){ return !!IM.st.seen[FX_ANN]; }
function fxMark(){ IM.st.seen[FX_ANN]=Date.now(); try{ IM.save('seen'); }catch(e){} }
function fxClear(){        /* مفيش لفافة ولا جولة ولا نافذة مفتوحة ولا شاشة الاسم */
  var top=String(location.hash||'').replace(/^#\/?/,'').split('/')[0];
  if(top==='run'||top==='result') return false;
  if(!IM.st.seen['tour-v1']) return false;
  if(document.querySelector('.ov,.tour-root')) return false;
  var g=document.getElementById('gate'); if(g&&!g.hidden) return false;
  return document.visibilityState!=='hidden';
}
IM.fixAnnounce=function(){
  if(document.querySelector('.ov')) return null;
  var st=fixStats(), pend=IM.pendingNotices?IM.pendingNotices().length:0, dlg=null;
  function close(){ if(dlg) dlg.close(); }
  var li=[
    h('li',{},icon('check',16),h('span',{},h('b',{text:cnt(st.fix)+' اتصحّح مفتاحه'}),' ('+split(st)+'). اللي بيتحسب لك دلوقتي هو المفتاح الجديد.')),
    h('li',{},icon('eye',16),h('span',{},h('b',{text:cnt(st.rv)+' قيد المراجعة'}),' مع الدكتور، وعليها علامة واضحة تحت السؤال.')),
    h('li',{},icon('cross',16),h('span',{},h('b',{text:cnt(st.gone)+' اتشال'}),' من الموقع لأنه ملغي أو اختياراته غلط، وسببه مع اختياراته ومفتاحه المطبوع في صفحة التصحيحات.'))
  ];
  if(pend) li.push(h('li.ann-me',{},icon('flag',16),h('span',{},h('b',{text:pend+' منهم جاوبتهم قبل كده بالمفتاح القديم'}),'، وهتلاقي إجابتك والصح جنب بعض.')));
  var body=h('div.ann',{},
    h('div.ann-art',{'aria-hidden':'true'},h('span.ann-ring'),h('span.ann-ic',{},icon('scale',38))),
    h('div.ann-eb',{text:'بعد المراجعة'}),
    h('h3.display.ann-h',{text:'اتراجعت أسئلة واتصحّحت مفاتيح'}),
    h('p.ann-p',{text:'راجعنا بنوك الكيمياء الحيوية والتشريح مع مفاتيح التصحيح، وده اللي اتغيّر:'}),
    h('ul.ann-ul',{},li));
  var go=h('button.btn.primary.lg',{type:'button',onclick:function(){ close(); IM.go('#/corrections'); }},icon('scale',18),'شوف الأسئلة المصححة');
  var later=h('button.btn.ghost',{type:'button',onclick:close},'تمام');
  fxMark();
  dlg=IM.modal({title:'تصحيحات الأسئلة',cls:'dlg-ann',body:body,foot:[go,later],focus:'.dlg-f .btn.primary'});
  return dlg;
};
/* بتظهر لوحدها مرة واحدة لكل طالب (العلامة بتتسجّل أول ما تظهر)، وبعد الجولة وبعد ما أي نافذة تتقفل. بترجّع true لو لسه هتظهر. */
IM.fixAnnounceMaybe=function(){
  if(fxSeen()) return false;
  var u=IM.st.user, ck=u&&u.created?IM.dayKey(new Date(u.created)):null;
  if(ck&&ck>=FX_SINCE){ fxMark(); return false; }
  var iv=setInterval(function(){
    if(fxSeen()){ clearInterval(iv); return; }
    if(!fxClear()) return;
    clearInterval(iv); IM.fixAnnounce();
  },1200);
  return true;
};

/* ---------- personal notices (saved) ---------- */
IM.notify=function(n){
  if(!n||!n.id) return false;
  var cur=IM.st.notes; for(var i=0;i<cur.length;i++) if(cur[i].id===n.id) return false;
  cur.unshift({id:n.id,ts:n.ts||Date.now(),icon:n.icon||'star',title:n.title||'',text:n.text||'',link:n.link||null});
  if(cur.length>60) IM.st.notes=cur.slice(0,60);
  IM.save('notes'); IM.emit('notes'); return true;
};
IM.on('seal',function(s){
  IM.notify({id:'seal-'+s,icon:'feather',title:s==='all'?'الختم الأعلى: كل الأسئلة':'ختم جديد: '+s+' إجابة',text:s==='all'?'جاوبت كل أسئلة الموقع. الختم الأعلى اتضاف في ميزان الأداء.':'وصلت لـ '+s+' إجابة. الختم اتضاف في ميزان الأداء.',link:{label:'ميزان الأداء',hash:'#/scales'}});
});

/* ---------- read / unread ---------- */
function seenKey(id){ return 'n:'+id; }
function createdKey(){ var u=IM.st.user; return u&&u.created?IM.dayKey(new Date(u.created)):null; }
function isRead(it){
  if(IM.st.seen[seenKey(it.id)]) return true;
  if(it.kind==='upd'){ var ck=createdKey(); if(ck&&it.date<ck) return true; }   /* a brand-new student isn't told about older updates */
  return false;
}
/* المسح: بيتسجّل في im_seen بمفتاح x:<id> (بيتزامن مع الحساب)، ومابيمسحش بيانات. اللي بيتمسح تحديثات الموقع ونتايج التقييم والامتحانات والأختام بس.
   مش بتتمسح أبدًا: التصحيحات (fix-*)، وشرح قواعد المؤشر والتقييم (weekly-1108 وidx-*)، وتنبيهاتك المهمة (خرطوشة جديدة، تقييم مستحق، لوحة الشرف، الحساب). */
var KEEP_UPD=/^(fix-|weekly-1108$|idx-)/, CLR_ME=/^(weekly-\d|trial-|seal-)/;
function clearKey(id){ return 'x:'+id; }
function clearable(x){ return !x.sticky&&(x.kind==='upd'?!KEEP_UPD.test(x.id):(x.kind==='me'&&CLR_ME.test(x.id))); }
function cleared(x){ return clearable(x)&&!!IM.st.seen[clearKey(x.id)]; }
function build(){
  var me=[], upd=[];
  var pend=IM.pendingNotices?IM.pendingNotices():[];
  if(pend.length) me.push({id:'p-fix',kind:'act',icon:'scale',title:'اتصحّح مفتاح '+pend.length+' سؤال جاوبته قبل كده',text:'اتأكد إنك مذاكر الإجابة الصح، وهتلاقي الإجابة القديمة والجديدة جنب بعض.',link:{label:'شوف التصحيحات',hash:'#/corrections'},unread:true,sticky:true});
  IM.st.notes.forEach(function(n){ var x={id:n.id,kind:'me',icon:n.icon,title:n.title,text:n.text,ts:n.ts,link:n.link,unread:!IM.st.seen[seenKey(n.id)]}; if(!cleared(x)) me.push(x); });
  UPDATES.forEach(function(u){ var x={id:u.id,kind:'upd',icon:u.icon,title:u.title,text:u.text,date:u.date,link:u.link,unread:!isRead({id:u.id,kind:'upd',date:u.date})}; if(!cleared(x)) upd.push(x); });
  upd.sort(function(a,b){ return a.date<b.date?1:(a.date>b.date?-1:0); });      /* الأحدث أول حتى لو ملف تاني ضاف مدخل في الأول (ترتيب ثابت لنفس اليوم) */
  return {me:me,upd:upd};
}
IM.unreadCount=function(){ var b=build(); return b.me.concat(b.upd).filter(function(x){ return x.unread; }).length; };
/* علامة «جديد» مابتتشالش إلا لما الطالب يفتح الإشعار نفسه فعلًا (ضغطة على الإشعار أو على رابطه). قفل الجرس ما بيعلّمش حاجة مقروءة. */
function openOne(x,li){
  if(!x.unread||x.sticky) return;
  IM.st.seen[seenKey(x.id)]=Date.now(); x.unread=false; IM.save('seen'); IM.emit('notes');
  if(li){ li.classList.remove('new'); var b=IM.$('.nc-new',li); if(b) b.remove(); }
  if(P&&P.recount) P.recount();
}
function clearList(list){ var n=0; list.forEach(function(x){ if(clearable(x)){ IM.st.seen[clearKey(x.id)]=Date.now(); n++; } }); if(n){ IM.save('seen'); IM.emit('notes'); } return n; }

/* ---------- the bell button + badge ---------- */
IM.bellButton=function(){
  var badge=h('span.bell-b',{'aria-hidden':'true'});
  var btn=h('button.iconbtn.bellbtn',{type:'button','aria-haspopup':'dialog','aria-expanded':'false',onclick:function(){ toggle(btn); }},icon('bell',20),badge);
  function paint(){
    var n=IM.unreadCount();
    badge.textContent=n>9?'9+':String(n); badge.hidden=n===0;
    btn.setAttribute('aria-label','مركز الإشعارات والتحديثات'+(n?' ('+n+' جديد)':''));
    btn.title='مركز الإشعارات والتحديثات'; btn.classList.toggle('has',n>0);
  }
  paint(); IM.on('notes',paint); IM.on('answer',paint);
  return btn;
};

/* ---------- the panel ---------- */
var P=null;
function close(){
  if(!P) return; var p=P; P=null;
  document.removeEventListener('pointerdown',p.out,true); document.removeEventListener('keydown',p.key,true); window.removeEventListener('resize',p.rs); window.removeEventListener('hashchange',p.hc);
  p.btn.setAttribute('aria-expanded','false');
  p.el.classList.add('out'); setTimeout(function(){ if(p.el.parentNode) p.el.parentNode.removeChild(p.el); },160);
  try{ if(p.focusBack&&p.btn.isConnected) p.btn.focus({preventScroll:true}); }catch(e){}
}
function when(x){
  if(x.ts) return IM.fmtDate(IM.dayKey(new Date(x.ts)));
  return x.date?IM.fmtDate(x.date):'';
}
function runLink(l){
  if(l.act==='tour'){ close(); setTimeout(function(){ if(IM.tourStart) IM.tourStart(true); },260); }
}
function row(x){
  var l=x.link;
  var body=h('div.nc-t',{},
    h('div.nc-top',{},h('b',{text:x.title}),x.unread?h('span.nc-new',{text:x.sticky?'محتاج انتباهك':'جديد'}):null),
    h('p.nc-p',{text:x.text}),
    h('div.nc-f',{},h('span.nc-d.muted',{text:when(x)}),l?(l.hash?h('a.nc-a',{href:l.hash,onclick:function(){ close(); }},l.label,icon('next',14)):h('button.nc-a',{type:'button',onclick:function(){ runLink(l); }},l.label,icon('next',14))):null));
  var li=h('li.nc-i'+(x.unread?'.new':'')+(x.kind==='act'?'.act':''),{onclick:function(){ openOne(x,li); }},h('span.nc-ic',{},icon(x.icon||'info',18)),body);
  if(!l&&x.unread&&!x.sticky){ li.tabIndex=0; li.addEventListener('keydown',function(e){ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); openOne(x,li); } }); }
  return li;
}
/* عنوان قسم + زرار مسح (بيظهر بس لو في حاجة تتمسح، وبيطلب تأكيد بضغطة تانية) */
function secHead(title,label,list,done){
  var head=h('div.nc-sech',{},h('h3.nc-sec',{text:title}));
  if(list.some(clearable)){
    var lb=h('span',{text:label}), btn=h('button.nc-clr',{type:'button'},icon('cross',12),lb), armed=false, tm=0;
    btn.addEventListener('click',function(){
      if(!armed){ armed=true; btn.classList.add('arm'); lb.textContent='تأكيد المسح؟'; tm=setTimeout(function(){ armed=false; btn.classList.remove('arm'); lb.textContent=label; },4000); return; }
      clearTimeout(tm); clearList(list); done();
    });
    head.appendChild(btn);
  }
  return head;
}
function sun(){
  var s=IM.streak(); if(s.todayLit) return null;
  var need=Math.max(0,IM.DAY_GOAL-s.todayN);
  return {id:'today',kind:'today',icon:'sun',title:'الشروق النهارده',text:'جاوبت '+s.todayN+' من '+IM.DAY_GOAL+'. فاضل '+need+' عشان الشمس تطلع'+(s.now?' وسلسلتك ('+s.now+(s.now===1?' يوم':' أيام')+') تكمّل.':'.')};
}
function toggle(btn){
  if(P){ var same=P.btn===btn; close(); if(same) return; }
  var el=h('div.nc',{role:'dialog','aria-label':'مركز الإشعارات والتحديثات',tabindex:'-1'});
  var cnt=h('span.muted',{});
  el.appendChild(h('div.nc-h',{},h('div.nc-hh',{},icon('bell',20),h('h2.display',{text:'مركز الإشعارات والتحديثات'})),h('button.iconbtn.sm.nc-x',{type:'button','aria-label':'إغلاق',onclick:function(){ close(); }},icon('cross',16))));
  el.appendChild(h('div.nc-bar',{},cnt));
  var sc=h('div.nc-s',{}), shown=[];
  function recount(){ var n=shown.filter(function(x){ return x.unread; }).length; cnt.textContent=n?n+' جديد':'مفيش جديد'; }
  function paintBody(){
    var b=build(), mine=b.me.slice(0,8), td=sun(); shown=mine.concat(b.upd);
    sc.textContent='';
    if(mine.length||td){
      sc.appendChild(secHead('ليك','مسح النتايج',b.me,repaint));
      var ul=h('ul.nc-l',{});
      mine.forEach(function(x){ ul.appendChild(row(x)); });
      if(td) ul.appendChild(h('li.nc-i.today',{},h('span.nc-ic',{},icon('sun',18)),h('div.nc-t',{},h('div.nc-top',{},h('b',{text:td.title})),h('p.nc-p',{text:td.text}),h('div.nc-f',{},h('a.nc-a',{href:'#/train',onclick:function(){ close(); }},'ابدأ لفافة',icon('next',14))))));
      sc.appendChild(ul);
    }
    sc.appendChild(secHead('جديد في إمحتب','مسح التحديثات',b.upd,repaint));
    var ul2=h('ul.nc-l',{}); b.upd.forEach(function(x){ ul2.appendChild(row(x)); });
    if(!b.upd.length) ul2.appendChild(h('li.nc-empty.muted',{text:'مفيش تحديثات دلوقتي.'}));
    sc.appendChild(ul2);
    sc.appendChild(h('p.nc-keep.muted',{text:'المسح بيشيل تحديثات الموقع ونتايج التقييم والامتحانات والأختام بس. التصحيحات وتنبيهات التقييم الأسبوعي والخراطيش ولوحة الشرف بتفضل، ومفيش علامة «جديد» بتتشال إلا لما تفتح الإشعار.'}));
    recount();
  }
  function repaint(){ paintBody(); try{ el.focus({preventScroll:true}); }catch(e){} }
  paintBody(); el.appendChild(sc);
  document.body.appendChild(el);
  /* position under the bell, kept inside the screen */
  function place(){
    var r=btn.getBoundingClientRect(), vw=document.documentElement.clientWidth, vh=window.innerHeight, w=Math.min(404,vw-24);
    el.style.width=w+'px';
    var left=Math.max(12,Math.min(r.left+r.width/2-w/2,vw-w-12));
    el.style.left=left+'px'; el.style.top=Math.round(r.bottom+10)+'px';
    var bottomGap=vw<=760?88:16; el.style.maxHeight=Math.max(220,vh-r.bottom-10-bottomGap)+'px';
    el.style.setProperty('--ax',Math.round(r.left+r.width/2-left)+'px');
  }
  place();
  P={el:el,btn:btn,recount:recount,focusBack:false,
     out:function(e){ if(!el.contains(e.target)&&!btn.contains(e.target)) close(); },
     key:function(e){ if(e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); P.focusBack=true; close(); } },
     rs:function(){ place(); }, hc:function(){ close(); }};
  document.addEventListener('pointerdown',P.out,true); document.addEventListener('keydown',P.key,true); window.addEventListener('resize',P.rs); window.addEventListener('hashchange',P.hc);
  btn.setAttribute('aria-expanded','true');
  requestAnimationFrame(function(){ el.classList.add('on'); try{ el.focus({preventScroll:true}); }catch(e){} });
}
IM.bellClose=close;
})();
