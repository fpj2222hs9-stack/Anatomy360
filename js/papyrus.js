/* Imhotep · إمحتب — البردية (questions you saved) and كفّة الأغلاط (questions you got wrong) */
(function(){
'use strict';
var IM=window.IM, h=IM.h, icon=IM.icon;
var PAGE=30;

IM.screens.papyrus=function(view,params){
  var tab=params[0]==='wrong'?'wrong':'marks', sid='all', q='', shown=PAGE;
  var subs=IM.subjects.filter(function(s){return s.ready});
  var wrap=h('div.pp'); view.appendChild(wrap);
  var offs=[IM.on('marks',function(){ if(tab==='marks') paintList(); paintTabs(); }),IM.on('answer',function(){ if(tab==='wrong') paintList(); paintTabs(); })];

  function ids(t,s){ return t==='wrong'?IM.wrongIds(s==='all'?null:s):IM.markedIds(s==='all'?null:s); }
  function sorted(list){
    var src=tab==='wrong'?IM.st.wrong:IM.st.marks;
    return list.slice().sort(function(a,b){ return (src[b]||0)-(src[a]||0); });
  }
  function filtered(){
    var l=sorted(ids(tab,sid)), s=q.trim().toLowerCase();
    if(s) l=l.filter(function(id){ var Q=IM.bank.q[id]; return Q.stem.toLowerCase().indexOf(s)>-1||Q.opts.some(function(o){ return o.t.toLowerCase().indexOf(s)>-1; }); });
    return l;
  }
  var head=h('div.pg-h',{},h('div',{},IM.eyebrow('مراجعتك'),h('h1.display',{text:tab==='wrong'?'كفّة الأغلاط':'البردية'})),h('p.muted',{text:tab==='wrong'?'الأسئلة اللي غلطت فيها ولسه ماجاوبتهاش صح. أول ما تجاوبها صح بتخرج من الكفّة.':'الأسئلة اللي حفظتها بالعلامة. ارجع لها وقت ما تحب.'}));
  var tabs=h('div.seg.pp-tabs',{role:'tablist'}), bar=h('div.pp-bar'), list=h('div.pp-list'), more=h('div.pp-more');
  wrap.appendChild(head); wrap.appendChild(tabs); wrap.appendChild(bar); wrap.appendChild(list); wrap.appendChild(more);

  function paintHead(){ IM.$('h1',head).textContent=tab==='wrong'?'كفّة الأغلاط':'البردية'; IM.$('p',head).textContent=tab==='wrong'?'الأسئلة اللي غلطت فيها ولسه ماجاوبتهاش صح. أول ما تجاوبها صح بتخرج من الكفّة.':'الأسئلة اللي حفظتها بالعلامة. ارجع لها وقت ما تحب.'; }
  function paintTabs(){
    IM.clear(tabs);
    [['marks','البردية',ids('marks','all').length],['wrong','كفّة الأغلاط',ids('wrong','all').length]].forEach(function(t){
      tabs.appendChild(h('button',{type:'button',role:'tab','aria-pressed':String(tab===t[0]),'aria-selected':String(tab===t[0]),onclick:function(){ tab=t[0]; shown=PAGE; history.replaceState(null,'','#/papyrus'+(tab==='wrong'?'/wrong':'')); paintHead(); paintTabs(); paintBar(); paintList(); }},t[1]+' ('+t[2]+')'));
    });
  }
  function startFor(s,mode){
    var l=sorted(ids(tab,s)); if(!l.length) return;
    var c={mode:'train',sid:s,secs:null,groups:null,dup:false,spectate:mode==='view',count:0,ids:l,minutes:0};
    if(tab==='wrong') c.wrongOnly=true; else c.marksOnly=true;
    if(mode==='pdf'){ IM.printDialog(Object.assign(c,{spectate:true})); return; }
    var ns=IM.newSession(c); if(!ns.items.length){ IM.toast('مفيش أسئلة قابلة للتدريب هنا.'); return; }
    ns.tier0=IM.tiers(IM.statsFor(s)).on; IM.saveSession(ns); IM.go('#/run/'+ns.id);
  }
  function paintBar(){
    IM.clear(bar);
    var chips=h('div.chips',{role:'group','aria-label':'المادة'});
    [['all','كل المواد']].concat(subs.map(function(s){ return [s.id,s.ar]; })).forEach(function(s){
      var n=ids(tab,s[0]).length;
      chips.appendChild(h('button.tog'+(sid===s[0]?'.on':''),{type:'button','aria-pressed':String(sid===s[0]),onclick:function(){ sid=s[0]; shown=PAGE; paintBar(); paintList(); }},s[1],h('span.mono.tog-n',{text:n})));
    });
    var search=h('input.field-i.pp-s',{type:'search',placeholder:'ابحث في الأسئلة (بالإنجليزي)',value:q,dir:'ltr','aria-label':'بحث',oninput:function(){ q=search.value; shown=PAGE; paintList(); }});
    bar.appendChild(chips); bar.appendChild(search);
    var acts=h('div.pp-acts'); bar.appendChild(acts);
    var targets=sid==='all'?subs.map(function(s){return s.id}):[sid];
    targets.forEach(function(s){
      var n=ids(tab,s).length; if(!n) return;
      var nm=sid==='all'?' · '+IM.subName(s):'';
      acts.appendChild(h('div.pp-ag.'+IM.subClass(s),{},
        h('button.btn.primary.sm',{type:'button',onclick:function(){ startFor(s,'train'); }},icon('play',16),'تدرّب على '+n+nm),
        h('button.btn.ghost.sm',{type:'button',onclick:function(){ startFor(s,'view'); }},icon('eye',16),'مشاهدة'),
        h('button.btn.ghost.sm',{type:'button',onclick:function(){ startFor(s,'pdf'); }},icon('print',16),'PDF')));
    });
  }
  function paintList(){
    IM.clear(list); IM.clear(more);
    var l=filtered();
    if(!l.length){
      var any=ids(tab,'all').length;
      list.appendChild(IM.empty(any?'مفيش نتايج':(tab==='wrong'?'كفّة الأغلاط فاضية':'البردية فاضية'),any?'جرّب تغيّر المادة أو كلمة البحث.':(tab==='wrong'?'كمّل تدريب، وأي سؤال غلط هيظهر هنا عشان ترجع له.':'اضغط «احفظ في البردية» تحت أي سؤال، وهيظهر هنا.'),any?null:h('a.btn.primary',{href:'#/train'},'ابدأ لفافة')));
      return;
    }
    l.slice(0,shown).forEach(function(id){ list.appendChild(row(IM.bank.q[id])); });
    if(l.length>shown) more.appendChild(h('button.btn',{type:'button',onclick:function(){ shown+=PAGE; paintList(); }},'اعرض أكتر ('+(l.length-shown)+')'));
  }
  function ago(ts){ if(!ts) return ''; var d=Math.floor((Date.now()-ts)/86400000); return d<=0?'النهارده':(d===1?'امبارح':'من '+d+' يوم'); }
  function row(Q){
    var open=false, body=null, ts=(tab==='wrong'?IM.st.wrong:IM.st.marks)[Q.id], sec=IM.bank.subs[Q.sid].secs[Q.sec];
    var el=h('div.pp-i.'+IM.subClass(Q.sid));
    var del=h('button.iconbtn.sm',{type:'button','aria-label':tab==='wrong'?'شيل من الكفّة':'شيل من البردية',title:tab==='wrong'?'شيل من الكفّة':'شيل من البردية',onclick:function(e){ e.stopPropagation(); if(tab==='wrong'){ delete IM.st.wrong[Q.id]; IM.save('wrong'); IM.emit('answer'); } else IM.toggleMark(Q.id); }},icon('cross',16));
    var hd=h('div.pp-h',{role:'button',tabindex:0,'aria-expanded':'false',onclick:toggle,onkeydown:function(e){ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); toggle(); } }},
      h('span.dot'),
      h('span.pp-q',{dir:'ltr',lang:'en',text:Q.stem}),
      h('span.pp-m.muted',{text:(sec?sec.en:'')+(ts?' · '+ago(ts):'')}),
      del);
    function toggle(){
      open=!open; el.classList.toggle('open',open); hd.setAttribute('aria-expanded',String(open));
      if(open&&!body){ body=h('div.pp-b'); var a=IM.st.ans[Q.id];
        var qb=IM.questionBlock(Q,{item:{r:0},res:function(){ return {pick:a?a.l:'',ok:!!(a&&a.lo)}; },cut:function(){return null},spectate:true,tools:false,onMark:function(){ IM.toggleMark(Q.id); },onReport:function(){ IM.reportDialog(Q,a&&a.l); }});
        body.appendChild(qb.el); el.appendChild(body); } else if(body) body.hidden=!open;
    }
    el.appendChild(hd); return el;
  }
  paintHead(); paintTabs(); paintBar(); paintList();
  return {destroy:function(){ offs.forEach(function(f){ if(typeof f==='function') f(); }); }};
};
})();
