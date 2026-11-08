/* Imhotep · إمحتب — مركز الإشعارات والتحديثات (الجرس).
   جديد الموقع + تنبيهات تخصّك. حالة «اتقرا / لسه» محفوظة على الجهاز (im_seen → n:<id>، وim_notes للتنبيهات الشخصية). */
(function(){
'use strict';
var IM=window.IM, h=IM.h, icon=IM.icon;

/* جديد الموقع — الأحدث أول. date = اليوم اللي نزل فيه التحديث */
var UPDATES=[
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

/* ---------- personal notices (saved) ---------- */
IM.notify=function(n){
  if(!n||!n.id) return false;
  var cur=IM.st.notes; for(var i=0;i<cur.length;i++) if(cur[i].id===n.id) return false;
  cur.unshift({id:n.id,ts:n.ts||Date.now(),icon:n.icon||'star',title:n.title||'',text:n.text||'',link:n.link||null});
  if(cur.length>60) IM.st.notes=cur.slice(0,60);
  IM.save('notes'); IM.emit('notes'); return true;
};
IM.on('seal',function(s){
  IM.notify({id:'seal-'+s,icon:'feather',title:'ختم جديد: '+s+' إجابة',text:'وصلت لـ '+s+' إجابة. الختم اتضاف في ميزان الأداء.',link:{label:'ميزان الأداء',hash:'#/scales'}});
});

/* ---------- read / unread ---------- */
function seenKey(id){ return 'n:'+id; }
function createdKey(){ var u=IM.st.user; return u&&u.created?IM.dayKey(new Date(u.created)):null; }
function isRead(it){
  if(IM.st.seen[seenKey(it.id)]) return true;
  if(it.kind==='upd'){ var ck=createdKey(); if(ck&&it.date<ck) return true; }   /* a brand-new student isn't told about older updates */
  return false;
}
function build(){
  var me=[], upd=[];
  var pend=IM.pendingNotices?IM.pendingNotices():[];
  if(pend.length) me.push({id:'p-fix',kind:'act',icon:'scale',title:'اتصحّح مفتاح '+pend.length+' سؤال جاوبته قبل كده',text:'اتأكد إنك مذاكر الإجابة الصح، وهتلاقي الإجابة القديمة والجديدة جنب بعض.',link:{label:'شوف التصحيحات',hash:'#/corrections'},unread:true,sticky:true});
  IM.st.notes.forEach(function(n){ me.push({id:n.id,kind:'me',icon:n.icon,title:n.title,text:n.text,ts:n.ts,link:n.link,unread:!IM.st.seen[seenKey(n.id)]}); });
  UPDATES.forEach(function(u){ upd.push({id:u.id,kind:'upd',icon:u.icon,title:u.title,text:u.text,date:u.date,link:u.link,unread:!isRead({id:u.id,kind:'upd',date:u.date})}); });
  return {me:me,upd:upd};
}
IM.unreadCount=function(){ var b=build(); return b.me.concat(b.upd).filter(function(x){ return x.unread; }).length; };
function markAll(list){ var any=false; list.forEach(function(x){ if(x.unread&&!x.sticky){ IM.st.seen[seenKey(x.id)]=Date.now(); any=true; } }); if(any){ IM.save('seen'); IM.emit('notes'); } }

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
  markAll(p.all);                      /* what you saw counts as read */
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
  return h('li.nc-i'+(x.unread?'.new':'')+(x.kind==='act'?'.act':''),{},h('span.nc-ic',{},icon(x.icon||'info',18)),body);
}
function sun(){
  var s=IM.streak(); if(s.todayLit) return null;
  var need=Math.max(0,IM.DAY_GOAL-s.todayN);
  return {id:'today',kind:'today',icon:'sun',title:'الشروق النهارده',text:'جاوبت '+s.todayN+' من '+IM.DAY_GOAL+'. فاضل '+need+' عشان الشمس تطلع'+(s.now?' وسلسلتك ('+s.now+(s.now===1?' يوم':' أيام')+') تكمّل.':'.')};
}
function toggle(btn){
  if(P){ var same=P.btn===btn; close(); if(same) return; }
  var b=build(), all=b.me.concat(b.upd);
  var el=h('div.nc',{role:'dialog','aria-label':'مركز الإشعارات والتحديثات',tabindex:'-1'});
  var nUn=all.filter(function(x){ return x.unread; }).length;
  var markBtn=h('button.nc-all',{type:'button',disabled:!all.some(function(x){ return x.unread&&!x.sticky; }),onclick:function(){ markAll(all); all.forEach(function(x){ if(!x.sticky) x.unread=false; }); IM.$$('.nc-i.new:not(.act)',el).forEach(function(r){ r.classList.remove('new'); var n=IM.$('.nc-new',r); if(n) n.remove(); }); markBtn.disabled=true; }},icon('check',14),'علّم الكل مقروء');
  el.appendChild(h('div.nc-h',{},h('div.nc-hh',{},icon('bell',20),h('h2.display',{text:'مركز الإشعارات والتحديثات'})),h('button.iconbtn.sm.nc-x',{type:'button','aria-label':'إغلاق',onclick:function(){ close(); }},icon('cross',16))));
  el.appendChild(h('div.nc-bar',{},h('span.muted',{text:nUn?nUn+' جديد':'مفيش جديد'}),markBtn));
  var sc=h('div.nc-s',{});
  var td=sun();
  var mine=b.me.slice(0,8);
  if(mine.length||td){
    sc.appendChild(h('h3.nc-sec',{text:'ليك'}));
    var ul=h('ul.nc-l',{});
    mine.forEach(function(x){ ul.appendChild(row(x)); });
    if(td) ul.appendChild(h('li.nc-i.today',{},h('span.nc-ic',{},icon('sun',18)),h('div.nc-t',{},h('div.nc-top',{},h('b',{text:td.title})),h('p.nc-p',{text:td.text}),h('div.nc-f',{},h('a.nc-a',{href:'#/train',onclick:function(){ close(); }},'ابدأ لفافة',icon('next',14))))));
    sc.appendChild(ul);
  }
  sc.appendChild(h('h3.nc-sec',{text:'جديد في إمحتب'}));
  var ul2=h('ul.nc-l',{}); b.upd.forEach(function(x){ ul2.appendChild(row(x)); }); sc.appendChild(ul2);
  el.appendChild(sc);
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
  P={el:el,btn:btn,all:all,focusBack:false,
     out:function(e){ if(!el.contains(e.target)&&!btn.contains(e.target)) close(); },
     key:function(e){ if(e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); P.focusBack=true; close(); } },
     rs:function(){ place(); }, hc:function(){ close(); }};
  document.addEventListener('pointerdown',P.out,true); document.addEventListener('keydown',P.key,true); window.addEventListener('resize',P.rs); window.addEventListener('hashchange',P.hc);
  btn.setAttribute('aria-expanded','true');
  requestAnimationFrame(function(){ el.classList.add('on'); try{ el.focus({preventScroll:true}); }catch(e){} });
}
IM.bellClose=close;
})();
