/* Imhotep · إمحتب — شرح السؤال بالكتاب (ذكاء اصطناعي، من كاش مشترك جاهز)
   - الشروح بتتولّد قبل كده على دفعات (tools/ai) وبتتحط في ai/<المادة>.json. الجهاز بيقرا بس.
   - كل شرح مربوط بهاش السؤال (النص + الاختيارات + المفتاح المعتمد). لو المفتاح اتصحّح أو النص اتغيّر الشرح القديم مش بيظهر.
   - مقفولة من js/ai-config.js، ومش شغّالة في الملف الواحد (مفيش ملفات ai جنبه). */
(function(){
'use strict';
var IM=window.IM, h=IM.h, icon=IM.icon;
var CFG=IM.AI||{on:false,base:'ai/'};

/* ---------- نفس بصمة السؤال في tools/ai/imai/util.py (لازم يفضلوا متطابقين) ---------- */
function ws(s){ return String(s==null?'':s).replace(/\s+/g,' ').trim(); }
function fingerprint(Q){
  var p=[ws(Q.stem)];
  Q.opts.forEach(function(o){ p.push(o.o+':'+ws(o.t)); });
  p.push('K:'+Q.keys.slice().sort().join(','));
  return p.join('\n');
}
function fnv(str){
  var b=new TextEncoder().encode(str), x=0x811c9dc5;
  for(var i=0;i<b.length;i++){ x^=b[i]; x=Math.imul(x,0x01000193)>>>0; }
  return ('00000000'+x.toString(16)).slice(-8);
}
IM.aiHash=function(Q){ return fnv(fingerprint(Q)); };
IM.aiOn=function(){ return !!(CFG.on && IM.bank && !IM.bank.single); };

/* ---------- تحميل ملف المادة مرة واحدة ---------- */
var files={};
function load(sid){
  if(!files[sid]) files[sid]=fetch((CFG.base||'ai/')+sid+'.json').then(function(r){ return r.ok?r.json():null; }).catch(function(){ return null; });
  return files[sid];
}
IM.aiEntry=function(Q){
  return load(Q.sid).then(function(f){
    var e=f&&f.items&&f.items[Q.id];
    return (e&&e.h===IM.aiHash(Q))?e:null;
  });
};

/* ---------- العرض ---------- */
var STATUS={
  verified:{cls:'ok',ic:'book',t:'اتأكدنا من الكتاب'},
  answer_conflict:{cls:'fix',ic:'scale',t:'تعارض مع الكتاب'},
  knowledge_only:{cls:'doubt',ic:'info',t:'من المعرفة الطبية العامة'}
};
function letter(s){ return String(s||'').toUpperCase(); }
function para(label,text){
  if(!text) return null;
  return h('div.ai-sec',{},h('h4',{text:label}),h('p',{dir:'auto',text:text}));
}
/* نبرة حورس: جملة افتتاحية في أول الشرح وجملة تشجيع في آخره. بتتركّب هنا في الموقع مش جوه الشرح المخزّن،
   لأن الشرح مشترك بين كل الطلبة ومايعرفش الطالب ده جاوب صح ولا غلط. الاختيار من كل مجموعة ثابت للسؤال الواحد. */
var HELLO=['بص يا دكترة','تعالى نشوفها سوا يا دكترة','ركّز معايا يا دكترة','بص معايا يا دكترة'];
var CLOSE={
  ok:['برافو يا دكترة، إجابتك طلعت صح. كمّل كده!','حلو أوي يا دكترة، ماشي في الطريق الصح.','عاش يا دكترة! كمّل على نفس المستوى.'],
  bad:['مفيش مشكلة يا دكترة، الغلطة دي هي اللي بتثبّت المعلومة، وبإذن الله المرة الجاية تجاوبها صح.','ولا يهمّك يا دكترة، كل سؤال بتغلط فيه وتفهمه بيتحسب مذاكرة. كمّل!','بقت معاك دلوقتي يا دكترة. المرة الجاية بإذن الله هتبقى صح.'],
  mid:['كمّل يا دكترة، كل سؤال بتفهمه بيقرّبك خطوة من النجاح.','ربنا يوفّقك يا دكترة، كمّل بنفس الهمّة.','إحنا معاك يا دكترة، كمّل لحد ما تخلّص.']
};
function pickOf(pool,Q){ var k=String(Q&&Q.id!=null?Q.id:''), n=0; for(var i=0;i<k.length;i++) n=(n*31+k.charCodeAt(i))>>>0; return pool[n%pool.length]; }
function say(Q,e){
  var hi=pickOf(HELLO,Q), L=letter(e.ca), p=h('p.ai-say',{dir:'auto'});
  var T=function(t){ p.appendChild(document.createTextNode(t)); }, B=function(){ p.appendChild(h('b.mono.ai-ca',{text:L})); };
  if(e.st==='knowledge_only'){
    T(hi+'، الكتاب اللي معايا مفيهوش تفصيل للموضوع ده، فهشرحهالك من المعرفة الطبية العامة'); if(L){ T('، والإجابة الأرجح '); B(); } T('. تعالى نشوف ليه:');
  } else if(e.st==='answer_conflict'){
    T(hi+'، الكتاب هنا مخالف لمفتاح الموقع. بناءً على الكتاب الإجابة هتبقى '); if(L) B(); T('، وده السبب:');
  } else if(L){
    T(hi+'، بناءً على الكتاب الإجابة الصح هتبقى '); B(); T('، وده السبب:');
  } else { T(hi+'، تعالى نشوف الكتاب بيقول إيه في السؤال ده:'); }
  return p;
}
function closing(Q,e,r){
  var k=(e.st==='answer_conflict'||!r||r.ok==null)?'mid':(r.ok?'ok':'bad');
  return h('p.ai-close',{dir:'auto'},icon('award',16),h('span',{text:pickOf(CLOSE[k],Q)}));
}
function panel(Q,e,r){
  var st=STATUS[e.st]||STATUS.knowledge_only;
  var el=h('div.ai-panel'+(e.st==='answer_conflict'?'.conf':(e.st==='verified'?'.ver':'')),{});
  el.appendChild(h('div.ai-hd',{},
    h('span.hz-w',{html:IM.horus?IM.horus({badge:true,size:38,state:'in idle',label:'حورس'}):''}),
    h('div.ai-id',{},h('b.ai-name',{text:'حورس'}),h('span.muted.ai-by',{text:'شرح مولّد بالذكاء الاصطناعي'})),
    h('span.chip.ai-st.'+st.cls,{},icon(st.ic,15),st.t)));
  el.appendChild(say(Q,e));
  if(e.st==='answer_conflict'){
    el.appendChild(h('div.ai-conf',{},icon('warn',16),h('span',{},'مفتاح الموقع: ',h('b.mono',{text:Q.keys.map(letter).join(' + ')||'—'}),'، والكتاب بيقول: ',h('b.mono',{text:letter(e.ca)}),'. الشرح تحت ماشي على الكتاب.')));
  }
  [para('الفكرة الأساسية',e.sm),para('ليه ده الصح',e.ce)].forEach(function(n){ if(n) el.appendChild(n); });
  if(e.oa&&e.oa.length){
    var ul=h('ul.ai-opts',{});
    e.oa.forEach(function(o){
      var c=o.s==='c'?'ok':(o.s==='x'?'conf':'no');
      ul.appendChild(h('li.ai-opt.'+c,{},h('span.ai-l.mono',{text:letter(o.o)}),h('p',{dir:'auto',text:o.e||''})));
    });
    el.appendChild(h('div.ai-sec',{},h('h4',{text:'الاختيارات واحد واحد'}),ul));
  }
  if(e.ss&&e.ss.length){
    var sl=h('ul.ai-src',{});
    e.ss.forEach(function(s){
      var meta=[s.b,s.c,s.p?('p.'+s.p):''].filter(Boolean).join(' · ');
      sl.appendChild(h('li',{},h('strong',{dir:'ltr',lang:'en',text:s.h||'Relevant section'}),meta?h('span.muted.ai-m',{dir:'ltr',lang:'en',text:meta}):null,s.q?h('blockquote',{dir:'ltr',lang:'en',text:s.q}):null));
    });
    el.appendChild(h('div.ai-sec',{},h('h4',{text:'من الكتاب'}),sl));
  }
  el.appendChild(closing(Q,e,r));
  el.appendChild(h('p.muted.ai-note',{text:'الشرح ممكن يغلط. لو لقيت حاجة مش مظبوطة بلّغ من زرار الاعتراض.'}));
  return el;
}

/* ---------- قفل الامتحانات ----------
   حورس مش متاح وقت الامتحان خالص (الساعة المائية، امتحان الترقية، التقييم الأسبوعي: كلهم mode:'water')، وبيفتح بعد التسليم بس، من شاشة المراجعة.
   القفل على طبقتين:
   1) session.js بيبعت {exam:true} لو الجلسة امتحان، وهنا بنرفض.
   2) السؤال اللي جوه امتحان لسه مفتوح (اتبدأ وماتسلّمش) بيتقفل في أي شاشة تانية كمان (البردية، المكتبة، لفافة تدريب)،
      عشان الطالب مايخرجش من الامتحان ويسأل حورس وبعدين يرجع. بيتفتح أول ما الامتحان يتسلّم أو يتشال. */
IM.examOpen=function(qid){
  var all=IM.sessions(), k, s;
  for(k in all){
    s=all[k];
    if(s&&s.state==='run'&&s.cfg&&s.cfg.mode==='water'&&!s.cfg.spectate&&s.items&&s.items.some(function(it){ return it.q===qid; })) return true;
  }
  return false;
};

/* بيتحط تحت إجابة السؤال (session.js). بيرجّع null لو الميزة مقفولة. بيظهر بس لو في شرح جاهز ومطابق للسؤال الحالي.
   o.exam: السؤال معروض جوه امتحان شغّال، فمفيش حورس. */
IM.aiBox=function(Q,r,o){
  var live=!!(IM.horusChat&&IM.horusChat.on());            /* الشات العايم (js/horus-chat.js): لو مفيش شرح جاهز للسؤال بنعرض زرار «اسأل حورس» */
  if(!IM.aiOn()&&!live) return null;
  if(o&&o.exam) return null;
  if(IM.examOpen(Q.id)){
    return h('p.muted.ai-lock',{},icon('lock',15),h('span',{text:'شرح حورس مقفول على أسئلة امتحان لسه مفتوح. سلّم الامتحان الأول وهيفتحلك.'}));
  }
  var box=h('div.ai-box',{}); box.hidden=true;
  (IM.aiOn()?IM.aiEntry(Q):Promise.resolve(null)).then(function(e){
    if(!e){
      if(!live) return;
      var ask=h('button.btn.sm.ghost.ai-go',{type:'button',onclick:function(){
        if(IM.horusChat.anyExam()||IM.examOpen(Q.id)){ IM.toast('حورس مقفول لحد ما تسلّم الامتحان.',{icon:'lock'}); return; }
        IM.horusChat.askQ(Q);
      }},h('span.hz-w',{html:IM.horus?IM.horus({badge:true,size:18}):''}),'اسأل حورس عن السؤال ده');
      box.appendChild(ask); box.hidden=false; return;
    }
    var open=false, pn=null;
    var btn=h('button.btn.sm.ghost.ai-go',{type:'button','aria-expanded':'false',onclick:function(){
      if(IM.examOpen(Q.id)){ IM.toast('شرح حورس مقفول لحد ما تسلّم الامتحان.',{icon:'lock'}); return; }
      open=!open; btn.setAttribute('aria-expanded',String(open));
      if(open&&!pn){ pn=panel(Q,e,r); box.appendChild(pn); }
      else if(open&&IM.horusState){ IM.horusState(btn.querySelector('svg'),'found'); }
      if(pn) pn.hidden=!open;
      btn.classList.toggle('on',open);
    }},h('span.hz-w',{html:IM.horus?IM.horus({badge:true,size:18}):''}),'اشرحلي بالكتاب');
    box.appendChild(btn); box.hidden=false;
  });
  return box;
};
})();
