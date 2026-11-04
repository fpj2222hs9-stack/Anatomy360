/* Imhotep · إمحتب — ui: shell, navigation, gate (account), settings, shared components */
(function(){
'use strict';
var IM=window.IM, h=IM.h, icon=IM.icon;

IM.screens={};
var NAV=[
  {id:'home',label:'الرئيسية',icon:'home',hash:'#/'},
  {id:'train',label:'التدريب',icon:'train',hash:'#/train'},
  {id:'library',label:'المكتبة',icon:'book',hash:'#/library'},
  {id:'scales',label:'ميزان الأداء',icon:'scale',hash:'#/scales'},
  {id:'papyrus',label:'البردية',icon:'papyrus',hash:'#/papyrus'}
];
IM.NAV=NAV;

/* ---------- shared bits ---------- */
IM.subClass=function(sid){ var s=IM.subject(sid); return s?s.cls:''; };
IM.subName=function(sid){ var s=IM.subject(sid); return s?s.ar:sid; };
IM.avatar=function(size){
  var u=IM.st.user, el=h('span.avatar',{'aria-label':'حسابك',style:size?{width:size+'px',height:size+'px'}:null});
  if(u&&u.photo) el.appendChild(h('img',{src:u.photo,alt:'',style:'width:100%;height:100%;border-radius:50%;object-fit:cover'}));
  else el.textContent=IM.initial(u&&u.name);
  return el;
};
IM.STATUS={
  ok:{cls:'ok',label:'معتمد',icon:'feather',text:'مفتاح الملزمة كما هو، ومفيش عليه أي ملاحظة.'},
  fix:{cls:'fix',label:'اتصحّح',icon:'scale',text:'المفتاح اتعدّل بعد مراجعة، وبيظهر شرح قصير بعد الإجابة.'},
  doubt:{cls:'doubt',label:'تحت الميزان',icon:'scale',text:'المفتاح المطبوع شكله غلط علميًا. المحسوب لك هو المطبوع، ومعاه تنبيه بالإجابة الأرجح.'},
  canc:{cls:'off',label:'ملغي',icon:'cross',text:'ملغي في جدول الملزمة. بيظهر بمفتاحه المطبوع، بس مش بيدخل التدريب ولا الاختبار.'},
  review:{cls:'doubt',label:'قيد المراجعة',icon:'eye',text:'السؤال تحت المراجعة، والمفتاح هو المطبوع في الملزمة.'},
  nokey:{cls:'off',label:'بدون مفتاح',icon:'warn',text:'مفيش مفتاح مطبوع للسؤال ده، فمش بيتحسب.'}
};
IM.statusChip=function(st){ var s=IM.STATUS[st]; return h('span.chip.'+s.cls,{title:s.text},icon(s.icon,15),s.label); };
IM.eyebrow=function(t,c){ return h('div.eyebrow'+(c?'.'+c:''),{text:t}); };
IM.section=function(title,sub,extra){ return h('div.sec-h',{},h('div',{},h('h2.display',{text:title}),sub?h('p.muted',{text:sub}):null),extra||null); };
IM.empty=function(title,text,action){ return h('div.empty.card',{},IM.h('div.empty-m',{html:IM.pyr(0,{})}),h('h3.display',{text:title}),text?h('p.muted',{text:text}):null,action||null); };
IM.go=function(hash){ if(location.hash===hash) IM.route(); else location.hash=hash; };

/* ---------- splash ---------- */
IM.splash=function(on,msg){
  var s=document.getElementById('splash'); if(!s) return;
  if(msg){ var m=s.querySelector('.sp-msg'); if(m) m.textContent=msg; }
  if(on){ s.hidden=false; s.classList.remove('out'); } else { s.classList.add('out'); setTimeout(function(){ s.hidden=true; },420); }
};

/* ---------- shell ---------- */
var viewEl=null;
IM.buildShell=function(){
  var app=document.getElementById('app'); IM.clear(app);
  var brand=h('a.brand-l',{href:'#/','aria-label':'إمحتب، الرئيسية'},
    h('span.brand-m',{html:IM.pyr(6,{})}),
    h('span.brand-t',{},h('span.latin.brand-en',{text:'Imhotep'}),h('span.display.brand-ar',{text:'إمحتب'})));
  var nav=h('nav.nav',{'aria-label':'القائمة الرئيسية'});
  NAV.forEach(function(n){ nav.appendChild(h('a',{href:n.hash,dataset:{nav:n.id}},icon(n.icon,20),h('span',{text:n.label}))); });
  var themeBtn=h('button.iconbtn',{type:'button','aria-label':'تبديل الوضع',onclick:function(){ IM.setSetting('theme',IM.isDark()?'light':'dark'); paintTheme(); }});
  function paintTheme(){ IM.clear(themeBtn); themeBtn.appendChild(icon(IM.isDark()?'sun':'moon',20)); themeBtn.setAttribute('aria-label',IM.isDark()?'الوضع النهاري':'الوضع الليلي'); }
  paintTheme(); IM.on('settings',paintTheme);
  var setBtn=h('button.iconbtn',{type:'button','aria-label':'الإعدادات',onclick:function(){ IM.settingsDialog(); }},icon('sliders',20));
  var avBtn=h('button.avbtn',{type:'button','aria-label':'حسابك',onclick:function(){ IM.settingsDialog('account'); }},IM.avatar());
  IM.on('user',function(){ IM.clear(avBtn); avBtn.appendChild(IM.avatar()); });
  var top=h('header.topbar',{},brand,nav,h('div.tools',{},themeBtn,setBtn,avBtn));
  viewEl=h('main#view.view',{tabindex:'-1'});
  var foot=h('footer.foot',{},
    h('div.foot-l',{},h('span.display',{text:'إمحتب'}),h('span.muted',{text:'من هنا بدأ الطب'})),
    h('div.foot-r',{},h('span.sig',{dir:'ltr'},h('span.sig-by',{text:'Made By'}),' ',h('span.sig-name',{text:'Dr.Saif Youssry'}))));
  var bar=h('nav.tabbar',{'aria-label':'التنقل'});
  NAV.forEach(function(n){ bar.appendChild(h('a',{href:n.hash,dataset:{nav:n.id}},icon(n.icon,22),h('span',{text:n.label}))); });
  var stage=h('div.stage',{},h('div.glow.breathe.stage-glow'),h('div.stage-dunes',{html:IM.dunes(170)}),h('div.page',{},top,viewEl,foot));
  app.appendChild(stage); app.appendChild(bar);
  return viewEl;
};
IM.setNav=function(id){ IM.$$('[data-nav]').forEach(function(a){ var on=a.getAttribute('data-nav')===id; a.classList.toggle('active',on); if(on) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current'); }); };
IM.view=function(){ return viewEl; };
/* full-screen screens (the scroll itself) hide the shell chrome */
IM.chrome=function(on){ var a=document.getElementById('app'); a.classList.toggle('bare',!on); };

/* ---------- gate: the local account ---------- */
function resizePhoto(file,cb){
  var fr=new FileReader();
  fr.onload=function(){ var im=new Image(); im.onload=function(){ var c=document.createElement('canvas'), s=256; c.width=c.height=s; var x=c.getContext('2d'), m=Math.min(im.width,im.height), sx=(im.width-m)/2, sy=(im.height-m)/2; x.drawImage(im,sx,sy,m,m,0,0,s,s); cb(c.toDataURL('image/jpeg',0.86)); }; im.onerror=function(){ cb(null) }; im.src=fr.result; };
  fr.onerror=function(){ cb(null) }; fr.readAsDataURL(file);
}
IM.gate=function(onDone){
  var gate=document.getElementById('gate'); IM.clear(gate); gate.hidden=false;
  var photo=null;
  var av=h('button.g-av',{type:'button','aria-label':'اختيار صورة'},h('span.g-plus',{text:'+'}),h('span.g-cam',{},icon('camera',16)));
  var file=h('input',{type:'file',accept:'image/*',hidden:true,onchange:function(){ var f=file.files&&file.files[0]; if(!f) return; resizePhoto(f,function(d){ if(!d) return; photo=d; IM.clear(av); av.appendChild(h('img',{src:d,alt:''})); av.appendChild(h('span.g-cam',{},icon('camera',16))); }); }});
  av.onclick=function(){ file.click(); };
  var inp=h('input.g-in',{type:'text',maxlength:24,placeholder:'اكتب اسمك',autocomplete:'off',dir:'auto','aria-label':'اسم المستخدم'});
  var msg=h('p.g-msg',{role:'alert'});
  function go(){
    var n=inp.value.replace(/\s+/g,' ').trim(); for(var i=0;i<2;i++) n=n.replace(/^(الدكتور|دكتور|dr\.?|د\.?)\s*/i,'').trim();
    if(n.length<2){ msg.textContent='اكتب اسمك (حرفين على الأقل).'; inp.focus(); return; }
    IM.setUser({name:n.slice(0,24),photo:photo,created:Date.now()});
    gate.classList.add('out'); setTimeout(function(){ gate.hidden=true; gate.classList.remove('out'); },420); onDone&&onDone();
  }
  inp.addEventListener('keydown',function(e){ if(e.key==='Enter') go(); });
  var card=h('div.g-card.rv',{role:'dialog','aria-modal':'true','aria-labelledby':'gH'},
    h('div.g-mark',{html:IM.pyr(6,{anim:true})}),
    h('div.eyebrow',{text:'IMHOTEP · إمحتب'}),
    h('h1#gH.display',{text:'أنشئ حسابك'}),
    h('p.muted',{text:'اكتب اسمك مرة واحدة فقط. يبقى محفوظًا على هذا الجهاز حتى تلغي المستخدم أو تصفّر الحساب.'}),
    av,file,h('div.g-hint',{},h('b',{text:'صورة الملف الشخصي'}),h('span.muted',{text:'اختيارية، ويمكنك تغييرها لاحقًا من الإعدادات.'})),
    h('label.label',{for:'gName'},'اسم المستخدم'),inp,msg,
    h('button.btn.primary.g-go',{type:'button',onclick:go},'إنشاء الحساب',icon('next',20)),
    h('p.g-foot.muted',{},icon('lock',14),' بياناتك تبقى في هذا المتصفح فقط ولا تُرسل إلى أي مكان.'));
  inp.id='gName';
  gate.appendChild(h('div.g-art',{html:'<span class="glow breathe g-glow"></span>'+IM.dunes(180)}));
  gate.appendChild(card);
  setTimeout(function(){ inp.focus(); },350);
};

/* ---------- settings dialog ---------- */
IM.settingsDialog=function(focusSection){
  var st=IM.st.set, u=IM.st.user||{name:''};
  function seg(opts,cur,on){ var w=h('div.seg',{role:'group'}); opts.forEach(function(o){ var b=h('button',{type:'button','aria-pressed':String(cur===o[0]),text:o[1],onclick:function(){ IM.$$('button',w).forEach(function(x){x.setAttribute('aria-pressed','false')}); b.setAttribute('aria-pressed','true'); on(o[0]); }}); w.appendChild(b); }); return w; }
  function row(label,ctl,hint){ return h('div.set-r',{},h('div.set-l',{},h('b',{text:label}),hint?h('span.muted',{text:hint}):null),ctl); }
  var fsOut=h('span.mono.set-v',{text:Math.round(st.fs*100)+'%'}), brOut=h('span.mono.set-v',{text:Math.round(st.bright*100)+'%'});
  var fs=h('input.rng',{type:'range',min:85,max:135,step:5,value:Math.round(st.fs*100),'aria-label':'حجم الخط',oninput:function(){ fsOut.textContent=fs.value+'%'; IM.setSetting('fs',fs.value/100); }});
  var br=h('input.rng',{type:'range',min:70,max:115,step:5,value:Math.round(st.bright*100),'aria-label':'السطوع',oninput:function(){ brOut.textContent=br.value+'%'; IM.setSetting('bright',br.value/100); }});
  var motion=h('input.sw',{type:'checkbox',checked:st.motion==='off','aria-label':'تقليل الحركة',onchange:function(){ IM.setSetting('motion',motion.checked?'off':'auto'); }});
  var keys=h('input.sw',{type:'checkbox',checked:st.keys!==false,'aria-label':'اختصارات الكيبورد',onchange:function(){ IM.setSetting('keys',keys.checked); }});
  var reset=h('button.btn.ghost.sm',{type:'button',onclick:function(){ IM.setSetting('fs',1); IM.setSetting('bright',1); fs.value=100; br.value=100; fsOut.textContent='100%'; brOut.textContent='100%'; }},'رجّعها للأصل');
  var nameIn=h('input.g-in',{type:'text',maxlength:24,value:u.name,dir:'auto','aria-label':'الاسم'});
  var photo=u.photo||null, avBox=h('span.set-av',{},IM.avatar(56));
  var pf=h('input',{type:'file',accept:'image/*',hidden:true,onchange:function(){ var f=pf.files&&pf.files[0]; if(f) resizePhoto(f,function(d){ if(!d) return; photo=d; IM.clear(avBox); avBox.appendChild(IM.avatar(56)); IM.setUser(Object.assign({},IM.st.user,{photo:d})); IM.clear(avBox); avBox.appendChild(IM.avatar(56)); }); }});
  var saveName=h('button.btn.sm',{type:'button',onclick:function(){ var n=nameIn.value.replace(/\s+/g,' ').trim(); if(n.length<2){ IM.toast('الاسم قصير.',{kind:'bad'}); return; } IM.setUser(Object.assign({},IM.st.user,{name:n.slice(0,24)})); IM.toast('اتحفظ الاسم.',{icon:'check'}); }},'حفظ الاسم');
  var imp=h('input',{type:'file',accept:'application/json,.json',hidden:true,onchange:function(){ var f=imp.files&&imp.files[0]; if(!f) return; var r=new FileReader(); r.onload=function(){ var res=IM.importAll(String(r.result)); IM.toast(res.msg,{kind:res.ok?'':'bad',icon:res.ok?'check':'warn'}); }; r.readAsText(f); imp.value=''; }});
  var body=h('div.set',{},
    h('section',{},h('h3',{text:'المظهر'}),
      row('الوضع',seg([['auto','تلقائي'],['light','نهاري'],['dark','ليلي']],st.theme,function(v){ IM.setSetting('theme',v); })),
      row('حجم الخط',h('div.set-sl',{},fs,fsOut)),
      row('السطوع',h('div.set-sl',{},br,brOut),'للمذاكرة بالليل'),
      h('div.set-x',{},reset),
      row('تقليل الحركة',motion,'يوقف الحركات والانتقالات'),
    ),
    h('section',{},h('h3',{text:'السؤال'}),
      row('طريقة العرض',seg([['one','سؤال سؤال'],['list','قايمة']],st.layout,function(v){ IM.setSetting('layout',v); }),'تتغيّر كمان من داخل اللفافة'),
      row('اختصارات الكيبورد',keys,'1-6 أو A-F للإجابة، Enter للتالي، S للبردية، H لـ50/50، ؟ لقايمة الاختصارات')),
    h('section#set-account',{},h('h3',{text:'حسابك'}),
      h('div.set-acc',{},avBox,h('div',{style:'flex:1;min-width:0'},nameIn),h('button.btn.ghost.sm',{type:'button',onclick:function(){ pf.click(); }},icon('camera',16),'الصورة'),pf),
      h('div.set-x',{},saveName)),
    h('section',{},h('h3',{text:'تقدّمك'}),
      h('p.muted',{text:'كل تقدّمك محفوظ على الجهاز ده بس. خدلك نسخة لو هتغيّر الجهاز أو المتصفح.'}),
      h('div.set-btns',{},
        h('button.btn.sm',{type:'button',onclick:function(){ IM.download('imhotep-progress-'+IM.dayKey()+'.json',IM.exportAll()); }},icon('download',16),'تصدير ملف'),
        h('button.btn.sm',{type:'button',onclick:function(){ imp.click(); }},icon('upload',16),'استيراد ملف'),imp,
        h('button.btn.sm.ghost',{type:'button',onclick:function(){ IM.copy(IM.exportAll()).then(function(){ IM.toast('اتنسخ التقدّم.',{icon:'check'}); },function(){ IM.toast('تعذّر النسخ.',{kind:'bad'}); }); }},'نسخ كنص'),
        h('button.btn.sm.ghost',{type:'button',onclick:function(){ pasteDialog(); }},'لصق نص')),
      h('div.set-x',{},IM.arm(h('button.btn.sm.danger',{type:'button'}),'تصفير كل تقدّمي',function(){ IM.resetAll(); location.hash='#/'; location.reload(); },'اضغط مرة أخرى لمسح كل شيء'))),
    h('section',{},h('h3',{text:'عن إمحتب'}),
      h('p.muted',{},'منصة أسئلة طبية للدفعة. كل بياناتك في متصفحك، ومفيش حسابات ولا خوادم. الأسئلة بمفاتيحها المطبوعة، وأي مفتاح اتصحّح بيظهر معلَّم.'),
      offlineRow()));
  var dlg=IM.modal({title:'الإعدادات',body:body,cls:'dlg-wide'});
  if(focusSection==='account'){ setTimeout(function(){ var s=IM.$('#set-account',dlg.box); if(s) s.scrollIntoView({block:'start'}); },60); }
};
function offlineRow(){
  if(IM.bank.single) return h('p.muted.set-off',{},'ده الملف الواحد: بيشتغل بدون إنترنت بعد ما يتفتح. الخطوط بس محتاجة إنترنت أول مرة.');
  if(location.protocol==='file:') return h('p.muted.set-off',{},'افتح الموقع من استضافة (رابط) عشان خاصية الأوفلاين تشتغل. من الملفات المباشرة بتشتغل الأسئلة بس من غير تخزين مسبق.');
  var b=h('button.btn.sm',{type:'button',onclick:function(){ b.disabled=true; b.textContent='بنفعّل…'; IM.registerSW().then(function(){ return IM.precacheAssets(); }).then(function(n){ b.textContent='الأوفلاين شغّال'; IM.toast('اتحفظ الموقع كله على الجهاز ('+n+' صورة). هيشتغل بدون إنترنت.',{icon:'check',ms:6000}); },function(e){ b.disabled=false; b.textContent='فعّل الأوفلاين'; IM.toast(String(e&&e.message||e),{kind:'bad'}); }); }},icon('download',16),'فعّل الأوفلاين');
  return h('div.set-off',{},h('p.muted',{text:'خزّن الموقع والصور على جهازك عشان يشتغل من غير إنترنت.'}),h('div.set-btns',{},b));
}
function pasteDialog(){
  var ta=h('textarea.rpt-ta',{rows:6,dir:'ltr',placeholder:'الصق نص التقدّم هنا'});
  var d=IM.modal({title:'لصق التقدّم',body:ta,foot:[h('button.btn.primary',{type:'button',onclick:function(){ var r=IM.importAll(ta.value.trim()); IM.toast(r.msg,{kind:r.ok?'':'bad',icon:r.ok?'check':'warn'}); if(r.ok) d.close(); }},'إضافة'),h('button.btn.ghost',{type:'button',onclick:function(){ d.close(); }},'إلغاء')]});
}
})();
