/* Imhotep · إمحتب — لوحة الشرف (اختيارية بالكامل).
   مقفولة لحد ما يتحط رابط Google Apps Script في js/board-config.js. الطالب بيشترك بإرادته، وبياخد رقم تسلسلي (IMH-000241)،
   وبيتبعت مؤشره ونقاطه ومرحلته بس. الإجابات والصورة والواتساب ما بتتبعتش. الكود التاني في tools/leaderboard/Code.gs. */
(function(){
'use strict';
var IM=window.IM, h=IM.h, icon=IM.icon, KEY='im_board';
var MIN_JOIN=20;          /* أقل عدد أسئلة للاشتراك */
var GAP=120000;           /* أقل فاصل بين إرسالين تلقائيين */

function url(){ return String(IM.BOARD_URL||'').trim(); }
IM.boardOn=function(){ var u=url(); return /^https:\/\/script\.google\.com\/.+\/exec$/.test(u)||/^http:\/\/127\.0\.0\.1:\d+\/exec$/.test(u); };
var B=IM.store.get(KEY,{}); if(!B||typeof B!=='object') B={};
function save(){ IM.store.set(KEY,B); }
IM.boardJoined=function(){ return !!(B.serial&&B.token&&!B.lost); };
IM.boardSerial=function(){ return IM.boardJoined()?B.serial:''; };
if(!IM.boardOn()) return;            /* من هنا ورايح كله مش بيتنفّذ من غير رابط */

function nf(n){ return Number(n).toLocaleString('en-US'); }
function answered(){ return Object.keys(IM.st.ans).length; }
function attempts(){ var t=0, a=IM.st.ans; for(var k in a){ t+=(a[k]&&a[k].n)|0; } return t; }      /* كل إجابة بتزوّده، فمابيقلش أبدًا على نفس الجهاز */
function stats(){ try{ var L=IM.level(); return {tier:IM.st.carto.tier||0,idx:L.idx|0,xp:L.xp|0,n:answered(),att:attempts()}; }catch(e){ return null; } }
function newDev(){ var a=new Uint8Array(12); try{ crypto.getRandomValues(a); }catch(e){ for(var i=0;i<12;i++) a[i]=Math.floor(Math.random()*256); } var s='d'; for(var j=0;j<a.length;j++) s+=('0'+a[j].toString(16)).slice(-2); return s; }

/* ---------- الشبكة: GET للقراية وPOST نص عادي (من غير preflight) ---------- */
function net(method,payload,keep){
  var u=url(), ctl=('AbortController' in window)?new AbortController():null, t=ctl?setTimeout(function(){ ctl.abort(); },20000):0;
  var o={method:method,cache:'no-store'};
  if(ctl) o.signal=ctl.signal;
  if(method==='POST'){ o.headers={'Content-Type':'text/plain;charset=utf-8'}; o.body=JSON.stringify(payload); if(keep) o.keepalive=true; }
  var target=method==='GET'?u+(u.indexOf('?')>-1?'&':'?')+payload:u;
  return fetch(target,o).then(function(r){ if(t) clearTimeout(t); if(!r.ok) throw new Error('http'); return r.json(); },function(e){ if(t) clearTimeout(t); throw e; });
}

/* ---------- الاشتراك والتحديث ---------- */
IM.boardJoin=function(name){
  var s=stats(); if(!s) return Promise.reject(new Error('not-ready'));
  if(!B.dev){ B.dev=newDev(); save(); }
  return net('POST',{a:'join',dev:B.dev,name:name,tier:s.tier,idx:s.idx,xp:s.xp,n:s.n,att:s.att}).then(function(r){
    if(!r||!r.ok) throw new Error((r&&r.err)||'fail');
    B.serial=r.serial; B.token=r.token; B.name=r.name; B.at=Date.now(); B.sent=s; B.lost=0; B.err=0; save(); IM.emit('board'); return r;
  });
};
var busy=false, timer=null;
/* الجهاز ده أقدم من اللي في اللوحة؟ نفس قاعدة السيرفر بالظبط: عدد الأسئلة الأقل، أو نفس العدد ومحاولات أقل */
function behind(s){ var c=B.stale&&B.stale.cur; if(!c||!s) return false; return s.n<(c.n|0)||(s.n===(c.n|0)&&(c.att|0)>0&&s.att<(c.att|0)); }
IM.boardBehind=function(){ return IM.boardJoined()&&behind(stats()); };
function dirty(){ if(!IM.boardJoined()) return false; var s=stats(), o=B.sent||{}; return !!s&&!behind(s)&&(s.idx!==o.idx||s.xp!==o.xp||s.n!==o.n||s.tier!==o.tier); }
function schedule(ms){ if(timer) return; timer=setTimeout(function(){ timer=null; IM.boardPush(false); },ms); }
function soon(ms){ clearTimeout(timer); timer=null; schedule(ms); }
IM.boardPush=function(force,keep,newName){
  if(!IM.boardJoined()||busy||navigator.onLine===false) return Promise.resolve(null);
  if(!force&&!dirty()) return Promise.resolve(null);
  var s=stats(); if(!s) return Promise.resolve(null);
  if(behind(s)) return Promise.resolve({ok:0,err:'stale',cur:B.stale.cur,local:1});      /* جهاز متأخر: مانبعتش حاجة تنزّل اللوحة */
  busy=true;
  var pl={a:'up',s:B.serial,t:B.token,name:newName||B.name,tier:s.tier,idx:s.idx,xp:s.xp,n:s.n,att:s.att};
  return net('POST',pl,keep).then(function(r){
    busy=false; if(!r) return null;
    if(r.ok&&!r.throttled){ B.sent=s; B.at=Date.now(); B.err=0; delete B.stale; if(newName) B.name=newName; if(r.rank!=null) B.rank={idx:r.rank,xp:r.rankXp,total:r.total}; save(); IM.emit('board'); }
    else if(r.err==='stale'){ B.stale={cur:r.cur||{},at:Date.now()}; B.err=0; save(); IM.emit('board'); }
    else if(r.ok&&r.throttled){ schedule(20000); }
    else if(r.err==='auth'||r.err==='gone'){ B.lost=1; save(); IM.emit('board'); }
    else { B.sent=s; B.err=r.err||'fail'; save(); IM.emit('board'); }          /* قيم مرفوضة: ما نكرّرش لحد ما الأرقام تتغيّر */
    return r;
  },function(){ busy=false; B.err='net'; save(); schedule(5*60000); return null; });
};
IM.boardLeave=function(){
  var s=B.serial, t=B.token; if(!s||!t||B.lost){ B={dev:B.dev}; save(); IM.emit('board'); return Promise.resolve({ok:1}); }
  return net('POST',{a:'del',s:s,t:t}).then(function(r){
    if(r&&(r.ok||r.err==='auth'||r.err==='gone')){ B={dev:B.dev}; save(); IM.emit('board'); return r; }
    throw new Error((r&&r.err)||'fail');
  });
};
var cache={};
IM.boardLoad=function(by,force){
  by=by==='xp'?'xp':'idx'; var c=cache[by];
  if(!force&&c&&Date.now()-c.at<60000) return Promise.resolve(c.data);
  return net('GET','a=board&n=50&by='+by).then(function(r){ if(!r||!r.ok) throw new Error('fail'); cache[by]={at:Date.now(),data:r}; return r; });
};
function loadRank(){
  if(!IM.boardJoined()) return Promise.resolve();
  var q=function(by){ return net('GET','a=rank&by='+by+'&s='+encodeURIComponent(B.serial)); };
  return Promise.all([q('idx'),q('xp')]).then(function(a){ if(a[0]&&a[0].ok&&a[1]&&a[1].ok){ B.rank={idx:a[0].rank,xp:a[1].rank,total:a[0].total}; var me=a[0].me, s=stats(); if(me&&s){ B.stale={cur:me,at:Date.now()}; if(!behind(s)) delete B.stale; } save(); } }).catch(function(){});
}

/* مواعيد الإرسال التلقائي: بعد الإجابات بهدوء، فورًا لما المرحلة تتغيّر، وعند ترك الصفحة */
IM.on('answer',function(){ if(IM.boardJoined()) schedule(Math.max(5000,(B.at||0)+GAP-Date.now())); });
IM.on('carto',function(){ if(IM.boardJoined()) soon(3000); });
document.addEventListener('visibilitychange',function(){ if(document.visibilityState==='hidden'&&dirty()&&Date.now()-(B.at||0)>30000) IM.boardPush(false,true); });
setTimeout(function(){ if(dirty()) IM.boardPush(false); },8000);

/* تصفير التقدّم بيشيل الطالب من اللوحة كمان، والتصدير/الاستيراد بيحافظوا على رقمه */
var _reset=IM.resetAll; IM.resetAll=function(){ if(IM.boardJoined()){ try{ net('POST',{a:'del',s:B.serial,t:B.token},true).catch(function(){}); }catch(e){} } _reset(); };
var _exp=IM.exportAll; IM.exportAll=function(){ var s=_exp(); if(!IM.boardJoined()) return s; try{ var o=JSON.parse(s); o.board={serial:B.serial,token:B.token,name:B.name,dev:B.dev}; return JSON.stringify(o); }catch(e){ return s; } };
var _imp=IM.importAll; IM.importAll=function(text){ var r=_imp(text); try{ if(r&&r.ok&&IM.boardJoined()){ delete B.stale; B.sent=null; save(); IM.emit('board'); soon(3000); } var o=JSON.parse(text); if(r&&r.ok&&o&&o.board&&o.board.serial&&o.board.token&&!IM.boardJoined()){ B.serial=String(o.board.serial); B.token=String(o.board.token); B.name=String(o.board.name||''); B.dev=String(o.board.dev||B.dev||newDev()); B.lost=0; B.sent=null; save(); IM.emit('board'); soon(5000); } }catch(e){} return r; };

/* ---------- إعلان لوحة الشرف: كبير، ومرة واحدة لكل طالب ----------
   القدامى: أول دخول بعد التحديث. الجُدد: أول ما الجولة تخلص (أو تتخطّى). ما بيظهرش لو الطالب مشترك أصلًا،
   وما بيقاطعش لفافة ولا جولة ولا شاشة احتفال. العلامة بتتسجّل أول ما يظهر (im_seen → ann-honor-1). */
var ANN='ann-honor-1', ANN_READY='ann-honor-ready';
function annSeen(k){ return !!IM.st.seen[k||ANN]; }
function annMark(k){ IM.st.seen[k||ANN]=Date.now(); try{ IM.save('seen'); }catch(e){} }
function joinErr(e){ var m=String(e&&e.message||e); return /bad-stats/.test(m)?'الأرقام اللي عندك مش مقبولة. جاوب شوية أسئلة وجرّب تاني.':'تعذّر الاتصال باللوحة. اتأكد من النت وجرّب تاني.'; }

IM.boardAnnounce=function(){
  if(document.querySelector('.ov')) return null;
  var n=answered(), can=n>=MIN_JOIN, dlg=null;
  var nameIn=h('input.field-i',{type:'text',maxlength:20,value:((IM.st.user&&IM.st.user.name)||'').slice(0,20),placeholder:'اسم الظهور','aria-label':'اسم الظهور'});
  var msg=h('p.g-msg',{hidden:true});
  function close(){ if(dlg) dlg.close(); }

  var art=h('div.ann-art',{'aria-hidden':'true'},h('span.ann-ring'),h('span.ann-ic',{},icon('award',38)));
  var intro=[
    art,
    h('div.ann-eb',{text:'جديد في إمحتب'}),
    h('h3.display.ann-h',{text:'اسمك يستاهل يبقى في لوحة الشرف'}),
    h('p.ann-p',{text:'المذاكرة أحلى لما تشوف نفسك بتتقدّم. اشترك وشوف ترتيبك بين زمايلك بمؤشر إمحتب من 100، وكل سؤال بتثبّته وكل لفافة بتحلّها بتطلّعك خطوة.'}),
    h('ul.ann-ul',{},
      h('li',{},icon('check',16),h('span',{text:'ترتيبك بيتحدّث لوحده وانت بتذاكر، من غير ما تعمل حاجة.'})),
      h('li',{},icon('check',16),h('span',{text:'بتاخد رقم تسلسلي رسمي (زي IMH-000241) بيظهر على خرطوشتك.'})),
      h('li',{},icon('check',16),h('span',{text:'اختياري تمامًا. مفيش إجابات ولا واتساب ولا صور بتظهر، وتقدر تلغي اشتراكك في أي وقت.'})))
  ];
  var form;
  if(can){
    form=h('div.ann-f',{},h('label.label',{text:'اسم الظهور (لحد 20 حرف)'}),nameIn,h('p.muted.ann-hint',{text:'ده الاسم اللي زمايلك هيشوفوه في اللوحة.'}),msg);
  }else{
    form=h('div.ann-f',{},
      h('div.ann-pg',{'aria-hidden':'true'},h('i',{style:'width:'+Math.max(3,Math.round(n/MIN_JOIN*100))+'%'})),
      h('p.ann-need',{},h('b',{text:'جاوبت '+n+' من '+MIN_JOIN+' سؤال. '}),'أول ما توصل لـ'+MIN_JOIN+' سؤال بيتفتح لك الاشتراك، وهنبلّغك لوحدنا.'));
  }
  var body=can?h('div.ann',{},intro,form):h('div.ann',{},intro.slice(0,4),form,intro[4]);      /* قبل 20 سؤال: التقدّم فوق عشان يبان على الجوال */

  var join=h('button.btn.primary.lg',{type:'button',onclick:function(){
    var nm=nameIn.value.trim(); if(!nm){ msg.hidden=false; msg.textContent='اكتب اسم الظهور.'; try{ nameIn.focus(); }catch(e){} return; }
    if(join.disabled) return; join.disabled=true; msg.hidden=true;
    IM.boardJoin(nm).then(function(r){
      IM.toast('اتسجّلت برقم '+r.serial+'.',{icon:'check'});
      IM.clear(body);
      body.appendChild(h('div.ann-ok',{},h('div.ann-art',{'aria-hidden':'true'},h('span.ann-ring'),h('span.ann-ic.ok',{},icon('check',38))),
        h('h3.display.ann-h',{text:'اتسجّلت في لوحة الشرف'}),
        h('div.ann-sn.mono',{dir:'ltr',text:r.serial}),
        h('p.ann-p',{text:'رقمك ظهر على خرطوشتك. ترتيبك هيظهر بعد ما أرقامك تتحدّث، فكمّل مذاكرة وشوف نفسك بتطلع.'})));
      var f=dlg&&dlg.box.querySelector('.dlg-f'); if(f){ IM.clear(f);
        f.appendChild(h('button.btn.primary.lg',{type:'button',onclick:function(){ close(); IM.go('#/honor'); }},icon('award',18),'افتح لوحة الشرف'));
        f.appendChild(h('button.btn.ghost',{type:'button',onclick:close},'تمام')); }
    },function(e){ join.disabled=false; msg.hidden=false; msg.textContent=joinErr(e); });
  }},icon('award',18),'فعّل الاشتراك');
  var go=h('button.btn.primary.lg',{type:'button',onclick:function(){ close(); IM.go('#/train'); }},icon('play',18),'ابدأ أول لفافة');
  var later=h('button.btn.ghost',{type:'button',onclick:close},can?'مش دلوقتي':'ماشي');
  var more=h('a.ann-more',{href:'#/honor',onclick:function(){ close(); }},'اعرف أكتر عن لوحة الشرف');

  annMark(); if(can) annMark(ANN_READY);      /* اللي ماوصلش 20 سؤال بنبلّغه أول ما يوصل (تحت) */
  dlg=IM.modal({title:'لوحة الشرف',cls:'dlg-ann',body:body,foot:[can?join:go,later,more],focus:'.dlg-f .btn.primary'});
  return dlg;
};

/* بيستنى لحد ما يبقى الوقت مناسب: مفيش لفافة ولا جولة ولا نافذة مفتوحة ولا شاشة الاسم */
function annClear(){
  var top=String(location.hash||'').replace(/^#\/?/,'').split('/')[0];
  if(top==='run'||top==='result') return false;
  if(!IM.st.seen['tour-v1']) return false;                        /* الجولة لسه ماخلصتش (جديد) */
  if(document.querySelector('.ov,.tour-root')) return false;
  var g=document.getElementById('gate'); if(g&&!g.hidden) return false;
  return document.visibilityState!=='hidden';
}
IM.boardAnnounceMaybe=function(){
  if(annSeen()) return;
  var iv=setInterval(function(){
    if(annSeen()){ clearInterval(iv); return; }
    if(!annClear()) return;
    clearInterval(iv);
    if(IM.boardJoined()){ annMark(); annMark(ANN_READY); return; }      /* مشترك أصلًا */
    IM.boardAnnounce();
  },1200);
};
/* اللي شاف الإعلان قبل 20 سؤال: أول ما يوصل 20 بيتبلّغ مرة واحدة (الجرس + رسالة صغيرة) */
IM.on('answer',function(){
  if(!annSeen()||annSeen(ANN_READY)||IM.boardJoined()||answered()<MIN_JOIN) return;
  annMark(ANN_READY);
  IM.notify({id:'honor-ready',icon:'award',title:'اتفتح لك الاشتراك في لوحة الشرف',text:'وصلت لـ'+MIN_JOIN+' سؤال. تقدر دلوقتي تشترك وتشوف ترتيبك بين زمايلك.',link:{label:'اشترك',hash:'#/honor'}});
  var top=String(location.hash||'').replace(/^#\/?/,'').split('/')[0];
  if(top!=='run') IM.toast('وصلت لـ'+MIN_JOIN+' سؤال. اتفتح لك الاشتراك في لوحة الشرف.',{icon:'award',ms:7000,action:{label:'اشترك',fn:function(){ IM.go('#/honor'); }}});
});

/* ---------- الإشعار ونقط الدخول ---------- */
if(IM.UPDATES) IM.UPDATES.unshift({id:'honor',date:'2026-11-07',icon:'award',title:'لوحة الشرف',text:'اشترك بإرادتك وشوف ترتيبك بين زمايلك بمؤشر إمحتب والنقاط، وخد رقمك التسلسلي على خرطوشتك.',link:{label:'افتح لوحة الشرف',hash:'#/honor'}});

IM.boardCard=function(){
  var j=IM.boardJoined(), rk=B.rank;
  return h('a.card.hb-entry',{href:'#/honor'},icon('award',24),
    h('div.hb-et',{},h('b.display',{text:'لوحة الشرف'}),h('span.muted',{text:j?(IM.boardBehind()?'جهازك متأخر عن اللوحة. افتح للتفاصيل · '+B.serial:('ترتيبك '+(rk&&rk.idx?rk.idx+' من '+rk.total:'بيتحدّث')+' · '+B.serial)):'اشترك واعرف ترتيبك بين زمايلك'})),
    icon('next',18));
};
IM.boardSetting=function(onGo){
  var j=IM.boardJoined();
  return h('a.cp-mini',{href:'#/honor',onclick:function(){ if(onGo) onGo(); }},icon('award',34),
    h('div',{},h('b',{text:'لوحة الشرف'}),h('span.muted',{text:j?' '+B.serial:' اختيارية'}),h('span.cp-go',{},j?'شوف ترتيبك':'اشترك',icon('next',14))));
};

/* ---------- صفحة لوحة الشرف ---------- */
IM.screens.honor=function(view){
  var wrap=h('div.hb'); view.appendChild(wrap);
  var by='idx', dead=false, rename=false, state={loading:true,err:false,data:null};
  var meBox=h('div'), listBox=h('div');
  wrap.appendChild(h('div.pg-h',{},h('div',{},IM.eyebrow('المقام'),h('h1.display',{text:'لوحة الشرف'})),h('p.muted',{text:'ترتيب الطلبة المشتركين بمؤشر إمحتب والنقاط. الاشتراك بإرادتك، وتقدر تلغيه في أي وقت.'})));
  wrap.appendChild(meBox); wrap.appendChild(listBox);
  wrap.appendChild(h('p.muted.hb-note',{text:'الأرقام بتتبعت من جهاز كل طالب، فاللوحة للتشجيع مش امتحان رسمي. اللي بيظهر: اسم الظهور والمرحلة والمؤشر والنقاط وعدد الأسئلة والرقم التسلسلي. مفيش إجابات ولا واتساب ولا صور.'}));

  function defName(){ var n=(IM.st.user&&IM.st.user.name)||''; return n.slice(0,20); }
  function errText(e){ var m=String(e&&e.message||e); if(/bad-stats/.test(m)) return 'الأرقام اللي عندك مش مقبولة. جاوب شوية أسئلة وجرّب تاني.'; return 'تعذّر الاتصال باللوحة. اتأكد من النت وجرّب تاني.'; }

  function joinCard(){
    var n=answered(), ready=n>=MIN_JOIN, busyJ=false;
    var nameIn=h('input.field-i',{type:'text',maxlength:20,value:defName(),placeholder:'اسم الظهور','aria-label':'اسم الظهور'});
    var msg=h('p.g-msg',{hidden:true});
    var btn=h('button.btn.primary.lg',{type:'button',disabled:!ready,onclick:function(){
      if(busyJ) return; var nm=nameIn.value.trim(); if(!nm){ msg.hidden=false; msg.textContent='اكتب اسم الظهور.'; return; }
      busyJ=true; btn.disabled=true; msg.hidden=true;
      IM.boardJoin(nm).then(function(r){ IM.toast('اتسجّلت برقم '+r.serial+'.',{icon:'check'}); draw(); loadAll(true); },function(e){ busyJ=false; btn.disabled=false; msg.hidden=false; msg.textContent=errText(e); });
    }},icon('award',18),'اشترك في لوحة الشرف');
    return h('section.card.hb-join',{},
      h('h2.display',{text:'اشترك في لوحة الشرف'}),
      h('p.muted',{text:'اختياري تمامًا. لو اشتركت بتاخد رقم تسلسلي رسمي (زي IMH-000241) بيظهر على خرطوشتك، وبيظهر اسمك ومرحلتك ومؤشرك ونقاطك لباقي المشتركين.'}),
      h('ul.hb-ul',{},h('li',{text:'مش هيظهر: إجاباتك، رقم الواتساب، صورتك، إيميلك.'}),h('li',{text:'تقدر تلغي اشتراكك وقت ما تحب وبيتمسح صفك من اللوحة.'}),h('li',{text:'بتتحدّث أرقامك لوحدها وانت بتذاكر.'})),
      h('label.label',{text:'اسم الظهور (لحد 20 حرف)'}),nameIn,
      ready?null:h('p.muted',{text:'جاوب '+MIN_JOIN+' سؤال على الأقل الأول (فاضل '+(MIN_JOIN-n)+').'}),
      msg,btn);
  }
  function staleNote(){
    var c=B.stale&&B.stale.cur, s=stats(); if(!c||!s||!behind(s)) return null;
    var imp=h('input',{type:'file',accept:'application/json,.json',hidden:true,onchange:function(){ var f=imp.files&&imp.files[0]; if(!f) return; var r=new FileReader();
      r.onload=function(){ var res=IM.importAll(String(r.result)); IM.toast(res.msg,{kind:res.ok?'':'bad',icon:res.ok?'check':'warn'}); setTimeout(function(){ if(!dead){ loadAll(true); draw(); } },3800); }; r.readAsText(f); imp.value=''; }});
    return h('div.hb-stale',{role:'note'},icon('flag',22),h('div',{},
      h('b',{text:'اللوحة فيها أرقام أحدث من الجهاز ده'}),
      h('p',{text:'في اللوحة: مؤشر '+(c.idx|0)+' و'+(c.n|0)+' سؤال. على الجهاز ده: مؤشر '+s.idx+' و'+s.n+' سؤال. غالبًا كنت بتذاكر من لينك أو جهاز تاني.'}),
      h('p',{text:'علشان صفك في اللوحة ما ينزلش، الجهاز ده مش هيبعت أرقام لحد ما يلحق. افتح اللينك اللي كنت بتذاكر عليه وصدّر تقدمك (الدايرة ← تصدير ملف)، وبعدين هنا دوس:'}),
      h('button.btn.sm.primary',{type:'button',onclick:function(){ imp.click(); }},icon('upload',16),'استيراد ملف'),imp));
  }
  function meCard(){
    var rk=B.rank||{}, st=B.err?(B.err==='net'?'مفيش اتصال دلوقتي. هنحاول تاني لوحدنا.':'آخر إرسال اترفض. أرقامك لسه محفوظة عندك.'):(B.at?'آخر تحديث '+IM.fmtDate(IM.dayKey(new Date(B.at)))+' '+new Date(B.at).toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'}):'');
    var box=h('section.card.hb-me',{});
    var top=h('div.hb-mh',{},h('div',{},h('b.display.hb-mn',{text:B.name||'—'}),h('span.muted',{text:' '+(IM.level?IM.level().idx:0)+' / 100'})),
      h('span.hb-serial',{},h('b.mono',{dir:'ltr',text:B.serial}),h('button.iconbtn.sm',{type:'button','aria-label':'انسخ الرقم',onclick:function(){ IM.copy(B.serial).then(function(){ IM.toast('اتنسخ الرقم.',{icon:'check'}); },function(){}); }},icon('link',16))));
    var nums=h('div.hb-rk',{},
      h('div',{},h('b.display',{text:rk.idx?String(rk.idx):'—'}),h('span.muted',{text:'ترتيبك بالمؤشر'})),
      h('div',{},h('b.display',{text:rk.xp?String(rk.xp):'—'}),h('span.muted',{text:'ترتيبك بالنقاط'})),
      h('div',{},h('b.display',{text:rk.total?String(rk.total):'—'}),h('span.muted',{text:'عدد المشتركين'})));
    var acts=h('div.hb-acts',{});
    if(rename){
      var ni=h('input.field-i',{type:'text',maxlength:20,value:B.name||'','aria-label':'اسم الظهور'});
      acts.appendChild(ni);
      acts.appendChild(h('button.btn.primary.sm',{type:'button',onclick:function(){ var v=ni.value.trim(); if(!v) return; IM.boardPush(true,false,v).then(function(r){ if(r&&r.ok&&!r.throttled){ rename=false; IM.toast('اتغيّر الاسم.',{icon:'check'}); loadAll(true); draw(); } else IM.toast(r&&r.throttled?'استنى شوية وجرّب تاني.':'تعذّر تغيير الاسم دلوقتي.',{kind:'bad'}); }); }},'حفظ'));
      acts.appendChild(h('button.btn.ghost.sm',{type:'button',onclick:function(){ rename=false; draw(); }},'إلغاء'));
    } else {
      acts.appendChild(h('button.btn.sm',{type:'button',onclick:function(){ var b=this; b.disabled=true; IM.boardPush(true).then(function(r){ b.disabled=false; if(r&&r.ok&&!r.throttled) IM.toast('اتحدّثت أرقامك.',{icon:'check'}); else if(r&&r.throttled) IM.toast('اتحدّثت من شوية. جرّب بعد لحظات.'); else if(r&&r.err==='stale') IM.toast('اللوحة فيها أرقام أحدث من الجهاز ده، فما اتحدّثتش.',{kind:'bad'}); else IM.toast('تعذّر التحديث دلوقتي.',{kind:'bad'}); loadAll(true); draw(); }); }},'حدّث دلوقتي'));
      acts.appendChild(h('button.btn.ghost.sm',{type:'button',onclick:function(){ rename=true; draw(); }},'غيّر الاسم'));
      acts.appendChild(IM.arm(h('button.btn.sm.danger',{type:'button'}),'إلغاء الاشتراك',function(){ IM.boardLeave().then(function(){ IM.toast('اتلغى اشتراكك واتمسح صفك من اللوحة.',{icon:'check'}); draw(); loadAll(true); },function(){ IM.toast('تعذّر الإلغاء دلوقتي، جرّب تاني.',{kind:'bad'}); }); },'اضغط مرة أخرى للتأكيد'));
    }
    box.appendChild(top); var sn=staleNote(); if(sn) box.appendChild(sn); box.appendChild(nums); if(B.rank&&B.rank.idx===0) box.appendChild(h('p.hb-st2.hb-hid',{text:'اسمك مش ظاهر في اللوحة دلوقتي. لو الاسم مش مناسب غيّره وجرّب تاني.'})); if(st) box.appendChild(h('p.muted.hb-st2',{text:st})); box.appendChild(acts);
    return box;
  }
  function lostCard(){
    return h('section.card.hb-join',{},h('h2.display',{text:'اشتراكك اتفصل عن اللوحة'}),h('p.muted',{text:'الرقم ده اتلغى أو اتمسح من اللوحة. تقدر تشترك من جديد وهتاخد رقم جديد.'}),
      h('button.btn.primary',{type:'button',onclick:function(){ B={dev:B.dev}; save(); IM.emit('board'); draw(); }},'اشترك من جديد'));
  }
  function draw(){
    if(dead) return; IM.clear(meBox);
    if(B.serial&&B.token&&B.lost) meBox.appendChild(lostCard());
    else meBox.appendChild(IM.boardJoined()?meCard():joinCard());
    drawList();
  }
  function drawList(){
    if(dead) return; IM.clear(listBox);
    var tabs=h('div.seg.hb-tabs',{role:'group','aria-label':'الترتيب حسب'});
    [['idx','بمؤشر إمحتب'],['xp','بالنقاط XP']].forEach(function(t){ tabs.appendChild(h('button',{type:'button','aria-pressed':String(by===t[0]),text:t[1],onclick:function(){ if(by===t[0]) return; by=t[0]; loadList(false); }})); });
    listBox.appendChild(h('div.hb-lh',{},h('h2.display',{text:'المتصدّرين'}),tabs));
    if(state.loading){ listBox.appendChild(h('p.muted.hb-msg',{text:'بنجيب اللوحة…'})); return; }
    if(state.err){ listBox.appendChild(h('div.card.hb-msg',{},h('p.muted',{text:'تعذّر تحميل اللوحة. اتأكد من النت وجرّب تاني.'}),h('button.btn.sm',{type:'button',onclick:function(){ loadList(true); }},'جرّب تاني'))); return; }
    var rows=state.data.rows||[];
    if(!rows.length){ listBox.appendChild(h('div.card.hb-msg',{},h('p.muted',{text:'لسه محدّش اشترك. كون أول واحد في اللوحة!'}))); return; }
    var ol=h('ol.hb-l',{});
    rows.forEach(function(r,i){
      var mine=IM.boardJoined()&&r.s===B.serial, st=r.tier?IM.stageName(IM.STAGES[r.tier-1]):'من غير خرطوشة';
      ol.appendChild(h('li.hb-r'+(mine?'.me':'')+(i<3?'.top.t'+(i+1):''),{},
        h('span.hb-n.mono',{text:String(i+1)}),
        h('span.hb-nm',{},h('b',{text:r.name||'—'}),mine?h('span.hb-you',{text:'أنت'}):null,h('span.muted.hb-sub',{text:st+' · '+nf(r.n)+' سؤال'})),
        h('span.hb-v',{},h('b.display',{text:by==='xp'?nf(r.xp):String(r.idx)}),h('span.muted',{text:by==='xp'?'XP':'/ 100'}))));
    });
    listBox.appendChild(ol);
    if(state.data.total>rows.length) listBox.appendChild(h('p.muted.hb-more',{text:'ظاهر أعلى '+rows.length+' من '+state.data.total+' مشترك.'}));
  }
  function loadList(force){
    state.loading=true; state.err=false; drawList();
    IM.boardLoad(by,force).then(function(d){ if(dead) return; state.loading=false; state.data=d; drawList(); },function(){ if(dead) return; state.loading=false; state.err=true; drawList(); });
  }
  function loadAll(force){ loadList(force); loadRank().then(function(){ if(!dead&&IM.boardJoined()&&!rename) draw(); }); }
  draw(); loadAll(false);
  /* لو في أرقام متغيّرة، ابعتها قبل ما نعرض الترتيب */
  IM.boardPush(false).then(function(r){ if(!dead&&r&&r.ok&&!r.throttled&&IM.boardJoined()) loadAll(true); });
  return {destroy:function(){ dead=true; }};
};
})();
