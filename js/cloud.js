/* Imhotep · إمحتب — حفظ التقدّم على حساب جوجل (Supabase) ومزامنته بين الأجهزة.
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
      لازم جوجل يكون مفعّل فعلًا في Supabase (بنسأل /auth/v1/settings)، ولازم يكون في اتصال. غير كده الموقع بيفتح عادي وبيفضّل يطلب الدخول.
   7) وضع التجربة (pilot:true): كل حاجة هنا مقفولة للطلبة وبتتفتح بس على متصفح فتح الموقع مرة بـ ?cloud=1 (وبيتقفل بـ ?cloud=0).
   الـ API كلها REST مباشرة (من غير مكتبة خارجية). تسجيل الدخول PKCE: الموقع مش بيشوف كلمة سر ولا بيستلم توكن في الرابط. */
(function(){
'use strict';
var IM=window.IM, h=IM.h, icon=IM.icon, S=IM.store;
var CFG=IM.CLOUD||{on:false}, KEY='im_cloud', PRE='im_cloud_pre', SNAP='im_cloud_snap', PK='im_cloud_pkce';
var SYNC=['ans','marks','wrong','days','hist','plan','seen','seals','cards','read','notes','carto'];
var DEBOUNCE=+CFG.debounceMs||8000, MIN_GAP=CFG.minGapMs!=null?+CFG.minGapMs:45000, POLL=+CFG.pollMs||90000;

var C=S.get(KEY,null); if(!C||typeof C!=='object'||Array.isArray(C)) C={};
function save(){ S.set(KEY,C); }
var pilotOn=(function(){ try{ var u=new URL(location.href), q=u.searchParams.get('cloud');
  if(q==='1') localStorage.setItem('im_cloud_pilot','1'); else if(q==='0') localStorage.removeItem('im_cloud_pilot');
  if(q!==null){ u.searchParams.delete('cloud'); try{ history.replaceState(null,'',u.pathname+(u.search||'')+u.hash); }catch(e){} }
  return localStorage.getItem('im_cloud_pilot')==='1'; }catch(e){ return false; } })();
function configured(){ return !!(CFG.on&&CFG.url&&CFG.anon&&(!CFG.pilot||pilotOn)); }
IM.cloudOn=function(){ return configured()&&!(IM.bank&&IM.bank.single); };
function signedIn(){ return !!(C.rt||C.at); }
function base(){ return String(CFG.url).replace(/\/+$/,''); }
function noop(){}
function countAns(){ return Object.keys(IM.st.ans||{}).length; }
function hasProgress(){ return countAns()>0||Object.keys(IM.st.days||{}).length>0||Object.keys(IM.st.marks||{}).length>0; }

/* ---------- شبكة ---------- */
function req(method,path,o){
  o=o||{}; var hd={apikey:CFG.anon};
  if(o.token) hd.Authorization='Bearer '+o.token;                       /* توكن الطالب (JWT) */
  else if(/^eyJ/.test(CFG.anon)) hd.Authorization='Bearer '+CFG.anon;   /* المفتاح القديم JWT بس. المفتاح الجديد sb_publishable_ ممنوع يتبعت في Authorization */
  if(o.body!==undefined) hd['Content-Type']='application/json';
  if(o.prefer) hd.Prefer=o.prefer;
  var ctl=window.AbortController?new AbortController():null, t=ctl?setTimeout(function(){ ctl.abort(); },o.timeout||25000):null;
  return fetch(base()+path,{method:method,headers:hd,body:o.body!==undefined?JSON.stringify(o.body):undefined,signal:ctl?ctl.signal:undefined,cache:'no-store'}).then(function(r){
    if(t) clearTimeout(t);
    return r.text().then(function(tx){ var j=null; try{ j=tx?JSON.parse(tx):null; }catch(e){} return {status:r.status,ok:r.ok,json:j}; });
  },function(e){ if(t) clearTimeout(t); var er=new Error('net'); er.net=1; er.cause=e; throw er; });
}
function b64url(buf){ var s='', a=new Uint8Array(buf); for(var i=0;i<a.length;i++) s+=String.fromCharCode(a[i]); return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function rnd(n){ var a=new Uint8Array(n); crypto.getRandomValues(a); return b64url(a); }
function sha256(s){ return crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)).then(b64url); }

/* ---------- الجلسة ---------- */
function applyUser(u){
  if(!u) return; var m=u.user_metadata||{};
  if(u.id) C.uid=u.id; C.email=u.email||m.email||C.email||'';
  C.name=m.full_name||m.name||C.name||''; C.avatar=m.avatar_url||m.picture||C.avatar||'';
}
function setSession(r){
  C.at=r.access_token||C.at; C.rt=r.refresh_token||C.rt;
  C.exp=r.expires_at?(+r.expires_at*1000):(Date.now()+((+r.expires_in)||3600)*1000);
  applyUser(r.user); C.need=0; save();
}
var refreshing=null, expiredToast=false;
function refresh(){
  if(refreshing) return refreshing;
  if(!C.rt){ var e0=new Error('signed-out'); e0.auth=1; return Promise.reject(e0); }
  refreshing=req('POST','/auth/v1/token?grant_type=refresh_token',{body:{refresh_token:C.rt}}).then(function(r){
    refreshing=null;
    if(r.ok&&r.json&&r.json.access_token){ setSession(r.json); return C.at; }
    if(r.status>=500||r.status===429){ var e1=new Error('server'); throw e1; }
    C.at=null; C.rt=null; C.exp=0; C.need=1; save(); IM.emit('cloud');            /* الجلسة انتهت: التقدّم على الجهاز زي ما هو، بس لازم يسجّل دخول تاني */
    if(!expiredToast){ expiredToast=true; try{ IM.toast('جلستك انتهت. سجّل دخولك بجوجل تاني عشان التقدّم الجديد يتحفظ على حسابك.',{kind:'bad',ms:9000,action:{label:'سجّل دخول',fn:function(){ IM.cloudSignIn(); }}}); }catch(_){} }
    var e2=new Error('signed-out'); e2.auth=1; throw e2;
  },function(e){ refreshing=null; throw e; });
  return refreshing;
}
function fresh(){ if(!signedIn()){ var e=new Error('signed-out'); e.auth=1; return Promise.reject(e); } if(C.at&&C.exp-Date.now()>60000) return Promise.resolve(C.at); return refresh(); }
/* طلب بصلاحية الطالب: لو رجع 401 بنجدّد التوكن مرة ونعيد */
function call(method,path,o){
  o=o||{};
  function go(){ return fresh().then(function(t){ return req(method,path,Object.assign({},o,{token:t})); }); }
  return go().then(function(r){
    if(r.status!==401) return r;
    C.exp=0; return go();
  });
}

/* ---------- تسجيل الدخول (PKCE) ---------- */
IM.cloudSignIn=function(){
  if(!IM.cloudOn()) return Promise.resolve(false);
  var ret=location.hash||'#/', redirect=CFG.redirect||(location.origin+location.pathname);
  function go(extra){ location.href=base()+'/auth/v1/authorize?provider=google&redirect_to='+encodeURIComponent(redirect)+(extra||''); }
  if(window.crypto&&crypto.subtle){
    var v=rnd(48);
    return sha256(v).then(function(ch){ S.set(PK,{v:v,ret:ret,t:Date.now()}); go('&code_challenge='+ch+'&code_challenge_method=s256'); return true; });
  }
  S.set(PK,{ret:ret,t:Date.now()}); go(''); return Promise.resolve(true);
};
/* الرجوع من جوجل: بيتقرا أول ما الملف يشتغل (قبل الراوتر) وبيتنضّف الرابط فورًا */
var returning=null, returnErr='';
(function early(){
  if(!configured()) return;
  var q, hs=String(location.hash||'').replace(/^#/,''), hp=null;
  try{ q=new URLSearchParams(location.search); if(/^(access_token|error)=/.test(hs)) hp=new URLSearchParams(hs); }catch(e){ return; }
  var code=q.get('code'), err=q.get('error')||(hp&&hp.get('error'))||'';
  if(!code&&!(hp&&hp.get('access_token'))&&!err) return;
  var pk=S.get(PK,null);
  if(!pk&&!err) return;                                  /* مش بتاعنا */
  S.del(PK);
  var keep=new URLSearchParams(location.search); ['code','error','error_code','error_description'].forEach(function(k){ keep.delete(k); });
  var qs=keep.toString(), ret=(pk&&pk.ret&&/^#\//.test(pk.ret))?pk.ret:'#/';
  try{ history.replaceState(null,'',location.pathname+(qs?'?'+qs:'')+ret); }catch(e){}
  if(err){ returnErr=err; return; }
  if(code){
    returning=req('POST','/auth/v1/token?grant_type=pkce',{body:{auth_code:code,code_verifier:(pk&&pk.v)||''}}).then(function(r){
      if(r.ok&&r.json&&r.json.access_token) return r.json;
      var e=new Error('exchange'); e.status=r.status; throw e;
    });
  } else {
    var tok={access_token:hp.get('access_token'),refresh_token:hp.get('refresh_token'),expires_in:+hp.get('expires_in')||3600};
    returning=req('GET','/auth/v1/user',{token:tok.access_token}).then(function(r){ if(!r.ok||!r.json) throw new Error('user'); tok.user=r.json; return tok; });
  }
})();

/* ---------- هل جوجل مفعّل فعلًا في Supabase؟ ---------- */
var prov=null, provP=null, wallSkipped='';
function providerReady(){                                  /* 'on' | 'off' | 'net' */
  if(provP) return provP;
  provP=req('GET','/auth/v1/settings',{timeout:6000}).then(function(r){
    var v=(r.ok&&r.json&&r.json.external)?(r.json.external.google===true?'on':'off'):'net';
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
function getRow(select){
  return call('GET','/rest/v1/progress?user_id=eq.'+encodeURIComponent(C.uid)+'&select='+(select||'data,rev,updated_at')).then(function(r){
    if(!r.ok) throw httpErr(r); return (r.json&&r.json[0])||null;
  });
}
function httpErr(r){ var e=new Error('http'); e.status=r.status; e.code=(r.json&&(r.json.code||r.json.error))||''; e.msg=(r.json&&(r.json.message||r.json.error_description))||''; return e; }
function insertRow(tries){
  var seq=dseq, data=pack();
  return call('POST','/rest/v1/progress?select=rev',{body:{user_id:C.uid,data:data,rev:1,device:devId()},prefer:'return=representation'}).then(function(r){
    if(r.ok&&r.json&&r.json[0]){ done(r.json[0].rev,seq); return 'created'; }
    if(r.status===409||r.status===400&&/duplicate|23505/i.test(JSON.stringify(r.json||''))){          /* حد سبقنا (جهاز تاني بيربط في نفس اللحظة) */
      if((tries||0)>=3) throw httpErr(r);
      return getRow().then(function(row){ if(!row) return insertRow((tries||0)+1); mergeLocal(row); C.rev=row.rev; return push(0); });
    }
    throw httpErr(r);
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
  return call('PATCH','/rest/v1/progress?select=rev&user_id=eq.'+encodeURIComponent(C.uid)+'&rev=eq.'+C.rev,{body:{data:data,rev:C.rev+1,updated_at:new Date().toISOString(),device:devId()},prefer:'return=representation'}).then(function(r){
    if(r.ok&&Array.isArray(r.json)&&r.json.length===1){ C.shrunkOk=0; done(r.json[0].rev,seq); return 'pushed'; }
    if(r.ok&&Array.isArray(r.json)&&r.json.length===0){                       /* تعارض: جهاز تاني كتب قبلنا (أو الصف مش موجود) */
      if(tries>=4){ var e=new Error('conflict'); throw e; }
      return getRow().then(function(row){ if(!row) return insertRow(); mergeLocal(row); C.rev=row.rev; save(); return push(tries+1); });
    }
    throw httpErr(r);
  });
}
function pullIfNewer(){
  return getRow('rev,updated_at').then(function(m){
    if(!m){ C.dirty=1; return push(0); }                                      /* الصف اتمسح من الحساب: نرفع تاني */
    if(m.rev===C.rev){ C.last=Date.now(); C.err=''; C.fails=0; save(); return 'same'; }
    if(m.rev<C.rev){ C.dirty=1; return push(0); }
    var seq=dseq;
    return getRow().then(function(row){
      if(!row) return 'gone';
      if(seq!==dseq||C.dirty){ mergeLocal(row); C.rev=row.rev; save(); return push(0).then(function(){ return 'merged'; }); }   /* اتغيّر حاجة وإحنا بنسحب */
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
    C.err=e&&e.auth?'auth':(e&&e.net?'net':(e&&e.message==='conflict'?'conflict':'fail'));
    if(!(e&&e.auth)) schedule(Math.min(300000,15000*Math.pow(2,Math.min(C.fails,5))));
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
  setSession(tok);
  var other=C.acct&&C.acct!==C.uid&&hasProgress();
  var p=Promise.resolve(true);
  if(other){
    p=ask('حساب مختلف عن اللي كان مربوط','الجهاز ده كان مربوط بحساب جوجل تاني، وعليه تقدّم. لو كمّلت هيتدمج التقدّم اللي على الجهاز في الحساب الجديد (من غير ما يتمسح حاجة). لو الجهاز لشخص تاني اضغط «إلغاء الدخول».','ادمج وكمّل','إلغاء الدخول');
  }
  return p.then(function(go){
    if(!go){ cloudSignOutLocal(); return {cancelled:1}; }
    if(C.acct!==C.uid){ C.rev=null; C.dirty=0; C.n=0; C.acct=null; C.shrunkOk=0; save(); }
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
  document.addEventListener('visibilitychange',function(){ if(!document.hidden&&signedIn()&&Date.now()-(C.last||0)>20000) IM.cloudSync('focus'); else if(document.hidden&&signedIn()&&C.dirty){ IM.cloudSync('hide'); } });
  window.addEventListener('online',function(){ if(signedIn()) IM.cloudSync('online'); });
  if(IM.notify&&!signedIn()&&!C.acct&&!IM.cloudRequired()&&prov!=='off'&&!S.get('im_cloud_inv',0)){ S.set('im_cloud_inv',1);
    IM.notify({id:'cloud-invite',icon:'lock',title:'احفظ تقدّمك على حساب جوجل',text:'اربط حسابك من الإعدادات وتقدّمك هيتحفظ لوحده ويتزامن مع أي جهاز. التصدير والاستيراد لسه زي ما هم.',link:'#/settings'}); }
};
function cloudSignOutLocal(){
  var t=C.at;
  if(IM.horusChatPurge){ try{ IM.horusChatPurge(C.uid); }catch(e){} }         /* محادثات حورس على الجهاز بتتمسح مع الخروج (النسخة على الحساب فاضلة وبترجع بالدخول) */
  C.at=null; C.rt=null; C.exp=0; C.uid=''; C.email=''; C.name=''; C.avatar=''; C.need=0; save();
  if(t) req('POST','/auth/v1/logout',{token:t}).catch(noop);
  IM.emit('cloud');
}
IM.cloudSignOut=function(){ cloudSignOutLocal(); };
IM.cloudState=function(){ return {on:IM.cloudOn(),signedIn:signedIn(),email:C.email||'',name:C.name||'',avatar:C.avatar||'',busy:!!busy,err:C.err||'',dirty:!!C.dirty,last:C.last||0,rev:C.rev,need:!!C.need,pre:S.get(PRE,null)?{at:S.get(PRE).at,n:S.get(PRE).n}:null,acct:!!C.acct}; };
/* للشات العايم (js/horus-chat.js): طلب بصلاحية الطالب الحالي (بيجدّد التوكن لو لزم) ومعرّفه. بيترفض بـ e.auth لو مش مسجّل دخول. */
IM.cloudCall=function(method,path,o){
  if(!IM.cloudOn()||!signedIn()){ var e=new Error('signed-out'); e.auth=1; return Promise.reject(e); }
  return call(method,path,o);
};
IM.cloudUid=function(){ return signedIn()?(C.uid||''):''; };
IM.cloudProfile=function(){ return signedIn()?{name:C.name,email:C.email,avatar:C.avatar}:null; };
IM.cloudPreData=function(){ var p=S.get(PRE,null); return p&&p.data||null; };

/* ---------- بوابة الدخول الإجباري ---------- */
IM.cloudWall=function(){
  if(!IM.cloudRequired()||signedIn()) return Promise.resolve(false);
  return providerReady().then(function(v){
    if(v!=='on'){                                                       /* جوجل مش مفعّل أو مفيش نت: ما نقفلش حد برّه */
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
  var n=countAns(), has=!!IM.st.user||hasProgress(), msg=h('p.g-msg',{role:'alert'});
  var b=h('button.btn.primary.g-go.cl-wall-btn',{type:'button',onclick:function(){
    b.disabled=true; msg.textContent='';
    IM.cloudSignIn().then(null,function(){ b.disabled=false; msg.textContent='تعذّر فتح تسجيل الدخول. جرّب تاني.'; });
  }},gIcon(),h('span',{text:has?'ادخل بحساب جوجل وكمّل':'ادخل بحساب جوجل'}));
  var kids=[
    h('div.g-mark',{html:IM.pyr(6,{anim:true})}),
    h('div.eyebrow',{text:'IMHOTEP · إمحتب'}),
    h('h1#gH.display',{text:has?'سجّل دخولك بجوجل عشان تكمّل':'ادخل بحساب جوجل'}),
    h('p.muted',{text:has
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
/* مسح الحساب وكل بياناته من السيرفر (RPC delete_my_account في supabase.sql). اللي على الجهاز بيفضل زي ما هو. */
IM.cloudDeleteAccount=function(){
  return call('POST','/rest/v1/rpc/delete_my_account',{body:{}}).then(function(r){
    if(!(r.ok||r.status===204)) throw httpErr(r);
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
  var box=h('div.cl-card');
  function draw(){
    IM.clear(box); var s=IM.cloudState();
    box.hidden=!s.signedIn&&prov==='off';                             /* جوجل مش مفعّل في Supabase: منظهرش حاجة مش هتشتغل */
    if(box.hidden) return;
    if(!s.signedIn){
      box.appendChild(h('div.cl-h',{},icon('lock',18),h('b',{text:s.need?'سجّل الدخول تاني عشان تكمّل المزامنة':'احفظ تقدّمك على حساب جوجل'})));
      box.appendChild(h('p.muted.cl-p',{text:s.need?'جلستك انتهت. تقدّمك على الجهاز زي ما هو ومش اتمسح، وأول ما تدخل تاني بيتزامن.':'تقدّمك كله بيتحفظ على حسابك وبيتزامن لوحده مع أي جهاز تدخل منه. اللي على جهازك دلوقتي بيترفع كامل ومفيش حاجة بتتمسح، والتصدير والاستيراد لسه شغّالين زي ما هم.'}));
      var b=h('button.btn.cl-gbtn',{type:'button',onclick:function(){ b.disabled=true; IM.cloudSignIn().then(function(){},function(){ b.disabled=false; IM.toast('تعذّر فتح تسجيل الدخول.',{kind:'bad'}); }); }},gIcon(),h('span',{text:'تسجيل الدخول بجوجل'}));
      box.appendChild(h('div.set-btns',{},b));
      if(s.pre) box.appendChild(preRow(s));
      return;
    }
    var st=s.busy?'بنزامن…':(s.err==='net'?'مفيش اتصال دلوقتي. التقدّم محفوظ على الجهاز وهيتزامن أول ما النت يرجع.':(s.err?'المزامنة ما كملتش دلوقتي وهنحاول تاني لوحدنا.':(s.dirty?'فيه تغييرات هتتحفظ خلال ثواني.':'متزامن · آخر مزامنة '+ago(s.last))));
    box.appendChild(h('div.cl-who',{},
      s.avatar?h('img.cl-av',{src:s.avatar,alt:'',referrerpolicy:'no-referrer'}):h('span.cl-av.ph',{text:IM.initial(s.name||s.email)}),
      h('div.cl-id',{},h('b',{text:s.name||'حساب جوجل'}),h('span.muted.mono',{dir:'ltr',text:s.email}))));
    box.appendChild(h('p.cl-st'+(s.err?'.bad':'.ok'),{role:'status'},icon(s.err?'warn':'check',15),h('span',{text:st})));
    box.appendChild(h('div.set-btns',{},
      h('button.btn.sm',{type:'button',onclick:function(){ IM.cloudSync('manual').then(function(r){ if(r==='error') IM.toast('تعذّرت المزامنة دلوقتي.',{kind:'bad'}); else IM.toast('اتزامن تقدّمك.',{icon:'check'}); }); }},icon('reset',16),'زامن دلوقتي'),
      IM.arm(h('button.btn.sm.ghost',{type:'button'}),'تسجيل الخروج',function(){ IM.cloudSignOut(); draw(); IM.toast('اتسجّل خروجك. تقدّمك على الجهاز زي ما هو.',{icon:'check'}); },'اضغط مرة أخرى للتأكيد')));
    box.appendChild(h('p.muted.cl-n',{text:'تسجيل الخروج وتصفير التقدّم بيمسحوا من الجهاز بس. نسخة حسابك بتفضل محفوظة وترجع لك أول ما تدخل تاني.'}));
    var delMsg=h('p.cl-n.bad',{role:'alert',hidden:true});
    var delBtn=IM.arm(h('button.btn.sm.ghost.cl-del',{type:'button'}),'احذف حسابي وبياناتي من السيرفر',function(){
      delBtn.disabled=true; delMsg.hidden=true;
      IM.cloudDeleteAccount().then(function(){ IM.toast('اتمسح حسابك وتقدّمك من السيرفر. اللي على جهازك لسه زي ما هو.',{icon:'check',ms:6000}); draw(); },
        function(){ delBtn.disabled=false; delMsg.textContent='تعذّر الحذف دلوقتي. اتأكد إن النت شغّال وجرّب تاني.'; delMsg.hidden=false; });
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
