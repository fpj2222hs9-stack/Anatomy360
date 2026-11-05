/* Imhotep · إمحتب — router and boot */
(function(){
'use strict';
var IM=window.IM, h=IM.h;
IM.MAINTENANCE=false;     /* flip to true to close the site behind a notice */
var current=null;

IM.route=function(){
  var hash=location.hash||'#/', parts=hash.replace(/^#\/?/,'').split('/').filter(Boolean).map(decodeURIComponent);
  var name=parts[0]||'home', params=parts.slice(1);
  var map={home:'home',train:'workshop',run:'session',result:'result',library:'library',scales:'scales',papyrus:'papyrus',corrections:'corrections',audit:'audit',mixed:'mixed',about:'about'};
  var navOf={home:'home',train:'train',run:'train',result:'train',library:'library',scales:'scales',papyrus:'papyrus',corrections:'home',audit:'scales',mixed:'train',about:'none'};
  var key=map[name]||'home';
  if(current&&current.destroy){ try{ current.destroy(); }catch(e){} }
  current=null;
  var view=IM.view(); if(!view) return;
  IM.clear(view); IM.chrome(true); document.body.classList.remove('lock');
  IM.setNav(navOf[name]||'home');
  var fn=IM.screens[key];
  try{ current=fn(view,params)||null; }catch(e){ try{console.error(e)}catch(_){} view.appendChild(h('div.card.pad',{},h('h2.display',{text:'حصلت مشكلة'}),h('p.muted',{text:String(e&&e.message||e)}),h('a.btn',{href:'#/'},'الرئيسية'))); }
  window.scrollTo(0,0);
  document.title=(IM.titles[key]||'إمحتب')+' — إمحتب';
};
IM.titles={home:'الرئيسية',workshop:'ورشة الألواح',session:'اللفافة',result:'نتيجة اللفافة',library:'المكتبة',scales:'ميزان الأداء',papyrus:'البردية',corrections:'تصحيحات المفاتيح',audit:'فحص الداتا',mixed:'اللفافة الشاملة',about:'عن إمحتب'};

function fail(e){
  IM.splash(false);
  var app=document.getElementById('app'); app.hidden=false; IM.clear(app);
  app.appendChild(h('div.fatal',{},IM.pyrEl(0,{}),h('h1.display',{text:'تعذّر تحميل الأسئلة'}),h('p.muted',{text:'لو بتفتح الملف من الجهاز مباشرة جرّب تفتحه من استضافة، أو تأكد إن ملفات المواد جنب index.html.'}),h('p.mono',{dir:'ltr',text:String(e&&e.message||e)}),h('button.btn.primary',{type:'button',onclick:function(){ location.reload(); }},'إعادة المحاولة')));
}

function maintenance(){
  var m=document.getElementById('maint'); if(!m) return false;
  m.hidden=false; IM.splash(false); return true;
}

function start(){
  IM.applySettings();
  if(IM.MAINTENANCE&&maintenance()) return;
  IM.splash(true,'بنجهّز الأسئلة…');
  IM.loadBank(function(meta){ IM.splash(true,'بنفتح '+meta.ar+'…'); }).then(function(){
    IM.migrateOld();
    IM.buildShell();
    var app=document.getElementById('app'); app.hidden=false;
    function enter(){
      IM.route(); IM.splash(false);
      if(IM.tourMaybe) IM.tourMaybe();
      var pend=IM.pendingNotices();
      if(pend.length) setTimeout(function(){ IM.toast('اتصحّح مفتاح '+pend.length+' سؤال جاوبته قبل كده.',{icon:'scale',ms:7000,action:{label:'شوفهم',fn:function(){ IM.go('#/corrections'); }}}); },900);
    }
    if(!IM.st.user){ IM.splash(false); IM.gate(function(){ enter(); }); }
    else enter();
    window.addEventListener('hashchange',IM.route);
    IM.on('settings',function(){});
    IM.on('seal',function(n){ IM.toast('ختمت '+n+' إجابة! اتضاف ختم جديد في ميزان الأداء.',{icon:'feather',ms:6000}); });
    document.addEventListener('keydown',function(e){ if(e.key==='?'&&!/INPUT|TEXTAREA|SELECT/.test((e.target||{}).tagName||'')&&IM.shortcutsHelp&&!document.querySelector('.ov')){ IM.shortcutsHelp(); } });
  }).catch(fail);
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start); else start();

/* download every book image once so the library works offline (the service worker keeps them) */
IM.precacheAssets=function(){
  var seen={}, list=[];
  function add(p){ if(p&&p.indexOf('assets/')===0&&!seen[p]){ seen[p]=1; list.push(p); } }
  Object.keys(IM.bank.subs).forEach(function(sid){
    var S=IM.bank.subs[sid];
    S.chapters.forEach(function(c){ var m=c.html.match(/assets\/[A-Za-z0-9_\/.-]+\.(?:webp|png|jpe?g|svg|gif)/g); (m||[]).forEach(add); });
    S.qids.forEach(function(id){ add(IM.bank.q[id].fig); });
  });
  var i=0, done=0;
  function worker(){ if(i>=list.length) return Promise.resolve(); var p=list[i++]; return fetch(p).then(function(){ done++; },function(){}).then(worker); }
  return Promise.all([worker(),worker(),worker(),worker()]).then(function(){ return done; });
};
/* an offline layer, when sw.js sits beside index.html */
IM.registerSW=function(){
  if(!('serviceWorker' in navigator)) return Promise.reject(new Error('المتصفح لا يدعم العمل بدون إنترنت'));
  return navigator.serviceWorker.register('sw.js');
};
})();
