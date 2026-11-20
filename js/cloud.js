/* Imhotep · إمحتب — حفظ التقدّم على حساب جوجل ومزامنته بين الأجهزة.
   المحرّك ده (القواعد والدمج والمزامنة والواجهة) مستقل عن المزوّد. المزوّد (Supabase أو Firebase) محوّل منفصل:
   js/cloud-sb.js و js/cloud-fb.js، والاختيار من IM.CLOUD.provider في js/cloud-config.js (أو ?fb=1 / ?fb=0 على متصفح واحد للتجربة، ?fb=x يرجّعه للافتراضي).
   مقفول من js/cloud-config.js (on:false). التصدير والاستيراد اليدوي ما اتغيّروش وبيفضلوا شغّالين زي ما هم.

   القواعد اللي الكود ده ماشي عليها (عشان مفيش طالب يخسر حاجة):
   1) أول ما الطالب يربط: لو الحساب فاضي بنرفع تقدّم الجهاز كامل. لو الحساب فيه تقدّم (من جهاز تاني) بنندمج الاتنين (الأحدث بيكسب لكل سؤال).
      الجهاز نفسه ما بيتمسحش منه أي حاجة أبدًا، ونسخة أمان بتتحفظ قبل أول دمج.
   2) بعد كده كل تغيير بيتبعت لوحده. بنستخدم رقم إصدار (rev): لو مفيش جهاز تاني كتب في نفس الوقت بنكتب مباشرة،
      ولو حصل تعارض بنسحب النسخة التانية وندمجها (اتحاد، مفيش حاجة بتضيع) وبعدين نكتب.
   3) لو الجهاز مفيهوش تغييرات لسه ما اترفعتش وفي نسخة أحدث على الحساب، بنتبنّاها كما هي (عشان الحذف زي مسح غلطة أو شيل علامة يوصل للأجهزة التانية).
   4) المزامنة بتشتغل على: فتح الموقع، الرجوع للتبويب، كل 90 ثانية والتبويب ظاهر، رجوع النت، وبعد 8 ثواني من آخر تغيير.
   5) الجلسات المفتوحة (الامتحانات) والإعدادات (حجم الخط والمظهر) مش بتتزامن: هي خاصة بالجهاز.
   6) وضع «إجباري» (required:true في cloud-config.js): البوابة بتطلب تسجيل الدخول بجوجل قبل ما الموقع يفتح. بس بشرطين عشان مفيش طالب يتقفل برّه:
      لازم يكون المزوّد جاهز فعلًا (جوجل مفعّل وفي اتصال)، وإن تسجيل الدخول ماوقعش بسبب إعداد عندنا (cfgFail). غير كده الموقع بيفتح عادي وبيفضّل يطلب الدخول.
   7) وضع التجربة (pilot:true): كل حاجة هنا مقفولة للطلبة وبتتفتح بس على متصفح فتح الموقع مرة بـ ?cloud=1 (وبيتقفل بـ ?cloud=0).
   8) التحويل بين المزوّدين (Supabase ← Firebase): كل مزوّد ليه مفتاح تخزين لوحده (im_cloud / im_cloud_fb) فالرجوع للمزوّد القديم دايمًا ممكن.
      أول مرة على Firebase بنقرا بيانات الربط القديمة (من غير ما نمسحها): نفس الحساب (نفس الـ UID بعد النقل)، والدخول بيحتاج مرة واحدة، والتقدّم بيندمج من الجهاز (اتحاد، مفيش حاجة بتضيع).
   الـ API كلها REST مباشرة (من غير مكتبة خارجية). الموقع مش بيشوف كلمة سر. */
(function(){
'use strict';
var IM=window.IM, h=IM.h, icon=IM.icon, S=IM.store;
var CFG=IM.CLOUD||{on:false}, PRE='im_cloud_pre', SNAP='im_cloud_snap';
var SYNC=['ans','marks','wrong','days','hist','plan','seen','seals','cards','read','notes','carto'];

/* ---------- المزوّد: supabase | firebase ---------- */
var ovr='';
function pickProvider(){
  var want=CFG.provider==='firebase'?'firebase':'supabase';
  try{ var u=new URL(location.href), q=u.searchParams.get('fb');
    if(q==='1') localStorage.setItem('im_cloud_prov','firebase'); else if(q==='0') localStorage.setItem('im_cloud_prov','supabase'); else if(q==='x') localStorage.removeItem('im_cloud_prov');
    if(q!==null){ u.searchParams.delete('fb'); try{ history.replaceState(null,'',u.pathname+(u.search||'')+u.hash); }catch(e){} }
    ovr=localStorage.getItem('im_cloud_prov')||'';
  }catch(e){}
  if(ovr==='firebase'||ovr==='supabase') want=ovr; else ovr='';
  /* الافتراضي firebase بس الإعداد ناقص: نكمّل على Supabase بدل ما نقفل الحفظ على الكل */
  if(want==='firebase'&&!(CFG.fb&&CFG.fb.projectId&&CFG.fb.apiKey&&CFG.fb.clientId)&&CFG.url&&CFG.anon) want='supabase';        /* ينطبق على ?fb=1 كمان: رابط تجربة متشارك ما يقفلش الحفظ */
  return want;
}
var PROV=pickProvider();
/* التوقيت حسب المزوّد. Supabase: 8 ث بعد آخر تغيير، فاصل 45 ث، وسحب كل 90 ث (من غير حد يومي). Firebase Spark المجاني: حد يومي 20 ألف كتابة و50 ألف قراءة لكل الطلبة،
   فبنكتب أقل (15 ث بعد آخر تغيير، فاصل دقيقتين) وبنسحب كل 5 دقايق والتبويب ظاهر. أي تغيير بيتحفظ فورًا لما التبويب يتخبّى (يعني مفيش تقدّم بيضيع). كلهم قابلين للتغيير من cloud-config.js. */
var FBP=PROV==='firebase';
var DEBOUNCE=+CFG.debounceMs||(FBP?15000:8000), MIN_GAP=CFG.minGapMs!=null?+CFG.minGapMs:(FBP?120000:45000), POLL=+CFG.pollMs||(FBP?300000:90000);
var KEY=PROV==='firebase'?'im_cloud_fb':'im_cloud', PK=PROV==='firebase'?'im_cloud_pkce_fb':'im_cloud_pkce';
var C=S.get(KEY,null); if(!C||typeof C!=='object'||Array.isArray(C)) C={};
/* أول تشغيل على Firebase: بنقرا ربط Supabase القديم (من غير ما نلمسه) عشان نفس الحساب والتقدّم يكمّلوا. الجلسة القديمة مابتشتغلش على Firebase فبنطلب دخول مرة واحدة. */
if(PROV==='firebase'&&!S.get(KEY,null)){
  var L0=S.get('im_cloud',null);
  if(L0&&typeof L0==='object'&&(L0.uid||L0.acct)){
    C={acct:L0.acct||L0.uid,mig:1,need:1,rev:null,dirty:L0.dirty?1:0,n:L0.n||0,dev:L0.dev||'',email:L0.email||'',name:L0.name||'',avatar:L0.avatar||''};
    S.set(KEY,C);
  }
}
function save(){ S.set(KEY,C); }
/* تغيير المزوّد (التحويل لـ Firebase أو الرجوع لـ Supabase): لكل مزوّد سجله، والجهاز عنده نفس بيانات الطالب في الحالتين. لو آخر مرة اشتغلنا على مزوّد تاني،
   سجل المزوّد الحالي ممكن يكون قديم (جهاز تاني كتب في الفترة دي). نعتبره «متسخ» عشان أول مزامنة تدمج وترفع من الجهاز بدل ما تستبدله بنسخة السيرفر (كانت هتضيّع تقدّم). */
var SWF='';
try{ var LP=localStorage.getItem('im_cloud_lp'); if(LP&&LP!==PROV&&(C.rev!=null||C.acct||C.uid)){ SWF=LP; C.dirty=1; save(); } localStorage.setItem('im_cloud_lp',PROV); }catch(e){}
var pilotOn=(function(){ try{ var u=new URL(location.href), q=u.searchParams.get('cloud');
  if(q==='1') localStorage.setItem('im_cloud_pilot','1'); else if(q==='0') localStorage.removeItem('im_cloud_pilot');
  if(q!==null){ u.searchParams.delete('cloud'); try{ history.replaceState(null,'',u.pathname+(u.search||'')+u.hash); }catch(e){} }
  return localStorage.getItem('im_cloud_pilot')==='1'; }catch(e){ return false; } })();
var CFG_FAIL_MS=6*3600*1000;
var X={CFG:CFG,C:C,S:S,PK:PK,save:save,rnd:rnd,sha256:sha256,b64url:b64url,withToken:withToken,httpErr:httpErr};
var A=(IM.cloudAdapters&&IM.cloudAdapters[PROV])?IM.cloudAdapters[PROV](X):null;
if(!A&&CFG.on){ try{ console.warn('cloud: adapter "'+PROV+'" is missing (stale cache?) — sync is off until the page reloads with all scripts'); }catch(e){} }
function configured(){ return !!(CFG.on&&A&&A.configured()&&(!CFG.pilot||pilotOn)); }
IM.cloudOn=function(){ return configured()&&!(IM.bank&&IM.bank.single); };
function signedIn(){ return !!(C.rt||C.at); }
function noop(){}
function countAns(){ return Object.keys(IM.st.ans||{}).length; }
function hasProgress(){ return countAns()>0||Object.keys(IM.st.days||{}).length>0||Object.keys(IM.st.marks||{}).length>0; }

/* ---------- أدوات ---------- */
function b64url(buf){ var s='', a=new Uint8Array(buf); for(var i=0;i<a.length;i++) s+=String.fromCharCode(a[i]); return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function rnd(n){ var a=new Uint8Array(n); crypto.getRandomValues(a); return b64url(a); }
function sha256(s){ return crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)).then(b64url); }

/* ---------- الجلسة ---------- */
/* b = {at, rt, exp(ms), user:{id,email,name,avatar}} (شكل موحّد من المحوّل) */
function applyUser(u){
  if(!u) return;
  if(u.id) C.uid=u.id; C.email=u.email||C.email||'';
  C.name=u.name||C.name||''; C.avatar=u.avatar||C.avatar||'';
}
function setSession(b){
  C.at=b.at||C.at; C.rt=b.rt||C.rt;
  C.exp=b.exp||(Date.now()+3600000);
  applyUser(b.user); C.need=0; C.cfgFail=0; save();
}
var refreshing=null, expiredToast=false;
function refresh(){
  if(refreshing) return refreshing;
  if(!C.rt){ var e0=new Error('signed-out'); e0.auth=1; return Promise.reject(e0); }
  refreshing=A.refresh(C.rt).then(function(r){
    refreshing=null;
    if(r.ok&&r.bundle){ setSession(r.bundle); return C.at; }
    if(r.status>=500||r.status===429){ var e1=new Error('server'); throw e1; }
    C.at=null; C.rt=null; C.exp=0; C.need=1; save(); IM.emit('cloud');            /* الجلسة انتهت: التقدّم على الجهاز زي ما هو، بس لازم يسجّل دخول تاني */
    if(!expiredToast){ expiredToast=true; try{ IM.toast('جلستك انتهت. سجّل دخولك بجوجل تاني عشان التقدّم الجديد يتحفظ على حسابك.',{kind:'bad',ms:9000,action:{label:'سجّل دخول',fn:function(){ IM.cloudSignIn(); }}}); }catch(_){} }
    var e2=new Error('signed-out'); e2.auth=1; throw e2;
  },function(e){ refreshing=null; throw e; });
  return refreshing;
}
function fresh(){ if(!signedIn()){ var e=new Error('signed-out'); e.auth=1; return Promise.reject(e); } if(C.at&&C.exp-Date.now()>60000) return Promise.resolve(C.at); return refresh(); }
/* طلب بصلاحية الطالب: لو رجع 401 بنجدّد التوكن مرة ونعيد (fn بياخد التوكن ويرجّع {status,ok,json}) */
function withToken(fn){
  return fresh().then(fn).then(function(r){
    if(r.status!==401) return r;
    C.exp=0; return fresh().then(fn);
  });
}

/* ---------- تسجيل الدخول ---------- */
IM.cloudSignIn=function(){
  if(!IM.cloudOn()) return Promise.resolve(false);
  return A.signIn(location.hash||'#/');
};
/* الرجوع من جوجل: بيتقرا أول ما الملف يشتغل (قبل الراوتر) وبيتنضّف الرابط فورًا (المحوّل هو اللي بيفهم الرابط) */
var returning=null, returnErr='';
(function early(){
  if(!configured()) return;
  var o=A.early(); if(!o) return;
  if(o.err){ returnErr=o.err; return; }
  returning=o.promise||null;
  if(returning) returning.catch(noop);          /* لو الرفض جه قبل ما cloudBoot يمسك الوعد، ما يبقاش «unhandled rejection» (cloudBoot هو اللي بيتعامل مع الخطأ) */
})();

/* ---------- هل الدخول بجوجل جاهز فعلًا عند المزوّد؟ ---------- */
var prov=null, provP=null, wallSkipped='';
function providerReady(){                                  /* 'on' | 'off' | 'net' */
  if(provP) return provP;
  provP=A.probe().then(function(v){
    prov=v; if(v==='net') provP=null; IM.emit('cloud'); return v;
  },function(){ provP=null; return 'net'; });
  return provP;
}
IM.cloudRequired=function(){ return IM.cloudOn()&&CFG.required===true; };

/* ---------- الباك أب وحزمة التقدّم ---------- */
function snapshot(why,slot){
  try{ var s=IM.exportAll(); if(s.length>2400000) return; S.set(slot||SNAP,{at:Date.now(),why:why,n:countAns(),data:s}); }catch(e){}
}
function savePre(){ if(S.get(PRE,null)) return; snapshot('before-link',PRE); }
function pack(){
  var o={app:'imhotep',v:1,at:Date.now()}, ex={};
  try{ ex=JSON.parse(IM.exportAll()); }catch(e){}
  SYNC.forEach(function(k){ o[k]=ex[k]!==undefined?ex[k]:IM.st[k]; });
  if(ex.user) o.user=ex.user; if(ex.board) o.board=ex.board;
  return o;
}
var _imp0=IM.importAll;                                   /* الاستيراد الأصلي (بيدمج ومابيمسحش) */
/* بعد أي دمج: غلطة اتصحّحت (آخر إجابة صح) ما ترجعش تظهر في الأغلاط بسبب اتحاد القوايم. (مابنضيفش حاجة: اللي اتشال بإيد الطالب من الكفّة يفضل متشال) */
function fixWrong(){
  var w=IM.st.wrong, a=IM.st.ans, ch=false;
  Object.keys(w).forEach(function(id){ var x=a[id]; if(x&&x.lo===1){ delete w[id]; ch=true; } });
  if(ch){ IM.save('wrong'); IM.flush(); }
}
function mergeLocal(row){                                  /* اتحاد: مفيش حاجة بتضيع */
  snapshot('merge');
  var r=_imp0(JSON.stringify(row.data||{}));
  if(r&&r.ok) fixWrong();
  return r;
}
/* تبنّي نسخة الحساب: بنفضّي المفاتيح اللي النسخة التانية فيها وبنملاها بنفس طريق الاستيراد المجرّب (عشان الحذف يوصل) */
function adoptRemote(data){
  snapshot('adopt');
  SYNC.forEach(function(k){
    if(data[k]===undefined||data[k]===null) return;                       /* نسخة قديمة مفيهاش المفتاح ده: نسيب اللي على الجهاز */
    var cur=IM.st[k];
    if(Array.isArray(cur)) cur.length=0;
    else if(k==='plan') IM.st.plan=null;
    else if(k==='carto'){ cur.tier=0; cur.at={}; cur.trials={}; cur.weekly=[]; delete cur.code; }
    else if(cur&&typeof cur==='object') Object.keys(cur).forEach(function(id){ delete cur[id]; });      /* في نفس الكائن عشان أي حد ماسك مرجع ليه */
  });
  var r=_imp0(JSON.stringify(data));
  if(r&&r.ok) fixWrong();
  return r;
}

/* ---------- المزامنة ---------- */
var dseq=0, busy=null, again=false, pushT=null, pollT=null, lastPush=0, started=false;
function devId(){ if(!C.dev){ C.dev='d'+Date.now().toString(36)+rnd(6); save(); } return C.dev; }
function markDirty(){
  if(!signedIn()&&!C.acct) return;
  dseq++; C.dirty=1; save();
  if(signedIn()&&started) schedule(Math.max(DEBOUNCE,lastPush+MIN_GAP-Date.now()));
  IM.emit('cloud');
}
IM.onTouch=function(name){ if(SYNC.indexOf(name)>-1||name==='user') markDirty(); };
IM.importAll=function(text){ var r=IM.importAllRaw?IM.importAllRaw(text):_imp0(text); if(r&&r.ok){ if(C.acct||signedIn()) markDirty(); } return r; };
IM.importAllRaw=_imp0;
function schedule(ms){ if(pushT) return; pushT=setTimeout(function(){ pushT=null; IM.cloudSync('timer'); },Math.max(0,ms)); }
function getRow(select){ return A.getRow(C.uid,select==='rev'); }
function httpErr(r){ var e=new Error('http'); e.status=r.status; e.code=(r.json&&(r.json.code||r.json.error))||''; e.msg=(r.json&&(r.json.message||r.json.error_description))||''; return e; }
function insertRow(tries){
  var seq=dseq, data=pack();
  return A.insertRow(C.uid,data,devId()).then(function(r){
    if(r.ok){ done(r.rev,seq); return 'created'; }
    /* r.dup: حد سبقنا (جهاز تاني بيربط في نفس اللحظة) */
    if((tries||0)>=3) throw httpErr({status:409,json:null});
    return getRow().then(function(row){ if(!row) return insertRow((tries||0)+1); mergeLocal(row); C.rev=row.rev; return push(0); });
  });
}
function done(rev,seq){ C.rev=rev; if(seq===dseq) C.dirty=0; C.last=Date.now(); C.n=countAns(); C.err=''; C.fails=0; C.acct=C.uid; lastPush=Date.now(); save(); }
function push(tries){
  tries=tries||0; var seq=dseq;
  /* حماية: لو إجابات الجهاز قلّت فجأة (مسح بيانات المتصفح مثلًا) ما نكتبش فوق الحساب، ندمج الأول */
  if(C.n&&countAns()<C.n*0.8&&C.n-countAns()>20&&!C.shrunkOk){
    return getRow().then(function(row){ if(row){ mergeLocal(row); C.rev=row.rev; } C.shrunkOk=1; return push(tries); });
  }
  var data=pack();
  return A.pushRow(C.uid,data,C.rev,devId()).then(function(r){
    if(r.ok){ C.shrunkOk=0; done(r.rev,seq); return 'pushed'; }
    /* r.conflict: جهاز تاني كتب قبلنا (أو الصف مش موجود) */
    if(tries>=4){ var e=new Error('conflict'); throw e; }
    return getRow().then(function(row){ if(!row) return insertRow(); mergeLocal(row); C.rev=row.rev; save(); return push(tries+1); });
  });
}
function pullIfNewer(){
  return getRow('rev').then(function(m){
    if(!m){ C.dirty=1; return push(0); }                                      /* الصف اتمسح من الحساب: نرفع تاني */
    if(m.rev===C.rev){ C.last=Date.now(); C.err=''; C.fails=0; save(); return 'same'; }
    if(m.rev<C.rev){ C.dirty=1; return push(0); }
    var seq=dseq;
    return getRow().then(function(row){
      if(!row) return 'gone';
      if(seq!==dseq||C.dirty||row.corrupt){ mergeLocal(row); C.rev=row.rev; save(); return push(0).then(function(){ return 'merged'; }); }   /* اتغيّر حاجة وإحنا بنسحب (أو نسخة الحساب تالفة: نرفع اللي على الجهاز) */
      var r=adoptRemote(row.data||{}); C.rev=row.rev; C.last=Date.now(); C.n=countAns(); C.err=''; C.fails=0; C.acct=C.uid; save();
      IM.emit('answer'); IM.emit('user'); IM.emit('marks'); return 'adopted';
    });
  });
}
function firstSync(){
  savePre();
  return getRow().then(function(row){
    if(!row) return insertRow();
    mergeLocal(row); C.rev=row.rev; save();
    return push(0).then(function(){ return 'merged'; });
  });
}
function run(why){
  return fresh().then(function(){
    if(C.rev==null) return firstSync();
    if(C.dirty) return push(0);
    return pullIfNewer();
  });
}
IM.cloudSync=function(why){
  if(!IM.cloudOn()||!signedIn()) return Promise.resolve('off');
  if(C.acct&&C.uid&&C.acct!==C.uid) return Promise.resolve('off');      /* حساب مختلف لسه ماتأكدش: مفيش مزامنة قبل ما الطالب يقرّر (عشان تقدّم حساب مايتخلطش بحساب تاني) */
  if(busy){ again=true; return busy; }
  busy=run(why).then(function(res){ C.err=''; save(); return res; },function(e){
    C.fails=(C.fails||0)+1;
    var quota=!!(e&&e.status===429);                                       /* حد Firebase اليومي (Spark) خلص: مفيش فايدة نحاول كل شوية، التقدّم على الجهاز وبيترفع بعدين */
    C.err=e&&e.auth?'auth':(e&&e.net?'net':(quota?'quota':(e&&e.message==='conflict'?'conflict':'fail')));
    if(!(e&&e.auth)) schedule(quota?20*60*1000:Math.min(300000,15000*Math.pow(2,Math.min(C.fails,5))));
    save(); try{ console.warn('cloud sync:',e&&e.message,e&&e.status||''); }catch(_){}
    return 'error';
  }).then(function(res){ busy=null; IM.emit('cloud'); if(again){ again=false; schedule(1500); } return res; });
  IM.emit('cloud');
  return busy;
};

/* ---------- بعد تسجيل الدخول ---------- */
function ask(title,body,yes,no){
  return new Promise(function(res){
    var d=null, fin=false; function end(v){ if(fin) return; fin=true; if(d) d.close(); res(v); }
    d=IM.modal({title:title,body:h('p',{text:body}),onclose:function(){ end(false); },foot:[h('button.btn.primary',{type:'button',onclick:function(){ end(true); }},yes),h('button.btn.ghost',{type:'button',onclick:function(){ end(false); }},no)]});
  });
}
function afterLogin(tok){
  var prevMail=String(C.email||'').toLowerCase();
  setSession(tok);
  /* نقل من مزوّد لمزوّد: لو الـ UID اتغيّر بس الإيميل نفسه فده نفس الشخص (مفيش سؤال «حساب مختلف») */
  var sameMail=!!(C.mig&&prevMail&&String(C.email||'').toLowerCase()===prevMail);
  var other=C.acct&&C.acct!==C.uid&&hasProgress()&&!sameMail;
  var p=Promise.resolve(true);
  if(other){
    p=ask('حساب مختلف عن اللي كان مربوط','الجهاز ده كان مربوط بحساب جوجل تاني، وعليه تقدّم. لو كمّلت هيتدمج التقدّم اللي على الجهاز في الحساب الجديد (من غير ما يتمسح حاجة). لو الجهاز لشخص تاني اضغط «إلغاء الدخول».','ادمج وكمّل','إلغاء الدخول');
  }
  return p.then(function(go){
    if(!go){ cloudSignOutLocal(); return {cancelled:1}; }
    if(C.acct!==C.uid){ C.rev=null; C.n=0; C.acct=null; C.shrunkOk=0; if(!sameMail) C.dirty=0; save(); }
    C.mig=0; save();
    var n0=countAns();
    return IM.cloudSync('login').then(function(r){ return {res:r,n0:n0,n1:countAns()}; });
  });
}
/* بيتنادى من app.js قبل البوابة: لو لسه راجعين من جوجل بنستنى أول مزامنة (بحد أقصى 12 ثانية) عشان الجهاز الجديد ياخد تقدّمه ويعدّي الاسم */
IM.cloudBoot=function(){
  if(returnErr){ var er=returnErr; returnErr=''; setTimeout(function(){ IM.toast('تسجيل الدخول بجوجل ما كملش'+(er==='access_denied'?' (رفضت الإذن)':'')+'. تقدّمك على الجهاز زي ما هو.',{kind:'bad',ms:7000}); },900); }
  if(!returning) return Promise.resolve();
  var p=returning; returning=null;
  IM.splash(true,'بنجيب تقدّمك من حسابك…');
  var job=p.then(afterLogin).then(function(o){
    if(o&&o.res&&o.res!=='error'&&o.res!=='off'){ var add=Math.max(0,o.n1-o.n0);
      setTimeout(function(){ IM.toast(o.res==='created'?('اتحفظ تقدّمك على حسابك ('+o.n1+' إجابة). من دلوقتي بيتحفظ لوحده.'):('اتربط حسابك. '+(add?'اتضاف '+add+' إجابة من حسابك للجهاز، و':'')+'تقدّم الجهاز اتحفظ على الحساب. من دلوقتي بيتزامن لوحده.'),{icon:'check',ms:7000}); },1200);
      IM.notify({id:'cloud-linked',icon:'lock',title:'تقدّمك اتربط بحساب جوجل',text:'بيتحفظ لوحده على حسابك وبيتزامن مع أي جهاز تدخل منه. التصدير والاستيراد لسه شغّالين زي ما هم.',link:null});
    } else if(o&&o.res==='error'){ setTimeout(function(){ IM.toast('اتسجّل دخولك بس المزامنة ما كملتش دلوقتي. هنحاول تاني لوحدنا، وتقدّمك على الجهاز زي ما هو.',{kind:'bad',ms:7000}); },1200); }
    return o;
  },function(e){
    if(e&&e.cfg){ C.cfgFail=Date.now(); save(); }                                   /* مشكلة إعداد عندنا (مش من الطالب): الموقع يفتح من غير بوابة لحد ما تتصلّح */
    setTimeout(function(){ IM.toast('تعذّر إكمال تسجيل الدخول بجوجل. جرّب تاني. تقدّمك على الجهاز زي ما هو.',{kind:'bad',ms:7000}); },900);
    try{ console.warn('cloud login:',e&&e.message,e&&e.status||''); }catch(_){}
  });
  return Promise.race([job,new Promise(function(r){ setTimeout(r,12000); })]);
};

/* بيتنادى بعد ما الموقع يفتح: مؤقتات المزامنة */
IM.cloudStart=function(){
  if(started||!IM.cloudOn()) return; started=true;
  if(signedIn()){ setTimeout(function(){ IM.cloudSync('boot'); },1200); }
  else providerReady();

  pollT=setInterval(function(){ if(!document.hidden&&signedIn()) IM.cloudSync('poll'); },POLL);
  document.addEventListener('visibilitychange',function(){ if(!document.hidden&&signedIn()&&Date.now()-(C.last||0)>(FBP?90000:20000)) IM.cloudSync('focus'); else if(document.hidden&&signedIn()&&C.dirty){ IM.cloudSync('hide'); } });
  window.addEventListener('online',function(){ if(signedIn()) IM.cloudSync('online'); });
  if(IM.notify&&!signedIn()&&!C.acct&&!IM.cloudRequired()&&prov!=='off'&&!S.get('im_cloud_inv',0)){ S.set('im_cloud_inv',1);
    IM.notify({id:'cloud-invite',icon:'lock',title:'احفظ تقدّمك على حساب جوجل',text:'اربط حسابك من الإعدادات وتقدّمك هيتحفظ لوحده ويتزامن مع أي جهاز. التصدير والاستيراد لسه زي ما هم.',link:'#/settings'}); }
};
function cloudSignOutLocal(){
  var t=C.at;
  if(IM.horusChatPurge){ try{ IM.horusChatPurge(C.uid); }catch(e){} }         /* محادثات حورس على الجهاز بتتمسح مع الخروج (النسخة على الحساب فاضلة وبترجع بالدخول) */
  C.at=null; C.rt=null; C.exp=0; C.uid=''; C.email=''; C.name=''; C.avatar=''; C.need=0; save();
  if(t) A.logout(t);
  IM.emit('cloud');
}
IM.cloudSignOut=function(){ cloudSignOutLocal(); };
IM.cloudState=function(){ return {on:IM.cloudOn(),signedIn:signedIn(),email:C.email||'',name:C.name||'',avatar:C.avatar||'',busy:!!busy,err:C.err||'',dirty:!!C.dirty,last:C.last||0,rev:C.rev,need:!!C.need,mig:!!C.mig,provider:PROV,swFrom:SWF,pre:S.get(PRE,null)?{at:S.get(PRE).at,n:S.get(PRE).n}:null,acct:!!C.acct}; };
/* للشات العايم (js/horus-chat.js): طلب بصلاحية الطالب الحالي (بيجدّد التوكن لو لزم) ومعرّفه. بيترفض بـ e.auth لو مش مسجّل دخول. */
IM.cloudCall=function(method,path,o){
  if(!IM.cloudOn()||!signedIn()){ var e=new Error('signed-out'); e.auth=1; return Promise.reject(e); }
  return A.call(method,path,o);
};
/* الدالة (حورس) والمحادثة المحفوظة، من غير ما الشات يعرف المزوّد */
function needAuth(){ if(!IM.cloudOn()||!signedIn()){ var e=new Error('signed-out'); e.auth=1; return e; } return null; }
IM.cloudFnReady=function(){ return !!(IM.cloudOn()&&A&&A.fnReady()); };
IM.cloudFn=function(method,qs,o){ var e=needAuth(); return e?Promise.reject(e):A.fn(method,qs||'',o||{}); };
IM.cloudChatGet=function(){ var e=needAuth(); return e?Promise.reject(e):A.chatGet(C.uid); };
IM.cloudChatPut=function(msgs){ var e=needAuth(); return e?Promise.reject(e):A.chatPut(C.uid,msgs); };
IM.cloudUid=function(){ return signedIn()?(C.uid||''):''; };
IM.cloudProfile=function(){ return signedIn()?{name:C.name,email:C.email,avatar:C.avatar}:null; };
IM.cloudPreData=function(){ var p=S.get(PRE,null); return p&&p.data||null; };

/* ---------- بوابة الدخول الإجباري ---------- */
IM.cloudWall=function(){
  if(!IM.cloudRequired()||signedIn()) return Promise.resolve(false);
  if(C.cfgFail&&Date.now()-C.cfgFail<CFG_FAIL_MS){ wallSkipped='cfg'; return Promise.resolve(false); }      /* الدخول وقع بسبب إعداد عندنا: ما نقفلش حد برّه */
  return providerReady().then(function(v){
    if(v!=='on'){                                                       /* المزوّد مش جاهز أو مفيش نت: ما نقفلش حد برّه */
      wallSkipped=v;
      if(v==='net') setTimeout(function(){ IM.toast('فتحنا الموقع من غير تسجيل دخول لأن مفيش اتصال دلوقتي. سجّل دخولك بجوجل أول ما النت يرجع عشان تقدّمك يتحفظ.',{kind:'bad',ms:9000,action:{label:'سجّل دخول',fn:function(){ IM.cloudSignIn(); }}}); },1200);
      return false;
    }
    drawWall(); return true;
  });
};
function drawWall(){
  IM.splash(false);
  var gate=document.getElementById('gate'); IM.clear(gate); gate.hidden=false;
  var n=countAns(), has=!!IM.st.user||hasProgress(), mig=!!C.mig, msg=h('p.g-msg',{role:'alert'});
  var b=h('button.btn.primary.g-go.cl-wall-btn',{type:'button',onclick:function(){
    b.disabled=true; msg.textContent='';
    IM.cloudSignIn().then(null,function(){ b.disabled=false; msg.textContent='تعذّر فتح تسجيل الدخول. جرّب تاني.'; });
  }},gIcon(),h('span',{text:(has||mig)?'ادخل بحساب جوجل وكمّل':'ادخل بحساب جوجل'}));
  var kids=[
    h('div.g-mark',{html:IM.pyr(6,{anim:true})}),
    h('div.eyebrow',{text:'IMHOTEP · إمحتب'}),
    h('h1#gH.display',{text:mig?'سجّل دخولك بجوجل مرة واحدة':(has?'سجّل دخولك بجوجل عشان تكمّل':'ادخل بحساب جوجل')}),
    h('p.muted',{text:mig
      ?('حفظ التقدّم اتنقل لنظام جديد. ادخل بنفس حساب جوجل اللي كنت بتستخدمه مرة واحدة بس'+(n?(' (تقدّمك على الجهاز ده '+n+' إجابة)'):'')+'، وتقدّمك بيتزامن مع حسابك زي ما هو ومفيش حاجة بتتمسح.')
      :has
      ?('تقدّمك على الجهاز ده'+(n?(' ('+n+' إجابة)'):'')+' هيترفع لحسابك لوحده أول ما تدخل، ومفيش حاجة هتتمسح منه. وبعد كده أي تقدّم جديد بيتحفظ تلقائي وبيظهر على أي جهاز، حتى لو فتحت الموقع كتطبيق.')
      :'حسابك بيحفظ تقدّمك لوحده وبيزامنه على أي جهاز، فمش هتخسره لو غيّرت المتصفح أو فتحت الموقع كتطبيق.'}),
    b,msg];
  if(has&&n) kids.push(h('p.g-foot.muted',{},'عايز نسخة بإيدك الأول؟ ',h('button.linkbtn',{type:'button',onclick:function(){ try{ IM.download('imhotep-progress-'+IM.dayKey()+'.json',IM.exportAll()); }catch(e){} }},'نزّل تقدّمك الحالي')));
  kids.push(h('p.g-foot.muted.cl-legal',{},icon('lock',14),' بنطلب اسمك وإيميلك وصورتك العامة بس. ',h('a',{href:'privacy.html',target:'_blank',rel:'noopener'},'الخصوصية'),' · ',h('a',{href:'terms.html',target:'_blank',rel:'noopener'},'الشروط')));
  var card=h('div.g-card.rv.cl-wall',{role:'dialog','aria-modal':'true','aria-labelledby':'gH'},kids);
  gate.appendChild(h('div.g-art',{html:'<span class="glow breathe g-glow"></span>'+IM.dunes(180)}));
  gate.appendChild(card);
  setTimeout(function(){ try{ b.focus(); }catch(e){} },350);
}
/* مسح الحساب وكل بياناته من السيرفر (Supabase: RPC delete_my_account · Firebase: دالة deleteAccount). اللي على الجهاز بيفضل زي ما هو. */
IM.cloudDeleteAccount=function(){
  return A.deleteAccount().then(function(){
    if(pushT){ clearTimeout(pushT); pushT=null; }
    cloudSignOutLocal(); C.acct=null; C.rev=null; C.dirty=0; C.n=0; C.last=0; C.err=''; C.fails=0; C.shrunkOk=0; save();
    IM.emit('cloud'); return true;
  });
};

/* ---------- كارت الإعدادات ---------- */
function gIcon(){ var s=document.createElement('span'); s.className='cl-g'; s.setAttribute('aria-hidden','true'); s.innerHTML='<svg viewBox="0 0 48 48" width="18" height="18"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.2C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z"/><path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-2.9-.8-4.6s.3-3.2.8-4.6l-7.9-6.2C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.2z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.9 2.3-8.5 2.3-6.3 0-11.6-4.1-13.5-9.9l-7.9 6.2C6.5 42.6 14.6 48 24 48z"/></svg>'; return s; }
function ago(t){ if(!t) return 'لسه'; var s=Math.round((Date.now()-t)/1000); if(s<20) return 'دلوقتي'; if(s<3600) return 'من '+Math.max(1,Math.round(s/60))+' دقيقة'; if(s<86400) return 'من '+Math.round(s/3600)+' ساعة'; return IM.fmtDate?IM.fmtDate(IM.dayKey(new Date(t))):'من أيام'; }
IM.cloudSetting=function(close){
  if(!IM.cloudOn()) return null;
  var box=h('div.cl-card'), del={msg:'',relogin:0,busy:0};
  function draw(){
    IM.clear(box); var s=IM.cloudState();
    box.hidden=!s.signedIn&&prov==='off';                             /* الدخول مش جاهز عند المزوّد: منظهرش حاجة مش هتشتغل */
    if(box.hidden) return;
    if(!s.signedIn){
      box.appendChild(h('div.cl-h',{},icon('lock',18),h('b',{text:s.mig?'سجّل دخولك بجوجل مرة واحدة عشان نكمّل':(s.need?'سجّل الدخول تاني عشان تكمّل المزامنة':'احفظ تقدّمك على حساب جوجل')})));
      box.appendChild(h('p.muted.cl-p',{text:s.mig?'حفظ التقدّم اتنقل لنظام جديد، فمحتاج تدخل بنفس حساب جوجل مرة واحدة. تقدّمك على الجهاز زي ما هو ومش اتمسح، وأول ما تدخل بيتزامن مع حسابك.':s.need?'جلستك انتهت. تقدّمك على الجهاز زي ما هو ومش اتمسح، وأول ما تدخل تاني بيتزامن.':'تقدّمك كله بيتحفظ على حسابك وبيتزامن لوحده مع أي جهاز تدخل منه. اللي على جهازك دلوقتي بيترفع كامل ومفيش حاجة بتتمسح، والتصدير والاستيراد لسه شغّالين زي ما هم.'}));
      var b=h('button.btn.cl-gbtn',{type:'button',onclick:function(){ b.disabled=true; IM.cloudSignIn().then(function(){},function(){ b.disabled=false; IM.toast('تعذّر فتح تسجيل الدخول.',{kind:'bad'}); }); }},gIcon(),h('span',{text:'تسجيل الدخول بجوجل'}));
      box.appendChild(h('div.set-btns',{},b));
      if(s.pre) box.appendChild(preRow(s));
      return;
    }
    var st=s.busy?'بنزامن…':(s.err==='quota'?'الحفظ السحابي وصل للحد اليومي المجاني. تقدّمك محفوظ على جهازك وهيترفع لوحده أول ما الحد يتجدد.':s.err==='net'?'مفيش اتصال دلوقتي. التقدّم محفوظ على الجهاز وهيتزامن أول ما النت يرجع.':(s.err?'المزامنة ما كملتش دلوقتي وهنحاول تاني لوحدنا.':(s.dirty?'فيه تغييرات هتتحفظ خلال ثواني.':'متزامن · آخر مزامنة '+ago(s.last))));
    box.appendChild(h('div.cl-who',{},
      s.avatar?h('img.cl-av',{src:s.avatar,alt:'',referrerpolicy:'no-referrer'}):h('span.cl-av.ph',{text:IM.initial(s.name||s.email)}),
      h('div.cl-id',{},h('b',{text:s.name||'حساب جوجل'}),h('span.muted.mono',{dir:'ltr',text:s.email}))));
    box.appendChild(h('p.cl-st'+(s.err?'.bad':'.ok'),{role:'status'},icon(s.err?'warn':'check',15),h('span',{text:st})));
    box.appendChild(h('div.set-btns',{},
      h('button.btn.sm',{type:'button',onclick:function(){ IM.cloudSync('manual').then(function(r){ if(r==='error') IM.toast('تعذّرت المزامنة دلوقتي.',{kind:'bad'}); else IM.toast('اتزامن تقدّمك.',{icon:'check'}); }); }},icon('reset',16),'زامن دلوقتي'),
      IM.arm(h('button.btn.sm.ghost',{type:'button'}),'تسجيل الخروج',function(){ IM.cloudSignOut(); draw(); IM.toast('اتسجّل خروجك. تقدّمك على الجهاز زي ما هو.',{icon:'check'}); },'اضغط مرة أخرى للتأكيد')));
    box.appendChild(h('p.muted.cl-n',{text:'تسجيل الخروج وتصفير التقدّم بيمسحوا من الجهاز بس. نسخة حسابك بتفضل محفوظة وترجع لك أول ما تدخل تاني.'}));
    var delMsg=h('p.cl-n.bad',{role:'alert',hidden:!del.msg});                /* حالة المسح برّه draw(): أي حدث مزامنة بيعيد رسم الكارت وماينفعش يمسح الرسالة أو يفتح الزرار وسط المسح */
    if(del.msg){ delMsg.textContent=del.msg; if(del.relogin) delMsg.appendChild(h('button.linkbtn',{type:'button',onclick:function(){ IM.cloudSignIn(); }},'سجّل دخول دلوقتي')); }
    var delBtn=IM.arm(h('button.btn.sm.ghost.cl-del',{type:'button',disabled:!!del.busy}),'احذف حسابي وبياناتي من السيرفر',function(){
      del.busy=1; del.msg=''; del.relogin=0; delBtn.disabled=true; delMsg.hidden=true;
      IM.cloudDeleteAccount().then(function(){ del.busy=0; IM.toast('اتمسح حسابك وتقدّمك من السيرفر. اللي على جهازك لسه زي ما هو.',{icon:'check',ms:6000}); draw(); },
        function(e){
          del.busy=0;
          if(e&&e.relogin){ del.relogin=1; del.msg='لأسباب أمان لازم تسجّل دخولك بجوجل تاني الأول، وبعدها ارجع هنا واضغط «احذف حسابي» في خلال دقايق. '; }
          else del.msg='تعذّر الحذف دلوقتي. اتأكد إن النت شغّال وجرّب تاني.';
          draw();
        });
    },'اضغط مرة أخرى: هيتمسح حسابك وتقدّمك من السيرفر نهائي');
    box.appendChild(h('div.cl-delwrap',{},delBtn,h('span.muted.cl-n',{text:' بيمسح تقدّمك ونسخه الاحتياطية من السيرفر بس. نسخة الجهاز بتفضل.'})));
    box.appendChild(delMsg);
    if(s.pre) box.appendChild(preRow(s));
  }
  function preRow(s){
    return h('p.muted.cl-n',{},'نسخة أمان من جهازك قبل الربط ('+s.pre.n+' إجابة، '+ago(s.pre.at)+'): ',
      h('button.linkbtn',{type:'button',onclick:function(){ var d=IM.cloudPreData(); if(d) IM.download('imhotep-before-link-'+IM.dayKey()+'.json',d); }},'نزّلها'));
  }
  draw();
  var off=IM.on('cloud',function(){ if(!box.isConnected){ off(); return; } draw(); });
  return box;
};
/* زرار الدخول في بوابة الاسم (جهاز جديد لطالب عنده حساب) */
IM.cloudGateButton=function(){
  if(!IM.cloudOn()||signedIn()||prov==='off') return null;
  var b=h('button.btn.ghost.cl-gate',{type:'button',onclick:function(){ b.disabled=true; IM.cloudSignIn(); }},gIcon(),h('span',{text:'عندي حساب: دخول بجوجل'}));
  return b;
};
})();
