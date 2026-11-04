/* Imhotep · إمحتب — المكتبة: the book (chapter text exactly as in the data files) and flashcards */
(function(){
'use strict';
var IM=window.IM, h=IM.h, icon=IM.icon;
var PK='im_libprefs';

function prefs(){ return IM.store.get(PK,{}); }
function setPref(k,v){ var p=prefs(); p[k]=v; IM.store.set(PK,p); }
function readMap(sid){ return IM.st.read[sid]||(IM.st.read[sid]={}); }
function cardMap(sid){ return IM.st.cards[sid]||(IM.st.cards[sid]={}); }
function readCount(sid){ var m=readMap(sid), S=IM.bank.subs[sid]; return S.chapters.filter(function(c){ return m[c.id]; }).length; }
function knownCount(sid){ var m=cardMap(sid), S=IM.bank.subs[sid]; return S.cards.filter(function(c){ return m[c.i]===1; }).length; }

/* ---------- lightbox ---------- */
function lightbox(src){
  var ov=h('div.lb',{role:'dialog','aria-label':'صورة مكبّرة',onclick:close},h('img',{src:src,alt:''}));
  var x=h('button.iconbtn.lb-x',{type:'button','aria-label':'إغلاق',onclick:close},icon('cross',20));
  function key(e){ if(e.key==='Escape'){ e.stopPropagation(); close(); } }
  function close(){ document.removeEventListener('keydown',key,true); ov.remove(); x.remove(); document.body.classList.remove('lock'); }
  document.addEventListener('keydown',key,true); document.body.classList.add('lock'); document.body.appendChild(ov); document.body.appendChild(x);
}

/* ---------- screen: library home / book / cards ---------- */
IM.screens.library=function(view,params){
  var sid=params[0], mode=params[1];
  if(sid&&IM.bank.subs[sid]){
    if(mode==='cards') return cards(view,sid);
    return reader(view,sid,mode);
  }
  return home(view);
};

function home(view){
  var wrap=h('div.lib'); view.appendChild(wrap);
  wrap.appendChild(h('div.pg-h',{},h('div',{},IM.eyebrow('المذاكرة'),h('h1.display',{text:'المكتبة'})),h('p.muted',{text:'نص الكتاب زي ما هو، وبطاقات للمراجعة السريعة. وضع الاسترجاع بيغطّي النص لحد ما تحاول تفتكره.'})));
  var cards=h('div.lib-cards'); wrap.appendChild(cards);
  IM.subjects.forEach(function(s){
    var S=IM.bank.subs[s.id]; if(!s.ready||!S) return;
    var hasBook=S.chapters.length>0, hasCards=S.cards.length>0, rd=hasBook?readCount(s.id):0, kn=hasCards?knownCount(s.id):0;
    cards.appendChild(h('div.card.lib-c.'+IM.subClass(s.id)+((!hasBook&&!hasCards)?'.soon':''),{},
      h('div',{},h('span.chip.sub',{},h('span.dot'),s.ar)),
      h('h3.display',{text:s.ar}),
      (hasBook||hasCards)?h('div.lib-st.muted',{},hasBook?h('span',{},'فصول: ',h('b',{text:rd+' / '+S.chapters.length}),' اتقرت'):null,hasCards?h('span',{},'بطاقات: ',h('b',{text:kn+' / '+S.cards.length}),' عرفتها'):null,h('span',{},'أسئلة: ',h('b',{text:String(S.n)}))):h('p.muted',{text:'الكتاب والبطاقات لسه مش جاهزين لمادة '+s.ar+'. الأسئلة متاحة من ورشة الألواح.'}),
      hasBook?h('div.lib-bar',{},h('div.bar.sm',{},h('i',{style:'width:'+IM.pct(rd,S.chapters.length)+'%;background:var(--p)'}))):null,
      h('div.lib-a',{},hasBook?h('a.btn.primary',{href:'#/library/'+s.id},icon('book',18),'اقرا الكتاب'):null,hasCards?h('a.btn',{href:'#/library/'+s.id+'/cards'},icon('cards',18),'البطاقات'):null,h('a.btn.ghost',{href:'#/train'},'الأسئلة'))));
  });
  return {};
}

/* ---------- the book ---------- */
function reader(view,sid,chId){
  var S=IM.bank.subs[sid], cls=IM.subClass(sid);
  if(!S.chapters.length){ IM.go('#/library'); return {}; }
  var P=prefs();
  var ch=S.chapters.filter(function(c){return c.id===chId})[0]||S.chapters.filter(function(c){return c.id===P['last:'+sid]})[0]||S.chapters[0];
  var wrap=h('div.lib-r.'+cls); view.appendChild(wrap);
  var book=h('div.book'+(P.recall?'.recall':'')+(P.hideaids?'.hideaids':''));
  var nav=h('nav.lib-nav',{'aria-label':'الفصول'});
  S.chapters.forEach(function(c){ nav.appendChild(h('a.tog'+(c.id===ch.id?'.on':'')+(readMap(sid)[c.id]?'.read':''),{href:'#/library/'+sid+'/'+c.id,'aria-current':c.id===ch.id?'page':null,title:c.ar},c.num+' · '+c.en)); });
  var rec=h('input.sw',{type:'checkbox',checked:!!P.recall,'aria-label':'وضع الاسترجاع',onchange:function(){ setPref('recall',rec.checked); book.classList.toggle('recall',rec.checked); if(!rec.checked) IM.$$('.bk-sec',book).forEach(hideAll); }});
  var hid=h('input.sw',{type:'checkbox',checked:!!P.hideaids,'aria-label':'إخفاء الصناديق التوضيحية',onchange:function(){ setPref('hideaids',hid.checked); book.classList.toggle('hideaids',hid.checked); }});
  function sw(l,i){ return h('label.field.sw-f',{style:'gap:14px'},h('span.sw-l',{text:l}),i); }
  var isRead=!!readMap(sid)[ch.id];
  var readBtn=h('button.btn'+(isRead?'':'.primary'),{type:'button',onclick:function(){ var m=readMap(sid); if(m[ch.id]) delete m[ch.id]; else m[ch.id]=Date.now(); IM.save('read'); IM.go('#/library/'+sid+'/'+ch.id); }},icon('check',18),isRead?'اتقرى · اضغط للإلغاء':'علّمته مقروء');
  var qBtn=h('a.btn.ghost',{href:'#/train'},'أسئلة المادة');
  wrap.appendChild(h('div.lib-top',{},h('a.iconbtn',{href:'#/library','aria-label':'المكتبة'},icon('back',20)),h('h1.display',{text:'كتاب '+S.ar}),h('span.chip.sub',{},h('span.dot'),S.ar),S.cards.length?h('a.btn.ghost.sm',{href:'#/library/'+sid+'/cards'},icon('cards',16),'البطاقات'):null));
  wrap.appendChild(nav);
  wrap.appendChild(h('div.lib-tools',{},sw('وضع الاسترجاع',rec),sw('إخفاء الصناديق التوضيحية',hid)));
  wrap.appendChild(book);
  var i=S.chapters.indexOf(ch), prev=S.chapters[i-1], next=S.chapters[i+1];
  wrap.appendChild(h('div.lib-pager',{},
    prev?h('a.btn.ghost',{href:'#/library/'+sid+'/'+prev.id},icon('back',18),prev.num+' · '+prev.en):h('span'),
    readBtn,
    next?h('a.btn'+(isRead?'.primary':''),{href:'#/library/'+sid+'/'+next.id},next.num+' · '+next.en,icon('next',18)):qBtn));
  setPref('last:'+sid,ch.id);

  /* the chapter text goes in exactly as it is in the data file */
  book.innerHTML=ch.html;
  IM.fixImgs(book);
  IM.$$('.bk-sec',book).forEach(function(s){ if(s.querySelector('table')) s.classList.add('has-tbl'); });
  function hideAll(s){ s.classList.remove('shown'); IM.$$('td.rev',s).forEach(function(c){ c.classList.remove('rev'); }); }
  book.addEventListener('click',function(e){
    var im=e.target.closest&&e.target.closest('.bk-fig img,.origs img'); if(im){ lightbox(im.getAttribute('src')); return; }
    if(!book.classList.contains('recall')) return;
    var s=e.target.closest&&e.target.closest('.bk-sec'); if(!s) return;
    var tbl=s.classList.contains('has-tbl');
    if(!tbl){ s.classList.toggle('shown'); return; }
    if(s.classList.contains('shown')){ hideAll(s); return; }
    var td=e.target.closest('td'); if(td&&s.contains(td)){ td.classList.toggle('rev'); return; }
    if(e.target.closest('.bk-top')) s.classList.add('shown');
  });
  var cur=IM.$('a.on',nav); if(cur&&cur.scrollIntoView) setTimeout(function(){ try{ cur.scrollIntoView({block:'nearest',inline:'center'}); }catch(e){} window.scrollTo(0,0); },0);
  return {};
}

/* ---------- flashcards ---------- */
function cards(view,sid){
  var S=IM.bank.subs[sid], cls=IM.subClass(sid);
  if(!S.cards.length){ IM.go('#/library'); return {}; }
  var P=prefs(), ch=P['cch:'+sid]||'all', only=P['conly:'+sid]||'all', order=[], pos=0, shown=false;
  var wrap=h('div.fc.'+cls); view.appendChild(wrap);
  var chName={}; (S.cardChapters||[]).forEach(function(c){ chName[c.id]=('0'+c.num).slice(-2)+' · '+c.en; });
  function build(shuffle){
    var m=cardMap(sid); order=S.cards.filter(function(c){ return (ch==='all'||c.ch===ch)&&!(only==='unk'&&m[c.i]===1); }).map(function(c){return c.i;});
    if(shuffle) order=IM.shuffle(order);
    pos=0; shown=false;
  }
  var byI={}; S.cards.forEach(function(c){ byI[c.i]=c; });
  function render(){
    IM.clear(wrap);
    var m=cardMap(sid), kn=knownCount(sid);
    wrap.appendChild(h('div.lib-top',{},h('a.iconbtn',{href:'#/library','aria-label':'المكتبة'},icon('back',20)),h('h1.display',{text:'بطاقات '+S.ar}),S.chapters.length?h('a.btn.ghost.sm',{href:'#/library/'+sid},icon('book',16),'الكتاب'):null));
    var chSel=h('select.field-i',{'aria-label':'الفصل',onchange:function(){ ch=chSel.value; setPref('cch:'+sid,ch); build(false); render(); }},h('option',{value:'all',text:'كل الفصول'}),(S.cardChapters||[]).map(function(c){ return h('option',{value:c.id,text:chName[c.id]}); }));
    chSel.value=ch;
    var modeSel=h('select.field-i',{'aria-label':'العرض',onchange:function(){ only=modeSel.value; setPref('conly:'+sid,only); build(false); render(); }},h('option',{value:'all',text:'كل البطاقات'}),h('option',{value:'unk',text:'اللي لسه ماعرفتهاش'}));
    modeSel.value=only;
    var clr=h('button.btn.ghost.sm.danger',{type:'button'}); IM.arm(clr,'مسح '+(ch==='all'?'كل البطاقات':'بطاقات الفصل'),function(){ S.cards.forEach(function(c){ if(ch==='all'||c.ch===ch) delete m[c.i]; }); IM.save('cards'); build(false); render(); });
    wrap.appendChild(h('div.fc-bar',{},chSel,modeSel,h('button.btn.ghost.sm',{type:'button',onclick:function(){ build(true); render(); }},icon('mix',16),'اخلطهم'),clr));
    wrap.appendChild(h('div.fc-stat.muted',{},'عرفتها ',IM.n(kn+' / '+S.cards.length),' · المعروض دلوقتي ',IM.n(String(order.length))));
    wrap.appendChild(h('div.fc-prog',{},h('i',{style:'width:'+IM.pct(kn,S.cards.length)+'%'})));
    if(!order.length){ wrap.appendChild(IM.empty(only==='unk'?'عرفت كل البطاقات هنا':'مفيش بطاقات','غيّر الفصل أو اعرض كل البطاقات.',h('button.btn',{type:'button',onclick:function(){ only='all'; setPref('conly:'+sid,only); build(false); render(); }},'اعرض كل البطاقات'))); return; }
    var c=byI[order[pos]];
    var card=h('div.card.fc-card',{tabindex:0,onkeydown:function(e){ if((e.key===' '||e.key==='Enter')&&!shown){ e.preventDefault(); reveal(); } }},
      h('div.fc-meta',{text:(chName[c.ch]||c.ch)+' · book p.'+c.p+' · '+(pos+1)+'/'+order.length}),
      h('div.fc-f',{text:c.f}));
    var back=h('div.fc-b',{hidden:!shown,html:c.b});
    var act=h('div.fc-act');
    if(!shown) act.appendChild(h('button.btn.primary.lg',{type:'button',onclick:reveal},icon('eye',20),'اعرض الإجابة'));
    else{ act.appendChild(h('button.btn.primary',{type:'button',onclick:function(){ mark(1); }},icon('check',18),'عرفتها')); act.appendChild(h('button.btn',{type:'button',onclick:function(){ mark(0); }},icon('reset',18),'لسه')); }
    card.appendChild(back); card.appendChild(act); wrap.appendChild(card);
    wrap.appendChild(h('div.fc-act',{},h('button.btn.ghost.sm',{type:'button',disabled:pos===0,onclick:function(){ pos--; shown=false; render(); }},icon('back',16),'اللي قبلها'),h('button.btn.ghost.sm',{type:'button',onclick:function(){ pos=(pos+1)%order.length; shown=false; render(); }},'اللي بعدها',icon('next',16))));
    if(!shown) setTimeout(function(){ try{ card.focus({preventScroll:true}); }catch(e){} },0);
  }
  function reveal(){ shown=true; render(); }
  function mark(v){ cardMap(sid)[order[pos]]=v; IM.save('cards'); pos++; shown=false; if(pos>=order.length) build(false); render(); }
  build(false); render();
  return {};
}
})();
