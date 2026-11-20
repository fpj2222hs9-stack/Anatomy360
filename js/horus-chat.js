/* Imhotep · إمحتب — حورس: الشات العايم (للمذاكرة، مش للامتحان)
   زرار عايم في ركن الشاشة بيفتح بانل جانبي. الطالب بيسأل في المنهج، والسيرفر (دالة باسم horus: Supabase Edge Function أو Firebase Cloud Function حسب المزوّد في js/cloud.js) بيدوّر في كتب الأقسام
   وبيرجّع الإجابة مصاغة. الموقع نفسه مفيهوش مفتاح Gemini ولا بيكلّم Gemini: بيكلّم الدالة بتوكن الطالب بس.

   - مقفول من js/ai-config.js (IM.AI.chat.on). في وضع التجربة (pilot:true) بيتفتح بس على متصفح فتح الموقع مرة بـ ?horus=1 (وبيتقفل بـ ?horus=0).
   - بيشتغل بس لو حفظ التقدّم على حساب جوجل شغّال (js/cloud.js) والطالب مسجّل دخول: الحد اليومي والمحادثة المحفوظة مربوطين بالحساب.
   - مخفي في #/run/* ومقفول (فيه قفل) طول ما فيه امتحان مفتوح (الساعة المائية / الترقية / التقييم الأسبوعي). القفل جوه الموقع بس: مفيش حاجة
     تمنع الطالب يفتح جوجل أو ذكاء اصطناعي تاني في تبويب تاني.
   - المحادثة محفوظة على الجهاز (localStorage، لكل حساب) وعلى الحساب (horus_chat بصلاحية الطالب نفسه: RLS في Supabase وقواعد Firestore في Firebase)، وبتندمج بين الأجهزة بالاتحاد.
   - الرسايل بتتعرض بـ DOM nodes بس (من غير innerHTML) من نص الإجابة. */
(function(){
'use strict';
var IM=window.IM, h=IM.h, icon=IM.icon, S=IM.store;
var CC=(IM.AI&&IM.AI.chat)||{on:false};
var SUBJ=[['all','الكل'],['anatomy','التشريح'],['histology','الهستولوجيا'],['physiology','وظائف الأعضاء'],['biochemistry','الكيمياء الحيوية']];
var KSID='im_hc_sid', HK='im_hc_', KSEEN='im_hc_seen', CAP=60;
var STAR='M0.00 -20.00 C3.20 -9.60 9.60 -3.20 20.00 0.00 C9.60 3.20 3.20 9.60 0.00 20.00 C-3.20 9.60 -9.60 3.20 -20.00 0.00 C-9.60 -3.20 -3.20 -9.60 0.00 -20.00Z';

/* ---------- تفعيل ---------- */
var pilotOn=(function(){ try{ var u=new URL(location.href), q=u.searchParams.get('horus');
  if(q==='1') localStorage.setItem('im_horus_pilot','1'); else if(q==='0') localStorage.removeItem('im_horus_pilot');
  if(q!==null){ u.searchParams.delete('horus'); try{ history.replaceState(null,'',u.pathname+(u.search||'')+u.hash); }catch(e){} }
  return localStorage.getItem('im_horus_pilot')==='1'; }catch(e){ return false; } })();
function on(){ return !!(CC.on&&(!CC.pilot||pilotOn)&&IM.cloudOn&&IM.cloudOn()&&(!IM.cloudFnReady||IM.cloudFnReady())&&IM.bank&&IM.bank.ready&&!IM.bank.single); }
function uid(){ return IM.cloudUid?IM.cloudUid():''; }
function signedIn(){ return !!(IM.cloudState&&IM.cloudState().signedIn&&uid()); }
function motionOff(){ return document.documentElement.classList.contains('calm')||(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches); }

/* ---------- قفل الامتحانات ---------- */
function anyExam(){
  var all=IM.sessions(), k, s;
  for(k in all){ s=all[k]; if(s&&s.state==='run'&&s.cfg&&s.cfg.mode==='water'&&!s.cfg.spectate) return true; }
  return false;
}
function onRun(){ return /^#\/run(\/|$)/.test(location.hash||''); }
function lockToast(){ IM.toast('حورس مقفول لحد ما تسلّم الامتحان المفتوح.',{icon:'lock'}); }

/* ---------- المحادثة المحفوظة ---------- */
var H0={uid:'',msgs:[],clr:0,sync:0};
var Hs=H0;
function nid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
function okMsg(m){ return !!(m&&typeof m==='object'&&typeof m.i==='string'&&m.i.length<=40&&(m.r==='u'||m.r==='a')&&typeof m.t==='string'&&isFinite(m.ts)); }
function clean(m){
  var o={i:m.i,r:m.r,t:String(m.t).slice(0,m.r==='u'?1000:6500),ts:+m.ts};
  if(m.sid) o.sid=String(m.sid).slice(0,12);
  if(m.r==='a'){
    if(m.st==='book'||m.st==='general'||m.st==='off') o.st=m.st;
    if(Array.isArray(m.ss)) o.ss=m.ss.slice(0,4).map(function(s){ return {h:String(s.h||'').slice(0,160),b:String(s.b||'').slice(0,120),c:String(s.c||'').slice(0,120),p:String(s.p||'').slice(0,20)}; });
    if(m.ca) o.ca=String(m.ca).slice(0,12);
    if(m.kd) o.kd=1;
    if(m.ky&&m.ky.length) o.ky=m.ky.slice(0,4).map(function(x){ return String(x).slice(0,1); });
  }
  if(m.qid) o.qid=String(m.qid).slice(0,80);
  if(m.qh) o.qh=String(m.qh).slice(0,16);
  return o;
}
function loadH(){
  var u=uid();
  if(!u){ Hs=H0; return Hs; }
  if(Hs.uid===u) return Hs;
  var d=S.get(HK+u,null)||{};
  Hs={uid:u,msgs:(Array.isArray(d.msgs)?d.msgs.filter(okMsg).map(clean):[]),clr:+d.clr||0,sync:+d.sync||0};
  return Hs;
}
function saveH(){ if(Hs.uid) S.set(HK+Hs.uid,{msgs:Hs.msgs,clr:Hs.clr,sync:Hs.sync}); }
function capH(){
  Hs.msgs.sort(function(a,b){ return a.ts-b.ts; });
  if(Hs.msgs.length>CAP) Hs.msgs=Hs.msgs.slice(-CAP);
  /* الصف على الحساب ليه حد حجم (400KB في قاعدة البيانات): الإجابات الكاملة أطول، فبنشيل الأقدم لو الحجم التقديري (حرف عربي = بايتين) عدّى 300KB */
  while(Hs.msgs.length>2&&JSON.stringify(Hs.msgs).length*2>300000) Hs.msgs.shift();
}
function addMsg(m){ loadH(); if(!Hs.uid) return; Hs.msgs.push(clean(m)); capH(); saveH(); scheduleSync(2500); }
function dropMsg(id){ if(!Hs.uid) return; Hs.msgs=Hs.msgs.filter(function(m){ return m.i!==id; }); saveH(); }
function ids(list){ return list.map(function(m){ return m.i; }).join(','); }

/* اتحاد النسخة اللي على الحساب مع نسخة الجهاز: اللي اتمسح (clr) مابيرجعش، والباقي بيتجمّع */
function mergeRemote(rem){
  var clr=Hs.clr, list=[];
  (Array.isArray(rem)?rem:[]).forEach(function(m){ if(m&&m.i==='~'){ clr=Math.max(clr,+m.ts||0); } else if(okMsg(m)) list.push(clean(m)); });
  var seen={}, out=[];
  Hs.msgs.concat(list).forEach(function(m){ if(m.ts<=clr||seen[m.i]) return; seen[m.i]=1; out.push(m); });
  Hs.clr=clr; Hs.msgs=out; capH();
}
function remoteBody(){ var a=Hs.clr?[{i:'~',ts:Hs.clr}]:[]; return a.concat(Hs.msgs); }
var syncing=null, syncT=null;
function scheduleSync(ms){ if(syncT) return; syncT=setTimeout(function(){ syncT=null; syncNow(); },ms); }
function syncNow(){
  if(syncing) return syncing;
  if(!uid()||!IM.cloudChatGet) return Promise.resolve('off');
  loadH(); var u=Hs.uid;
  syncing=IM.cloudChatGet().then(function(row){
    if(Hs.uid!==u) return 'switched';
    var before=ids(Hs.msgs)+'|'+Hs.clr;
    var remIds=row?ids((row.msgs||[]).filter(okMsg)):'', remClr=0;
    (row&&row.msgs||[]).forEach(function(m){ if(m&&m.i==='~') remClr=Math.max(remClr,+m.ts||0); });
    if(row) mergeRemote(row.msgs);
    var changed=before!==(ids(Hs.msgs)+'|'+Hs.clr);
    saveH();
    if(!row||remIds!==ids(Hs.msgs)||remClr!==Hs.clr){
      return IM.cloudChatPut(remoteBody()).then(function(){
        Hs.sync=Date.now(); saveH(); return changed?'merged':'pushed';
      });
    }
    Hs.sync=Date.now(); saveH(); return changed?'merged':'same';
  }).then(function(res){ syncing=null; if(res==='merged'&&st!=='closed'&&P) renderAll(); return res; },function(){ syncing=null; return 'error'; });
  return syncing;
}
IM.horusChatPurge=function(u){
  if(u) S.del(HK+u);
  Hs=H0;
  if(syncT){ clearTimeout(syncT); syncT=null; }
  if(st!=='closed') close(true);
  if(P) renderAll();
};

/* ---------- عرض النص (بدون innerHTML) ---------- */
var LAT=/[A-Za-z][A-Za-z0-9]*(?:[ \-'’\/.][A-Za-z0-9]+)*/g;
function plain(s){
  var out=[], last=0, m, b; LAT.lastIndex=0;
  while((m=LAT.exec(s))){
    if(m.index>last) out.push(s.slice(last,m.index));
    b=document.createElement('bdi'); b.dir='ltr'; b.className='lat'; b.textContent=m[0]; out.push(b); last=m.index+m[0].length;
  }
  if(last<s.length) out.push(s.slice(last));
  return out;
}
function inline(s){
  var out=[], parts=String(s).split(/\*\*(.+?)\*\*/);
  parts.forEach(function(x,i){ if(i%2) out.push(h('b',{},plain(x))); else if(x) out=out.concat(plain(x)); });
  return out;
}
function md(t){
  var wrap=h('div.hc-md',{dir:'auto'}), p=null, ul=null;
  String(t||'').replace(/\r/g,'').split('\n').forEach(function(raw){
    var line=raw.trim(), li;
    if(!line){ p=null; ul=null; return; }
    li=/^(?:[-*•])\s+(.*)$/.exec(line);
    if(li){ if(!ul){ ul=h('ul',{}); wrap.appendChild(ul); } p=null; ul.appendChild(h('li',{dir:'auto'},inline(li[1]))); return; }
    ul=null;
    if(!p){ p=h('p',{dir:'auto'}); wrap.appendChild(p); } else p.appendChild(document.createElement('br'));
    inline(line).forEach(function(n){ p.appendChild(n.nodeType?n:document.createTextNode(n)); });
  });
  return wrap;
}

/* ---------- الحالة ---------- */
var st='closed', P=null, fab=null, cur=null, openT=null, closeT=null, afterFn=null, played=0;
var busy=false, left=null, lim=null, sid=S.get(KSID,'all');
if(!SUBJ.some(function(x){ return x[0]===sid; })) sid='all';

/* ---------- الشعار المتحرك (النجمة بتطلع شمس فوق الهرم) ---------- */
var EM={P:150,E:104,G:6};
function emblem(){
  var sy=EM.P+EM.G+97*EM.E/240, dy=Math.round(sy-16/76*EM.P), sz=Math.round(44*EM.E/240*10)/10;
  return h('div.hc-em',{style:{'--dy':dy+'px','--sy':Math.round(sy)+'px'}},
    h('div.hc-em-p',{html:IM.pyr(6,{cls:'hc-pyr',size:EM.P})}),
    h('div.hc-em-e',{html:IM.horus({badge:false,size:EM.E})}),
    h('span.hc-fly',{html:'<svg viewBox="-22 -22 44 44" width="'+sz+'" height="'+sz+'" aria-hidden="true"><path d="'+STAR+'"/></svg>'}));
}
function miniEmblem(){
  return h('span.hc-mini',{'aria-hidden':'true'},
    h('span',{html:IM.pyr(6,{size:30})}),
    h('span',{html:IM.horus({badge:false,size:26})}));
}

/* ---------- الزرار العايم ---------- */
function ensureFab(){
  if(fab) return fab;
  var seen=+S.get(KSEEN,0)||0; S.set(KSEEN,seen+1);
  fab=h('button.hc-fab',{type:'button','aria-label':'اسأل حورس','aria-haspopup':'dialog','aria-expanded':'false',onclick:function(){ if(anyExam()) lockToast(); else open(); }},
    h('span.hc-fab-i',{html:IM.horus({badge:true,size:40,state:'idle'})}),
    h('span.hc-lock',{},icon('lock',13)),
    seen<3?h('span.hc-tip',{text:'اسأل حورس'}):null);
  fab.hidden=true; document.body.appendChild(fab);
  return fab;
}
function fabState(){
  var ok=on();
  if(!ok){ if(fab) fab.hidden=true; if(st!=='closed') close(true); return; }
  ensureFab();
  var ex=anyExam();
  if(ex&&st!=='closed'){ close(true); lockToast(); }
  var show=!onRun()&&(st==='closed');
  var was=fab.hidden;
  fab.hidden=!show;
  if(show&&was) { fab.classList.remove('pop'); void fab.offsetWidth; fab.classList.add('pop'); }
  fab.classList.toggle('locked',ex);
  fab.setAttribute('aria-label',ex?'حورس مقفول أثناء الامتحان':'اسأل حورس');
}

/* ---------- البانل ---------- */
function sendIcon(){ var s=h('svg',{viewBox:'0 0 24 24',width:20,height:20,fill:'none',stroke:'currentColor','stroke-width':2,'stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'},h('path',{d:'M12 19V5M6 11l6-6 6 6'})); return s; }
function build(){
  if(P) return;
  var R={};
  R.root=h('section.hc',{role:'dialog','aria-label':'حورس: مساعد المذاكرة',hidden:true,onkeydown:function(e){ if(e.key==='Escape'){ e.stopPropagation(); close(); } }});
  R.left=h('span.hc-left',{});
  var armT=null;
  R.clr=h('button.iconbtn.sm.hc-clr',{type:'button','aria-label':'مسح المحادثة',title:'مسح المحادثة',onclick:function(){
    if(R.clr.classList.contains('armed')){ clearTimeout(armT); R.clr.classList.remove('armed'); R.clr.title='مسح المحادثة'; clearChat(); return; }
    R.clr.classList.add('armed'); R.clr.title='اضغط تاني لتأكيد المسح'; IM.toast('اضغط زرار المسح تاني للتأكيد.',{icon:'trash',ms:2500});
    clearTimeout(armT); armT=setTimeout(function(){ R.clr.classList.remove('armed'); R.clr.title='مسح المحادثة'; },4000);
  }},icon('trash',17));
  var origArm=R.clr;
  R.hd=h('header.hc-hd',{},miniEmblem(),
    h('div.hc-id',{},h('b.hc-name',{text:'حورس'}),h('span.hc-sub',{text:'مساعد المذاكرة'})),
    R.left,origArm,
    h('button.iconbtn.sm.hc-x',{type:'button','aria-label':'إغلاق',title:'إغلاق',onclick:function(){ close(); }},icon('cross',19)));
  R.sc=h('div.hc-sc',{role:'group','aria-label':'المادة'});
  SUBJ.forEach(function(x){
    var b=h('button.hc-chip',{type:'button','aria-pressed':String(sid===x[0]),dataset:{sid:x[0]},onclick:function(){ setSid(x[0]); }},x[1]); R.sc.appendChild(b);
  });
  R.body=h('div.hc-body',{role:'log','aria-live':'polite','aria-label':'المحادثة'});
  R.ta=h('textarea.hc-in',{rows:1,maxlength:1000,placeholder:'اسأل حورس عن نقطة في المنهج…',dir:'auto','aria-label':'سؤالك لحورس',
    oninput:grow,onkeydown:function(e){ if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){ e.preventDefault(); submit(); } }});
  R.send=h('button.btn.primary.hc-send',{type:'submit','aria-label':'إرسال'},sendIcon());
  R.ft=h('form.hc-ft',{onsubmit:function(e){ e.preventDefault(); submit(); }},
    h('div.hc-rw',{},R.ta,R.send),
    h('p.hc-note',{},'حورس ذكاء اصطناعي وممكن يغلط. الكتاب هو المرجع. ',h('a',{href:'privacy.html',target:'_blank',rel:'noopener'},'الخصوصية')));
  R.root.appendChild(R.hd); R.root.appendChild(R.sc); R.root.appendChild(R.body); R.root.appendChild(R.ft);
  document.body.appendChild(R.root);
  P=R;
}
function grow(){ var t=P.ta; t.style.height='auto'; t.style.height=Math.min(t.scrollHeight,128)+'px'; }
function setSid(v){
  sid=v; S.set(KSID,v);
  IM.$$('.hc-chip',P.sc).forEach(function(b){ b.setAttribute('aria-pressed',String(b.dataset.sid===v)); });
}
function scrollEnd(){ if(P) P.body.scrollTop=P.body.scrollHeight; }
function setLeft(){
  if(!P) return;
  var t=(left!=null&&lim!=null)?('باقي '+left+' من '+lim+' النهاردة'):'';
  P.left.textContent=t; P.left.classList.toggle('zero',left===0);
}
function setComposer(){
  if(!P) return;
  var si=signedIn(), no=!si||left===0;
  P.ta.disabled=no||busy; P.send.disabled=no||busy;
  P.ta.placeholder=!si?'سجّل دخولك بجوجل الأول':(left===0?'خلّصت أسئلة النهاردة':'اسأل حورس عن نقطة في المنهج…');
  P.ft.classList.toggle('off',no);
  P.clr.hidden=!si;
}

/* رسالة واحدة */
function srcList(ss){
  var d=h('details.hc-src',{},h('summary',{text:'المصادر ('+ss.length+')'})), ul=h('ul',{});
  ss.forEach(function(s){
    var meta=[s.b,s.c,s.p?('p.'+s.p):''].filter(Boolean).join(' · ');
    ul.appendChild(h('li',{dir:'ltr',lang:'en'},h('strong',{text:s.h||'Relevant section'}),meta?h('span',{text:meta}):null));
  });
  d.appendChild(ul); return d;
}
function msgEl(m){
  if(m.r==='u') return h('div.hc-m.u',{},h('div.hc-bub',{dir:'auto',text:m.t}));
  var b=h('div.hc-bub',{});
  if(m.qid&&m.ca){ b.appendChild(h('p.hc-ca',{},'الإجابة الأرجح: ',h('b.mono',{text:String(m.ca).toUpperCase().replace(/,/g,' + ')}))); }
  if(m.qid&&m.kd){
    var key=(m.ky||[]).map(function(x){ return x.toUpperCase(); }).join(' + ')||'—';
    b.appendChild(h('div.hc-kd'+(m.st==='book'?'.book':''),{},icon('warn',16),h('span',{},
      m.st==='book'?['الكتاب هنا بيدّي إجابة مختلفة عن مفتاح الموقع (',h('b.mono',{text:key}),'). لو شايف إن المفتاح غلط بلّغ من زرار الاعتراض.']
                   :['الشرح ده من المعرفة العامة مش من الكتاب، وإجابته مختلفة عن مفتاح الموقع (',h('b.mono',{text:key}),'). متعتمدش عليه لوحده.'])));
  }
  b.appendChild(md(m.t));
  var foot=h('div.hc-meta',{});
  if(m.st==='book') foot.appendChild(h('span.chip.ok.hc-st',{},icon('book',14),'من الكتاب'));
  else if(m.st==='general') foot.appendChild(h('span.chip.doubt.hc-st',{},icon('info',14),'معرفة طبية عامة'));
  if(foot.firstChild) b.appendChild(foot);
  if(m.st==='book'&&m.ss&&m.ss.length) b.appendChild(srcList(m.ss));
  return h('div.hc-m.a',{},h('span.hc-av',{html:IM.horus({badge:true,size:28})}),b);
}
var SUGG=['اشرحلي مراحل glycolysis','إيه أنواع الـ epithelium؟','إيه عضلات الـ rotator cuff؟','فكّرني بقانون Frank-Starling'];
function emptyEl(){
  return h('div.hc-empty',{},
    h('span.hc-empty-i',{html:IM.horus({badge:true,size:64,state:'idle'})}),
    h('h3.display',{text:'أنا حورس'}),
    h('p.muted',{text:'اسألني عن أي نقطة في المنهج. بدوّر في كتب الأقسام الأول، ولو الموضوع مش موجود فيها هقولك صراحةً إن الشرح من المعرفة الطبية العامة.'}),
    h('div.hc-sug',{},SUGG.map(function(t){ return h('button.hc-chip.sug',{type:'button',onclick:function(){ if(P.ta.disabled) return; P.ta.value=t; grow(); P.ta.focus(); }},t); })),
    h('p.hc-fine',{text:'فيه حد يومي لعدد الأسئلة لكل طالب. لو سؤالك اتسأل قبل كده بنفس الصياغة بيتجاوب من الكاش من غير ما يتحسب من حدّك.'}));
}
function gateEl(){
  var b=h('button.btn.primary',{type:'button',onclick:function(){ b.disabled=true; IM.cloudSignIn().then(null,function(){ b.disabled=false; IM.toast('تعذّر فتح تسجيل الدخول. جرّب تاني.',{kind:'bad'}); }); }},'دخول بجوجل');
  return h('div.hc-empty.gate',{},
    h('span.hc-empty-i',{html:IM.horus({badge:true,size:64,state:'idle'})}),
    h('h3.display',{text:'سجّل دخولك الأول'}),
    h('p.muted',{text:'حورس بيشتغل بحسابك على جوجل: عشان نحسب الحد اليومي لكل طالب ونحفظلك محادثتك وتظهرلك على أي جهاز.'}),
    b,
    h('p.hc-fine',{},'أسئلتك بتتحفظ على حسابك وبتتبعت للذكاء الاصطناعي من غير اسمك أو إيميلك. ',h('a',{href:'privacy.html',target:'_blank',rel:'noopener'},'التفاصيل في صفحة الخصوصية')));
}
function renderAll(){
  if(!P) return;
  loadH(); IM.clear(P.body);
  if(!signedIn()){ P.body.appendChild(gateEl()); }
  else if(!Hs.msgs.length){ P.body.appendChild(emptyEl()); }
  else Hs.msgs.forEach(function(m){ P.body.appendChild(msgEl(m)); });
  setLeft(); setComposer(); scrollEnd();
}

/* ---------- إرسال ---------- */
var ERR={
  auth:'جلستك انتهت. سجّل دخولك بجوجل تاني وكمّل.',
  slow:'بتسأل بسرعة شوية. استنى ثواني وجرّب تاني.',
  busy:'حورس عليه ضغط دلوقتي. جرّب بعد شوية، وسؤالك مااتحسبش من حدّك.',
  off:'حورس واقف مؤقتًا. جرّب تاني بعدين.',
  ai:'الذكاء الاصطناعي مردّش المرة دي. جرّب تاني، وسؤالك مااتحسبش من حدّك.',
  ai_key:'الذكاء الاصطناعي مردّش المرة دي. جرّب تاني بعد شوية، وسؤالك مااتحسبش من حدّك.',
  svc:'حورس مش جاهز دلوقتي أو فيه مشكلة في الخدمة. جرّب بعد شوية.',
  bad:'السؤال طويل أو مش واضح. اكتبه أقصر وجرّب تاني.',
  net:'مفيش اتصال بالنت دلوقتي، أو الرد اتأخر. جرّب تاني.'
};
function api(body){
  return IM.cloudFn('POST','',{body:body,timeout:90000}).then(function(r){
    var j=r.json||{};
    if(r.ok&&j.ok) return j;
    var e=new Error('horus'); e.j=j; e.code=j.err||(r.status===401?'auth':(r.status===429?'slow':'svc')); throw e;
  },function(e){ if(e&&e.auth) e.code='auth'; else if(!e.code) e.code='net'; throw e; });
}
function errRow(code,j){
  var t=ERR[code]||ERR.svc;
  if(code==='limit') t='خلّصت أسئلتك النهاردة'+(j&&j.lim?(' ('+j.lim+')'):'')+'. بتتجدد الساعة 12 بالليل بتوقيت القاهرة.';
  var row=h('div.hc-err',{role:'alert'},icon('warn',16),h('span',{text:t}));
  if(code==='auth') row.appendChild(h('button.btn.sm',{type:'button',onclick:function(){ IM.cloudSignIn(); }},'دخول بجوجل'));
  return row;
}
function thinkEl(txt){
  return h('div.hc-m.a.hc-think',{},h('span.hc-av',{html:IM.horus({badge:true,size:28,state:'think'})}),h('div.hc-bub',{},h('span',{text:txt||'حورس بيدوّر في الكتاب…'})));
}
function histFor(){
  var a=Hs.msgs.filter(function(m){ return !m.qid&&m.t; }).slice(-4);
  return a.map(function(m){ return {r:m.r,t:m.t.slice(0,700)}; });
}
function qBody(Q){
  return {mode:'q',q:{id:String(Q.id),stem:Q.stem,opts:Q.opts.map(function(o){ return {o:o.o,t:o.t}; }),keys:Q.keys.slice(),sid:Q.sid||sid}};
}
function submit(){
  var t=P&&P.ta.value.trim(); if(!t) return;
  send(t,null);
}
/* text: سؤال حر. Q: سؤال من الموقع (زرار «اسأل حورس» في شاشة السؤال) */
function send(text,Q){
  if(busy||!P) return;
  if(anyExam()){ lockToast(); return; }
  if(!signedIn()){ renderAll(); return; }
  if(left===0){ renderAll(); return; }
  loadH();
  var old=P.body.querySelector('.hc-err'); if(old) old.remove();
  var emp=P.body.querySelector('.hc-empty'); if(emp) emp.remove();
  var body, ut;
  if(Q){
    var short=String(Q.stem||'').replace(/\s+/g,' ').trim(); if(short.length>150) short=short.slice(0,150)+'…';
    ut='اشرحلي السؤال ده: «'+short+'»';
    body=qBody(Q);
  } else { ut=text.slice(0,1000); body={mode:'chat',text:ut,sid:sid,hist:histFor()}; }
  var um=clean({i:nid(),r:'u',t:ut,ts:Date.now(),sid:Q?undefined:sid,qid:Q?String(Q.id):undefined,qh:Q&&IM.aiHash?IM.aiHash(Q):undefined});
  Hs.msgs.push(um); capH(); saveH();
  P.body.appendChild(msgEl(um));
  var th=thinkEl(Q?'حورس بيراجع السؤال على الكتاب…':null); P.body.appendChild(th); scrollEnd();
  if(!Q){ P.ta.value=''; grow(); }
  busy=true; setComposer();
  api(body).then(function(j){
    th.remove();
    var am={i:nid(),r:'a',t:String(j.a||''),ts:Math.max(Date.now(),um.ts+1),st:j.st,ss:j.ss,ca:j.ca,kd:j.kd,qid:Q?String(Q.id):undefined,qh:um.qh,ky:Q?Q.keys.slice():undefined};
    if(!am.t) throw Object.assign(new Error('empty'),{code:'ai'});
    Hs.msgs.push(clean(am)); capH(); saveH(); scheduleSync(2500);
    var el=msgEl(clean(am)); P.body.appendChild(el);
    if(j.left!=null) left=+j.left; if(j.lim!=null) lim=+j.lim;
    busy=false; setLeft(); setComposer();
    if(j.st!=='off') { var svg=el.querySelector('.hc-av svg'); if(svg&&IM.horusState) IM.horusState(svg,'found'); }
    P.body.scrollTop=Math.max(0,el.offsetTop-12);
    if(P.ta&&!P.ta.disabled) P.ta.focus({preventScroll:true});
  }).catch(function(e){
    th.remove(); busy=false;
    var code=(e&&e.code)||'svc', j=e&&e.j;
    dropMsg(um.i); var ue=P.body.lastElementChild; if(ue&&ue.classList.contains('u')) ue.remove();
    if(!Q&&P.ta) { P.ta.value=ut; grow(); }
    if(code==='limit'){ left=0; if(j&&j.lim!=null) lim=+j.lim; }
    if(code==='ai_key') code='ai';
    if(['auth','limit','slow','busy','off','ai','bad','net'].indexOf(code)<0) code='svc';
    P.body.appendChild(errRow(code,j)); setLeft(); setComposer(); scrollEnd();
  });
}
function refreshMe(){
  if(!signedIn()) return;
  IM.cloudFn('GET','?me=1',{timeout:15000}).then(function(r){
    var j=r.json||{};
    if(r.ok&&j.ok){ left=+j.left; lim=+j.lim; setLeft(); setComposer(); }
  },function(){});
}
function clearChat(){
  loadH(); Hs.msgs=[]; Hs.clr=Date.now(); saveH(); scheduleSync(300); renderAll();
  IM.toast('اتمسحت المحادثة من حسابك.',{icon:'trash'});
}

/* ---------- فتح وقفل (مع الأنيميشن) ---------- */
function clearTimers(){ clearTimeout(openT); clearTimeout(closeT); openT=closeT=null; }
function open(after){
  if(!on()) return;
  if(anyExam()){ lockToast(); return; }
  if(st==='open'||st==='opening'){ if(after) after(); return; }
  if(st==='closing') finishClose(true);
  build(); loadH(); renderAll();
  afterFn=after||null;
  var anim=!motionOff();
  P.root.hidden=false; P.root.className='hc '+(anim?'is-opening':'is-open'); st=anim?'opening':'open';
  if(fab){ fab.hidden=true; fab.setAttribute('aria-expanded','true'); }
  if(anim){
    var k=played++?0.55:1; P.root.style.setProperty('--k',String(k));
    cur=h('div.hc-cur.in',{title:'اضغط للتخطّي',onclick:endOpen},emblem(),h('p.hc-cur-t',{},h('b',{text:'حورس'}),h('span',{text:'مساعد المذاكرة'})));
    P.root.appendChild(cur);
    openT=setTimeout(function(){ if(cur) cur.classList.add('fade'); openT=setTimeout(endOpen,360*k); },2500*k);
  } else endOpen();
  syncNow().then(function(){ if(P&&st!=='closed') renderAll(); });
  refreshMe();
}
function endOpen(){
  if(st!=='opening'&&st!=='open') return;
  clearTimers();
  if(cur){ cur.remove(); cur=null; }
  st='open'; P.root.className='hc is-open';
  var f=afterFn; afterFn=null;
  if(f) f(); else if(P.ta&&!P.ta.disabled) { try{ P.ta.focus({preventScroll:true}); }catch(e){} }
  scrollEnd();
}
function close(instant){
  if(st==='closed'||st==='closing') return;
  clearTimers(); afterFn=null;
  if(cur){ cur.remove(); cur=null; }
  if(instant||motionOff()){ finishClose(); return; }
  st='closing'; var k=0.55; P.root.style.setProperty('--k',String(k)); P.root.className='hc is-closing';
  cur=h('div.hc-cur.out',{},emblem(),h('p.hc-cur-t',{},h('b',{text:'حورس'}),h('span',{text:'مساعد المذاكرة'})));
  P.root.appendChild(cur);
  closeT=setTimeout(function(){ P.root.classList.add('shrink'); closeT=setTimeout(function(){ finishClose(); },300*k+40); },1600*k);
}
function finishClose(){
  clearTimers();
  if(cur){ cur.remove(); cur=null; }
  var had=P&&P.root.contains(document.activeElement);
  if(P){ P.root.hidden=true; P.root.className='hc'; }
  st='closed';
  if(fab){ fab.setAttribute('aria-expanded','false'); }
  fabState();
  if(had&&fab&&!fab.hidden){ try{ fab.focus({preventScroll:true}); }catch(e){} }
}

/* ---------- «اسأل حورس» من شاشة السؤال ---------- */
function askQ(Q){
  if(!on()) return;
  if(anyExam()||IM.examOpen(Q.id)){ lockToast(); return; }
  open(function(){
    loadH();
    var qh=IM.aiHash?IM.aiHash(Q):'';
    var prev=Hs.msgs.filter(function(m){ return m.r==='a'&&m.qid===String(Q.id)&&m.qh===qh; }).pop();
    if(prev&&P){                                   /* اتسأل قبل كده: بنوريه الإجابة اللي عندنا من غير طلب جديد */
      var els=IM.$$('.hc-m.a',P.body), idx=Hs.msgs.filter(function(m){ return m.r==='a'; }).indexOf(prev);
      var el=els[idx]; if(el) P.body.scrollTop=Math.max(0,el.offsetTop-12);
      return;
    }
    send(null,Q);
  });
}

IM.horusChat={
  on:on,
  open:function(){ open(); },
  close:function(){ close(); },
  askQ:askQ,
  anyExam:anyExam,
  state:function(){ return st; },
  left:function(){ return left; }
};

/* ---------- ربط ---------- */
function boot(){ fabState(); }
window.addEventListener('hashchange',fabState);
window.addEventListener('storage',function(e){ if(!e.key||e.key.indexOf('sess')>-1||e.key.indexOf('im_')===0) fabState(); });
IM.on('cloud',function(){ var u=uid(); if(Hs.uid&&Hs.uid!==u){ Hs=H0; } fabState(); if(P&&st!=='closed'){ renderAll(); refreshMe(); syncNow(); } });
IM.on('bank',boot);
if(IM.bank&&IM.bank.ready) boot();
document.addEventListener('visibilitychange',function(){ if(!document.hidden) fabState(); });
document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&(st==='open'||st==='opening')&&!e.defaultPrevented&&!document.querySelector('.ov')) close(); });
})();
