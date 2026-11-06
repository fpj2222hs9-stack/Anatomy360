/* Imhotep · إمحتب — جولة أول مرة: تظليل المربع أو الزرار أو المنطقة + بوكس بيشرح استخدامها.
   إضافة فقط: بتقرأ الصفحة وما بتغيّرش فيها حاجة، وبتحفظ علامة واحدة (im_seen → tour-v1) عشان تظهر مرة واحدة لكل مستخدم. */
(function(){
'use strict';
var IM=window.IM, h=IM.h, icon=IM.icon;
var FLAG='tour-v1';
var T=null;                                   /* the running tour, or null */

function q(s){ return typeof s==='function'?s():document.querySelector(s); }
function vis(el){ if(!el||!el.isConnected) return false; var r=el.getBoundingClientRect(); if(r.width<4||r.height<4) return false; var cs=getComputedStyle(el); return cs.visibility!=='hidden'&&cs.display!=='none'; }
function mobile(){ return window.innerWidth<=760; }
function normHash(x){ return String(x||'').replace(/^#\/?/,''); }
function atRoute(route){ return normHash(location.hash)===normHash(route); }
function nth(sel,n){ return function(){ var all=document.querySelectorAll(sel); return all[n]||null; }; }
function tilesBox(){ var t=document.querySelector('#view .tiles'); return t&&t.parentNode; }

/* ---------- the steps ---------- */
var STEPS=[
  {id:'welcome',center:true,mark:true,title:'أهلًا بيك في إمحتب الجديد',
   text:'الموقع اتبنى من أول وجديد بشكل وميزات أكتر. الأسئلة هي هي بمفاتيحها زي ما كانت، وتقدّمك وإجاباتك وكل بياناتك محفوظة ومتلمستش.',
   label:'الجولة',uses:['دقيقة تقريبًا وتعرف مكان كل حاجة','تقدر تتخطّاها في أي وقت، وتشوفها تاني من الإعدادات']},

  {id:'nav',route:'#/',sel:['.topbar .nav','.tabbar'],icon:'menu',title:'القايمة الرئيسية',
   text:'من هنا بتتنقل بين أقسام الموقع الخمسة، وهتلاقيها معاك في أي صفحة.',
   uses:['التدريب: ورشة الألواح وبدء اللفافات','المكتبة: نص الكتاب بالصور والبطاقات','ميزان الأداء: هرمك وإحصائياتك','البردية: أسئلتك المحفوظة وكفّة الأغلاط']},

  {id:'cta',route:'#/',sel:['.hero-cta'],icon:'play',title:'ابدأ لفافتك',
   text:'اللفافة هي جلسة الحل بتاعتك. من هنا بتدخل ورشة الألواح وتختار المادة والفصول.',
   uses:['«ابدأ لفافة جديدة» بتفتح ورشة الألواح','«كمّل آخر لفافة» بترجّعك لحيث وقفت لو سبت لفافة نص الطريق','«لفافة شاملة» بتخلّط أسئلة من كل المواد في لفافة واحدة']},

  {id:'pyr',route:'#/',sel:['.hero-pyr'],icon:'peak',title:'هرمك',
   text:'كل مادة ليها هرم من 6 درجات، وبتبدّل بين المواد من الأزرار تحته.',
   uses:['كل سدس من أسئلة المادة بتخلّصه بيزوّدك درجة','الرقم تحت الهرم بيقولك فاضل كام سؤال للدرجة الجاية']},

  {id:'cards',route:'#/',sel:['.cards3'],icon:'sun',title:'الشروق والقمة الجاية والميزان',
   text:'تلات كروت بتتابع بيهم التزامك ومستواك أول بأول.',
   uses:['الشروق: 50 إجابة في اليوم بتطلّع الشمس، والأيام المتتالية بتبني سلسلة','القمة الجاية: حدّد امتحانك وتاريخه وإمحتب يحسب لك أسئلة اليوم','ميزان الأداء: نسبة صحتك في كل مادة، ورابط كفّة الأغلاط']},

  {id:'carto',route:'#/cartouche',sel:['.cp-hero'],icon:'award',title:'خرطوشتك ومؤشر إمحتب',
   text:'اسمك جوه خرطوشة بتتزخرف مع كل مرحلة توصلها، وبتفضل ليك مهما حصل.',
   uses:['مؤشر إمحتب من 100 بيتحسب من تثبيتك للأسئلة ودقتك وانتظامك وتحسّنك','ست مراحل من SCRIBE لحد IMHOTEP، والترقية من VIZIER وفوق ليها امتحان بالساعة المائية','حمّلها كصورة وشاركها، وشارتها بتظهر في الرئيسية وحوالين صورتك']},

  {id:'modes',route:'#/train',sel:['.ws .modes'],icon:'train',title:'طريقة التدريب',
   text:'اختار الأسلوب اللي يناسبك قبل ما تبدأ.',
   uses:['تدريب الألواح: بالترتيب وكل إجابة بتتصحّح فورًا','خلط الرمال: أسئلة متخلطة والأضعف عندك بيظهر أكتر','الساعة المائية: امتحان بوقت ومفيش تصحيح غير في الآخر']},

  {id:'tiles',route:'#/train',sel:[tilesBox],mob:['.ws .ws-th'],icon:'grid',title:'الألواح والأقسام',
   text:'اللوح هو الفصل. دوس على اللوح تختاره كله، أو افتح أقسامه واختار منها.',
   uses:['«اختار الكل» و«امسح» بيسرّعوا الاختيار','على كل لوح عدد أسئلته ومستوى هرمه','تحتهم: فلتر المصدر، وتخطّي المكرر، ووضع المشاهدة']},

  {id:'aside',route:'#/train',sel:['.ws-aside'],icon:'papyrus',title:'لفافتك',
   text:'ملخص اللي هتبدأ بيه، وفيه كل التحكم في حجم اللفافة.',
   uses:['اختار عدد الأسئلة: 20 أو 40 أو 80 أو الكل','لو في لفافة محفوظة بيظهر زرار الاستئناف','تقدر تطبع الأسئلة PDF أو تحفظها في البردية قبل ما تبدأ']},

  {id:'go',route:'#/train',sel:['.ws-aside .go'],icon:'play',title:'جوه اللفافة',
   text:'أول ما تدوس «ابدأ لفافة» بتفتح شاشة السؤال، وفيها أدوات تساعدك.',
   uses:['1-6 أو A-F تختار الإجابة، وEnter للتالي','H يشيل إجابتين غلط (50/50)، وS يحفظ السؤال في البردية، وM خريطة الأسئلة','«اعترض على المفتاح» لو شايف المفتاح غلط، وعلامة ؟ بتفتح كل الاختصارات']},

  {id:'library',route:'#/library',sel:['.lib-cards .lib-c'],icon:'book',title:'المكتبة',
   text:'نص الكتاب بالحرف مع صوره، فصل فصل. كل مادة ليها كارت زي ده.',
   uses:['«اقرا الكتاب» بيفتح الفصول، وفيه وضع الاسترجاع اللي بيطمّس النص عشان تختبر نفسك','«البطاقات»: مراجعة سريعة بـ«عرفتها» أو «لسه»، وإمحتب بيفتكر','علّم الفصل «مقروء» وتابع تقدّمك في القراءة']},

  {id:'scales',route:'#/scales',sel:['.sx-ov'],icon:'scale',title:'ميزان الأداء',
   text:'لوحة بتوريك مستواك في كل مادة بالأرقام.',
   uses:['الهرم ونسبة الصح وعدد اللي جاوبته، وبدّل المادة من الأزرار فوق','تحته نشاط آخر 14 يوم وأختام الإنجاز (100، 500، 1000…)','وأضعف الأقسام عندك وسجل لفافاتك']},

  {id:'papyrus',route:'#/papyrus',sel:['.pp-tabs'],icon:'papyrus',title:'البردية وكفّة الأغلاط',
   text:'تبويبين لمراجعتك، وبينهم بتتنقل من هنا.',
   uses:['البردية: الأسئلة اللي علّمتها أثناء الحل','كفّة الأغلاط: اللي غلطت فيها ولسه ماجاوبتهاش صح، وبتتشال أول ما تجاوبها صح','فلتر بالمادة أو ابحث، وتدرّب عليهم بلفافة جديدة']},

  {id:'tools',route:'#/papyrus',sel:['.topbar .tools'],icon:'bell',title:'الوضع والإشعارات وحسابك',
   text:'تلات أزرار في الشريط العلوي، موجودة في كل الصفحات.',
   uses:['الهلال أو الشمس: بدّل بين الوضع الليلي والنهاري','الجرس: مركز الإشعارات والتحديثات. فيه جديد الموقع وتنبيهاتك، وبيفتكر إنت قريت إيه','الدايرة: اسمك وصورتك والإعدادات (حجم الخط والسطوع وتصدير تقدّمك والأوفلاين)']},

  {id:'finish',route:'#/',center:true,mark:true,title:'جاهز تبدأ؟',
   text:'كده عرفت مكان كل حاجة. ابدأ أول لفافة وهرمك هيبدأ يطلع.',
   label:'ملاحظات',uses:['الجولة تتعاد من: الدايرة ← الإعدادات ← عن إمحتب ← «شوف الجولة تاني»','لو لقيت مفتاح غلط، «اعترض على المفتاح» موجود جوه كل سؤال']}
];

/* ---------- navigation between the routes the steps live on ---------- */
function goTo(route,cb){
  if(!route||atRoute(route)){ cb(); return; }
  var done=false; T.nav=true;
  function fin(){ if(done) return; done=true; window.removeEventListener('hashchange',fin); setTimeout(function(){ if(T) T.nav=false; cb(); },30); }
  window.addEventListener('hashchange',fin);
  setTimeout(fin,900);
  location.hash=route;
}

/* wait until an element exists and is visible, then until its box stops moving (entrance animations, fonts) */
function findTarget(S,cb){
  var list=(mobile()&&S.mob)?S.mob:S.sel, t0=Date.now(), run=T.run;
  (function poll(){
    if(!T||T.run!==run) return;
    for(var i=0;i<list.length;i++){ var el=q(list[i]); if(vis(el)){ settle(el,run,cb); return; } }
    if(Date.now()-t0>1800){ cb(null); return; }
    setTimeout(poll,70);
  })();
}
function settle(el,run,cb){
  var last='',n=0,t0=Date.now();
  (function tick(){
    if(!T||T.run!==run) return;
    var r=el.getBoundingClientRect(), key=[r.left,r.top,r.width,r.height].map(Math.round).join();
    if(key===last) n++; else{ n=0; last=key; }
    if(n>=2||Date.now()-t0>1300) cb(el); else setTimeout(tick,80);
  })();
}

/* bring the target into the part of the screen the card leaves free */
function reveal(el,cardH){
  if(el.closest('.topbar,.tabbar')) return;
  var tb=document.querySelector('.topbar'), top=12, vh=window.innerHeight;
  if(tb){ var pos=getComputedStyle(tb).position; if(pos==='sticky'||pos==='fixed') top=tb.offsetHeight+28; }
  var bottom=mobile()?cardH+28:24, r=el.getBoundingClientRect();
  if(r.top>=top&&r.bottom<=vh-bottom) return;
  var y=Math.max(0,window.pageYOffset+r.top-top-4);
  try{ window.scrollTo({top:y,left:0,behavior:'instant'}); }catch(e){ window.scrollTo(0,y); }
}

/* ---------- the card ---------- */
function buildCard(S,i){
  var n=STEPS.length, card=T.card;
  IM.clear(card);
  var first=i===0, last=i===n-1;
  card.className='tour-card'+(S.center?' center':'');
  card.setAttribute('aria-labelledby','trT'); card.setAttribute('aria-describedby','trD');
  var ic=S.mark?h('span.tr-mark',{html:IM.pyr(6,{anim:true,size:46})}):h('span.tr-ic',{},icon(S.icon||'info',22));
  card.appendChild(h('div.tr-bar',{'aria-hidden':'true'},h('i',{style:'width:'+Math.round((i+1)/n*100)+'%'})));
  card.appendChild(h('div.tr-h',{},ic,h('div.tr-ht',{},
    h('div.tr-eb',{},'جولة إمحتب · ',h('span.mono',{dir:'ltr',text:(i+1)+' / '+n})),
    h('h2#trT.display',{text:S.title}))));
  card.appendChild(h('p#trD.tr-p',{text:S.text}));
  if(S.uses&&S.uses.length){
    card.appendChild(h('div.tr-u',{},h('b',{text:S.label||'استخدامه'}),h('ul',{},S.uses.map(function(u){ return h('li',{text:u}); }))));
  }
  var nextBtn=h('button.btn.primary.sm.tr-next',{type:'button',onclick:next},last?'يلا نبدأ':(first?'ابدأ الجولة':'التالي'),last?icon('check',18):icon('next',18));
  var foot=h('div.tr-f',{});
  if(!last) foot.appendChild(h('button.tr-skip',{type:'button',onclick:function(){ end(true); }},first?'تخطّي':'تخطّي الجولة'));
  if(!first) foot.appendChild(h('button.btn.ghost.sm.tr-prev',{type:'button',onclick:prev},icon('back',18),'السابق'));
  foot.appendChild(h('span.tr-sp'));
  foot.appendChild(nextBtn);
  card.appendChild(foot);
  card.appendChild(h('div.tr-k',{'aria-hidden':'true',text:'← التالي · → السابق · Esc تخطّي'}));
  T.next=nextBtn;
}

function placeSpot(rect,round){
  var s=T.spot;
  if(!rect){ s.classList.add('none'); s.style.left=(window.innerWidth/2)+'px'; s.style.top=(window.innerHeight/2)+'px'; s.style.width='0px'; s.style.height='0px'; return; }
  s.classList.remove('none');
  s.style.left=Math.round(rect.x)+'px'; s.style.top=Math.round(rect.y)+'px'; s.style.width=Math.round(rect.w)+'px'; s.style.height=Math.round(rect.h)+'px'; s.style.borderRadius=round+'px';
}

/* put the spotlight on the element and the card next to it */
function place(el){
  if(!T) return;
  var card=T.card, vw=window.innerWidth, vh=window.innerHeight, mob=mobile(), m=12, gap=16, pad=8;
  card.style.left=card.style.right=card.style.top=card.style.bottom=card.style.width=card.style.maxHeight=card.style.overflow='';
  card.classList.remove('arrow-up','arrow-down','arrow-left','arrow-right');
  if(mob){ card.style.left=m+'px'; card.style.right=m+'px'; card.style.width='auto'; }
  else card.style.width=Math.min(372,vw-2*m)+'px';
  var cw=card.offsetWidth, ch=card.offsetHeight;

  if(!el||!vis(el)){                                    /* no target: dim everything, card in the middle */
    placeSpot(null,0);
    if(mob){ card.style.top='auto'; card.style.bottom=m+'px'; }
    else{ card.style.left=Math.round((vw-cw)/2)+'px'; card.style.top=Math.round(Math.max(m,(vh-ch)/2))+'px'; }
    return;
  }
  var r=el.getBoundingClientRect();
  var round=(parseFloat(getComputedStyle(el).borderTopLeftRadius)||6)+pad*0.6; round=Math.max(8,Math.min(24,round));
  var x=r.left-pad, y=r.top-pad, w=r.width+pad*2, hh=r.height+pad*2;

  if(mob){
    var dockTop=!!el.closest('.tabbar');
    if(!dockTop&&vh-(y+hh)<ch+m+10&&y>=ch+m+10) dockTop=true;      /* no room below it (page can't scroll further): card goes to the top */
    if(dockTop){ card.style.top=Math.max(m,8)+'px'; card.style.bottom='auto'; }
    else{ card.style.top='auto'; card.style.bottom=m+'px'; var lim=vh-ch-m-12; if(y+hh>lim) hh=Math.max(40,lim-y); }
    if(y<4){ hh+=y-4; y=4; }
    placeSpot({x:Math.max(4,x),y:y,w:Math.min(w,vw-8),h:hh},round);
    return;
  }

  var space={bottom:vh-(y+hh),top:y,right:vw-(x+w),left:x}, side, cx, cy;
  function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
  if(space.bottom>=ch+gap+m) side='bottom';
  else if(space.top>=ch+gap+m) side='top';
  else if(space.right>=cw+gap+m||space.left>=cw+gap+m) side=space.right>=space.left?'right':'left';
  else{
    var free=Math.max(space.bottom,space.top)-gap-m;     /* no room for the whole card: shrink it into the roomier side and let it scroll */
    if(free>=140){ side=space.bottom>=space.top?'bottom':'top'; ch=Math.floor(free); card.style.maxHeight=ch+'px'; card.style.overflow='auto'; }
    else side='over';
  }
  var shrunk=!!card.style.maxHeight;
  if(side==='bottom'||side==='top'){
    cx=clamp(x+w/2-cw/2,m,vw-cw-m); cy=side==='bottom'?y+hh+gap:y-gap-ch;
    if(!shrunk){ card.classList.add(side==='bottom'?'arrow-up':'arrow-down'); card.style.setProperty('--ax',clamp(x+w/2-cx,24,cw-24)+'px'); }
  }else if(side==='right'||side==='left'){
    cx=side==='right'?x+w+gap:x-gap-cw; cy=clamp(y+hh/2-ch/2,m,vh-ch-m);
    card.classList.add(side==='right'?'arrow-left':'arrow-right'); card.style.setProperty('--ay',clamp(y+hh/2-cy,24,ch-24)+'px');
  }else{                                              /* hardly any room (very short window): card on the far side, spotlight trimmed so it never sits under the card */
    cx=clamp(x+w/2-cw/2,m,vw-cw-m);
    if(y+hh/2<vh/2){ cy=vh-ch-m; if(y+hh>cy-12) hh=Math.max(40,cy-12-y); }
    else{ cy=m; var cb=cy+ch+12; if(y<cb){ var d=Math.min(cb-y,hh-40); y+=d; hh-=d; } }
  }
  card.style.left=Math.round(cx)+'px'; card.style.top=Math.round(cy)+'px';
  placeSpot({x:x,y:y,w:w,h:hh},round);
}

/* ---------- running ---------- */
function show(i,fromStart){
  if(!T) return;
  var S=STEPS[i], run=++T.run; T.i=i; T.el=null;
  T.card.classList.remove('on');
  function go(){
    if(!T||T.run!==run) return;
    try{
      goTo(S.route,function(){
        if(!T||T.run!==run) return;
        buildCard(S,i);
        if(S.center||!S.sel){ T.el=null; T.spot.classList.add('glide'); place(null); reveal2(); return; }
        findTarget(S,function(el){
          if(!T||T.run!==run) return;
          T.el=el; T.S=S;
          if(el) reveal(el,T.card.offsetHeight);
          T.spot.classList.add('glide'); place(el); reveal2();
        });
      });
    }catch(e){ try{console.error(e)}catch(_){} end(true); }
  }
  function reveal2(){
    clearTimeout(T.gl); T.gl=setTimeout(function(){ if(T) T.spot.classList.remove('glide'); },520);
    requestAnimationFrame(function(){ if(!T) return; T.card.classList.add('on'); try{ T.next.focus({preventScroll:true}); }catch(e){} });
  }
  if(fromStart) go(); else setTimeout(go,120);
}
function next(){ if(!T) return; if(T.i>=STEPS.length-1) end(false); else show(T.i+1); }
function prev(){ if(!T||T.i<=0) return; show(T.i-1); }

function onKey(e){
  if(!T) return;
  var k=e.key, act=document.activeElement, onBtn=act&&act.tagName==='BUTTON'&&T.card.contains(act);
  if(k==='Escape'){ e.preventDefault(); e.stopImmediatePropagation(); end(true); return; }
  if(k==='ArrowLeft'){ e.preventDefault(); e.stopImmediatePropagation(); next(); return; }
  if(k==='ArrowRight'){ e.preventDefault(); e.stopImmediatePropagation(); prev(); return; }
  if(k==='Tab'){
    e.stopImmediatePropagation();
    var f=Array.prototype.slice.call(T.card.querySelectorAll('button')); if(!f.length) return;
    var a=f[0], z=f[f.length-1];
    if(!T.card.contains(act)){ e.preventDefault(); a.focus(); }
    else if(e.shiftKey&&act===a){ e.preventDefault(); z.focus(); }
    else if(!e.shiftKey&&act===z){ e.preventDefault(); a.focus(); }
    return;
  }
  if((k==='Enter'||k===' ')&&!onBtn){ e.preventDefault(); e.stopImmediatePropagation(); next(); return; }
  if(k==='Enter'||k===' ') { e.stopImmediatePropagation(); return; }
  if(!e.ctrlKey&&!e.metaKey&&!e.altKey) { e.stopImmediatePropagation(); if(k==='?') e.preventDefault(); }
}
function onResize(){ if(T) place(T.el); }
function onHash(){ if(T&&!T.nav) show(T.i,true); }
function watch(){                                       /* fonts and images can move things after the first placement */
  if(!T||!T.S||!T.el) return;
  if(!T.el.isConnected){ var S=T.S, run=T.run; findTarget(S,function(el){ if(T&&T.run===run){ T.el=el; place(el); } }); return; }
  var r=T.el.getBoundingClientRect(), key=[r.left,r.top,r.width,r.height].map(Math.round).join();
  if(key!==T.key){ T.key=key; place(T.el); }
}

function end(skipped){
  if(!T) return;
  var t=T, back=t.origin; T=null;
  clearInterval(t.iv); clearTimeout(t.gl);
  document.removeEventListener('keydown',onKey,true);
  window.removeEventListener('resize',onResize); window.removeEventListener('hashchange',onHash);
  t.root.classList.add('out');
  setTimeout(function(){ if(t.root.parentNode) t.root.parentNode.removeChild(t.root); },260);
  var app=document.getElementById('app'); if(app){ app.inert=false; app.removeAttribute('aria-hidden'); }
  try{ IM.st.seen[FLAG]=Date.now(); IM.save('seen'); IM.flush(); }catch(e){}
  if(skipped&&back!=null&&normHash(location.hash)!==normHash(back)) IM.go(back||'#/');
  if(t.prevFocus&&t.prevFocus.isConnected){ try{ t.prevFocus.focus({preventScroll:true}); }catch(e){} }
  IM.emit&&IM.emit('tour',skipped?'skip':'done');
}

IM.tourStart=function(force){
  if(T) return;
  if(!force&&IM.st.seen[FLAG]) return;
  var top=normHash(location.hash).split('/')[0];
  if(top==='run'||top==='result'){ if(force) IM.go('#/'); else return; }
  var root=h('div.tour-root',{role:'presentation'});
  var block=h('div.tour-block'); block.addEventListener('wheel',function(e){ e.preventDefault(); },{passive:false});
  var spot=h('div.tour-spot.none',{'aria-hidden':'true'});
  var card=h('div.tour-card',{role:'dialog','aria-modal':'true',tabindex:'-1'});
  root.appendChild(block); root.appendChild(spot); root.appendChild(card);
  document.body.appendChild(root);
  var app=document.getElementById('app'); if(app){ app.inert=true; }
  T={root:root,spot:spot,card:card,i:0,run:0,nav:false,el:null,S:null,key:'',origin:location.hash,prevFocus:document.activeElement};
  document.addEventListener('keydown',onKey,true);
  window.addEventListener('resize',onResize); window.addEventListener('hashchange',onHash);
  T.iv=setInterval(watch,350);
  show(0,true);
};
/* called once from app.js after the first screen is up */
IM.tourMaybe=function(){
  try{
    if(IM.st.seen[FLAG]) return;
    var top=normHash(location.hash).split('/')[0];
    if(top==='run'||top==='result'){                    /* never interrupt a session: try again on the first normal screen */
      window.addEventListener('hashchange',function again(){ var t=normHash(location.hash).split('/')[0]; if(t==='run'||t==='result') return; window.removeEventListener('hashchange',again); IM.tourMaybe(); });
      return;
    }
    setTimeout(function(){
      var gate=document.getElementById('gate');
      if(IM.st.seen[FLAG]||T||document.querySelector('.ov')||(gate&&!gate.hidden)) return;
      IM.tourStart(false);
    },1200);
  }catch(e){ try{console.error(e)}catch(_){} }
};
IM.TOUR_STEPS=STEPS;
})();
