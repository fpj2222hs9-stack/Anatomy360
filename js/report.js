/* Imhotep · إمحتب — objecting to a key (اعتراض على المفتاح).
   Same contract as the previous site, so the existing Apps Script / sheet / e-mail keep working:
   POST (no-cors, form-encoded) → subject, chapter, qid, type, stem, picked, key, note, name, whatsapp.
   Local keys are kept as mg_rep_* so nothing already sent is forgotten. */
(function(){
'use strict';
var IM=window.IM, h=IM.h, icon=IM.icon;
var URL_='https://script.google.com/macros/s/AKfycbxHrZRleveNm28i6ZjMZsMRNTNJzKQENOuRvXMY57ReRvP7ZiUvQUGkQlazKLkK8UCk/exec';
var K_SENT='mg_rep_sent', K_DAY='mg_rep_day', K_Q='mg_rep_q', K_T='mg_rep_t', K_W='mg_rep_w', K_L='mg_rep_last';
var DAY_MAX=15, GAP_MS=3000, NOTE_MAX=400, NAME_MAX=40, QUEUE_MAX=20;
var TYPES=[
  {v:'wrong',t:'الإجابة الصحيحة المعلَّمة غلط'},
  {v:'stem',t:'خطأ في نص السؤال'},
  {v:'opts',t:'خطأ في الاختيارات'},
  {v:'other',t:'مشكلة تانية'}
];
var TYPE_LABEL={wrong:'wrong answer key',stem:'error in question text',opts:'error in options',other:'other'};
var S=IM.store;
function raw(k){ try{ return localStorage.getItem(k) }catch(e){ return null } }
function put(k,v){ try{ localStorage.setItem(k,v) }catch(e){} }
function jget(k,d){ try{ var v=JSON.parse(raw(k)); return (v&&typeof v==='object')?v:d }catch(e){ return d } }
function clip(s,n){ s=String(s==null?'':s).replace(/\s+\n/g,'\n').replace(/[ \t]+/g,' ').trim(); return s.length>n?s.slice(0,n):s; }
function safe(s){ s=String(s==null?'':s); return /^[=+\-@]/.test(s)?'· '+s:s; }  /* no formulas in the sheet */
function today(){ var d=new Date(); return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); }

/* WhatsApp number: Egyptian mobile (01012345678 / +20… / 0020…) or international (+code…); returns '' if invalid */
function waNorm(rawv){
  var s=String(rawv==null?'':rawv), out='', i, c, k, ar='٠١٢٣٤٥٦٧٨٩', fa='۰۱۲۳۴۵۶۷۸۹';
  for(i=0;i<s.length;i++){ c=s.charAt(i); k=ar.indexOf(c); if(k<0) k=fa.indexOf(c); out+=k>=0?String(k):c; }
  out=out.replace(/[\s\-().‎‏‪-‮٫٬]/g,'');
  if(/^00/.test(out)) out='+'+out.slice(2);
  var m;
  if((m=out.match(/^\+?20(1[0125]\d{8})$/))) out='+20'+m[1];
  else if((m=out.match(/^0(1[0125]\d{8})$/))) out='+20'+m[1];
  else if((m=out.match(/^(1[0125]\d{8})$/))) out='+20'+m[1];
  else if(!/^\+[1-9]\d{7,14}$/.test(out)) return '';
  if(/^\+20/.test(out)&&!/^\+201[0125]\d{8}$/.test(out)) return '';
  if(/(\d)\1{7,}$/.test(out)) return '';
  return out;
}
IM.waNorm=waNorm;

function sentKey(Q){ return Q.sid+':'+Q.id; }
IM.reported=function(Q){ return !!jget(K_SENT,{})[sentKey(Q)]; };

function post(p){
  var b=new URLSearchParams(), k;
  for(k in p) if(Object.prototype.hasOwnProperty.call(p,k)) b.append(k,p[k]);
  return fetch(URL_,{method:'POST',mode:'no-cors',body:b,keepalive:true});
}
function queue(p){ var q=jget(K_Q,[]); if(!Array.isArray(q)) q=[]; q.push(p); if(q.length>QUEUE_MAX) q=q.slice(q.length-QUEUE_MAX); put(K_Q,JSON.stringify(q)); }
var flushing=false;
function flushQ(){
  if(flushing) return; var q=jget(K_Q,[]); if(!Array.isArray(q)||!q.length) return; if(navigator.onLine===false) return;
  flushing=true;
  (function next(){
    var q2=jget(K_Q,[]); if(!Array.isArray(q2)||!q2.length){ flushing=false; return; }
    post(q2[0]).then(function(){ q2.shift(); put(K_Q,JSON.stringify(q2)); setTimeout(next,400); },function(){ flushing=false; });
  })();
}
window.addEventListener('online',flushQ);
setTimeout(flushQ,4000);

IM.reportDialog=function(Q,picked){
  if(IM.reported(Q)){ IM.toast('بعتّ بلاغ عن السؤال ده قبل كده.'); return; }
  var sec=IM.bank.subs[Q.sid].secs[Q.sec], busy=false, dlg;
  var types=h('fieldset.rpt-fs',{},h('legend.label',{text:'نوع المشكلة'}));
  TYPES.forEach(function(x,i){ types.appendChild(h('label.rpt-opt',{},h('input',{type:'radio',name:'rptType',value:x.v,checked:i===0,onchange:sync}),h('span',{text:x.t}))); });
  var prev=(Q.tags[0]?'['+Q.tags[0]+'] ':'')+Q.stem;
  var q=h('p.rpt-q',{dir:'ltr',lang:'en',text:prev.length>170?prev.slice(0,170)+'…':prev});
  var sugB=h('div.rpt-chips'), sug=h('div.rpt-sug',{hidden:true},h('span.label',{text:'الإجابة الصحيحة في رأيك:'}),sugB);
  Q.opts.slice(0,6).forEach(function(o){ sugB.appendChild(h('button.tog',{type:'button','aria-pressed':'false',dataset:{o:o.o},onclick:function(){ var on=this.getAttribute('aria-pressed')==='true'; IM.$$('button',sugB).forEach(function(b){ b.setAttribute('aria-pressed','false'); b.classList.remove('on'); }); if(!on){ this.setAttribute('aria-pressed','true'); this.classList.add('on'); } }},o.o.toUpperCase())); });
  var note=h('textarea.field-i',{rows:3,maxlength:NOTE_MAX,dir:'auto','aria-label':'ملاحظة'});
  var name=h('input.field-i',{type:'text',maxlength:NAME_MAX,autocomplete:'off',dir:'auto',value:String(raw(K_T)||'').slice(0,NAME_MAX)});
  var wa=h('input.field-i.rpt-wa',{type:'tel',inputmode:'tel',maxlength:20,autocomplete:'tel',dir:'ltr',placeholder:'01012345678',value:waNorm(raw(K_W)),'aria-required':'true',oninput:function(){ wa.removeAttribute('aria-invalid'); if(msg.classList.contains('bad')) setMsg(''); }});
  var hp=h('input.rpt-hp',{type:'text',name:'website',tabindex:'-1',autocomplete:'off','aria-hidden':'true'});
  var msg=h('p.rpt-msg',{role:'status'});
  function setMsg(t,bad){ msg.textContent=t||''; msg.className='rpt-msg'+(bad?' bad':''); }
  function curType(){ var r=IM.$('input[name="rptType"]:checked',types); return r?r.value:'other'; }
  function sync(){ sug.hidden=curType()!=='wrong'; if(msg.classList.contains('bad')) setMsg(''); }
  var send=h('button.btn.primary',{type:'button',onclick:submit},'إرسال البلاغ');
  var body=h('div.form.rpt',{},q,types,sug,
    h('label.label',{text:'ملاحظة (اختيارية، تفيد لو كتبت إيه الصح ومصدرك)'}),note,
    h('label.label',{text:'اسمك (اختياري)'}),name,
    h('label.label',{},'رقم واتساب للتواصل ',h('span.rpt-req',{'aria-hidden':'true',text:'*'}),h('span.muted',{text:' (إجباري)'})),wa,
    h('p.muted.rpt-hint',{text:'الرقم بيوصل لمسؤول الموقع بس، ومش بيظهر لأي حد، وبنستخدمه عشان نتواصل معاك بخصوص البلاغ لو احتجنا.'}),
    hp,msg);
  dlg=IM.modal({title:'اعتراض على المفتاح',body:body,foot:[send,h('button.btn.ghost',{type:'button',onclick:function(){ dlg.close(); }},'إلغاء')],focus:'input[name="rptType"]'});
  sync();

  function submit(){
    if(busy) return;
    var type=curType(), nt=clip(note.value,NOTE_MAX), nm=clip(name.value,NAME_MAX), sg=IM.$('button[aria-pressed="true"]',sugB);
    if(hp.value){ setMsg('تم إرسال البلاغ. شكرًا لمساعدتك!'); setTimeout(dlg.close,900); return; }
    if(type==='other'&&nt.length<3){ setMsg('اكتب سطر يوضح المشكلة.',true); return; }
    var w=waNorm(wa.value);
    if(!w){ wa.setAttribute('aria-invalid','true'); setMsg(clip(wa.value,20)?'رقم الواتساب غير صحيح. اكتبه كده: 01012345678 أو +201012345678':'رقم الواتساب إجباري عشان نقدر نتواصل معاك بخصوص البلاغ.',true); try{ wa.focus(); }catch(e){} return; }
    var now=Date.now(), last=+raw(K_L)||0;
    if(now-last<GAP_MS){ setMsg('استنى ثواني وجرّب تاني.',true); return; }
    var day=jget(K_DAY,{}); if(day.d!==today()) day={d:today(),n:0};
    if(day.n>=DAY_MAX){ setMsg('وصلت للحد اليومي من البلاغات. جرّب بكرة.',true); return; }
    var stemAll=Q.stem; Q.opts.forEach(function(o){ stemAll+='\n'+o.o+') '+o.t; });
    var full=(sg?'Suggested answer: '+sg.getAttribute('data-o')+(nt?' | ':''):'')+nt;
    var chap=(Q.groups&&Q.groups[0]?Q.groups[0]+' ':'')+(sec?sec.en:'');
    var p={subject:safe(Q.sid),chapter:safe(chap.trim()),qid:safe(Q.id),type:TYPE_LABEL[type]||type,stem:safe(clip(stemAll,1500)),picked:safe(picked||'-'),key:safe(Q.bk||Q.keys.join(',')||'-'),note:safe(full),name:safe(nm),whatsapp:w};
    busy=true; send.disabled=true; setMsg('جاري الإرسال…');
    put(K_L,String(now)); put(K_T,nm); put(K_W,w);
    function done(queued){
      var s=jget(K_SENT,{}); s[sentKey(Q)]=now; put(K_SENT,JSON.stringify(s));
      day.n++; put(K_DAY,JSON.stringify(day));
      setMsg(queued?'اتحفظ البلاغ وهيتبعت أول ما النت يرجع. شكرًا!':'تم إرسال البلاغ. شكرًا لمساعدتك!');
      IM.emit('reported',Q);
      setTimeout(dlg.close,1300);
    }
    if(navigator.onLine===false){ queue(p); done(true); return; }
    post(p).then(function(){ done(false); },function(){ queue(p); done(true); });
  }
};
})();
