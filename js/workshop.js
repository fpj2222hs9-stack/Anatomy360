/* Imhotep · إمحتب — workshop (ورشة الألواح): choose how to train, which tablets, which sources, then start a scroll */
(function(){
'use strict';
var IM=window.IM, h=IM.h, icon=IM.icon;
var W=['100%','87%','70%','53%','37%','20%'];

IM.tp=function(on,w,hh){ var t=h('span.tp',{style:'--w:'+(w||44)+'px;--h:'+(hh||4)+'px',role:'img','aria-label':on+' من 6 درجات'}); for(var i=0;i<6;i++) t.appendChild(h('i'+(i<on?'.on':''),{style:'--tw:'+W[i]})); return t; };

var MODES=[
  {id:'train',name:'تدريب الألواح',icon:'train',text:'أسئلة بالترتيب، وكل إجابة بتتصحّح فورًا. اللي ماجاوبتهوش الأول.'},
  {id:'mix',name:'خلط الرمال',icon:'mix',text:'أسئلة من ألواح مختلفة متخلطة، والأضعف عندك بيظهر أكتر.'},
  {id:'water',name:'الساعة المائية',icon:'water',text:'امتحان بوقت: مستوى المية بينزل، ومفيش تصحيح غير في الآخر.'}
];
IM.MODES=MODES;

function prefs(){ return IM.store.get('im_prefs',{}); }
function savePrefs(p){ IM.store.set('im_prefs',p); }

IM.screens.workshop=function(view){
  var subs=IM.subjects.filter(function(s){return s.ready});
  var P=prefs();
  var st={mode:P.mode||'train',sid:(IM.bank.subs[P.sid]?P.sid:subs[0].id),dup:P.dup!==false,spectate:!!P.spectate,count:P.count==null?40:P.count,minutes:P.minutes||0,minEdited:!!P.minEdited,
    secs:P.secs||{},groups:P.groups||{},open:{}};
  function allSecs(sid){ var S=IM.bank.subs[sid], o=[]; S.parts.forEach(function(p){ p.secs.forEach(function(s){ o.push(s.id) }) }); return o; }
  function selSet(sid){ if(!st.secs[sid]) st.secs[sid]=allSecs(sid); return st.secs[sid]; }
  function groupsSel(sid){ if(!st.groups[sid]) st.groups[sid]=IM.bank.subs[sid].groupsList.map(function(g){return g.g}); return st.groups[sid]; }
  function persist(){ savePrefs({mode:st.mode,sid:st.sid,dup:st.dup,spectate:st.spectate,count:st.count,minutes:st.minutes,minEdited:st.minEdited,secs:st.secs,groups:st.groups}); }

  function cfg(){
    var S=IM.bank.subs[st.sid], secs=selSet(st.sid), all=allSecs(st.sid), gl=groupsSel(st.sid), gAll=S.groupsList.length;
    return {mode:st.mode,sid:st.sid,secs:secs.length===all.length?null:secs.slice(),groups:gl.length===gAll?null:gl.slice(),dup:st.dup,spectate:st.spectate,count:st.count,minutes:st.mode==='water'?curMinutes():0};
  }
  function poolSize(){ var c=cfg(); c.count=0; return IM.pool(c).length; }
  function curMinutes(){ var n=poolSize(), cnt=st.count>0?Math.min(st.count,n):n; return st.minEdited&&st.minutes>0?st.minutes:Math.max(1,Math.ceil(cnt*0.75)); }

  var root=h('div.ws'); view.appendChild(root);
  function render(){
    var S=IM.bank.subs[st.sid], secs=selSet(st.sid), secSet={}; secs.forEach(function(x){secSet[x]=1});
    IM.clear(root);
    root.appendChild(h('div.pg-h',{},h('div',{},IM.eyebrow('التدريب'),h('h1.display',{text:'ورشة الألواح'})),h('p.muted',{text:'اختار طريقة التدريب، وبعدين الألواح اللي عايز تشتغل عليها، وابدأ لفافتك.'})));
    root.appendChild(h('a.card.mx-banner',{href:'#/mixed'},icon('mix',24),h('div.mx-bt',{},h('b.display',{text:'اللفافة الشاملة'}),h('span.muted',{text:'أسئلة متخلطة من كل المواد في لفافة واحدة'})),icon('next',18)));
    var main=h('div.ws-main');

    /* modes */
    var modes=h('div.modes'); MODES.forEach(function(m){ modes.appendChild(h('button.mode'+(st.mode===m.id?'.sel':''),{type:'button','aria-pressed':String(st.mode===m.id),onclick:function(){ st.mode=m.id; persist(); render(); }},h('span.mode-h',{},icon(m.icon,22),h('span.display',{text:m.name})),h('span.muted',{text:m.text}))); });
    main.appendChild(h('section',{},h('div.label',{text:'طريقة التدريب'}),modes));

    /* module + subject */
    var modSel=h('select.field-i',{'aria-label':'الموديول',onchange:function(){}},IM.modules.map(function(m){return h('option',{value:m.id,text:m.ar})}));
    var subSel=h('select.field-i',{'aria-label':'المادة',onchange:function(){ st.sid=subSel.value; persist(); render(); }},IM.subjects.map(function(s){ return h('option',{value:s.id,text:s.ar+(s.ready?'':' (قريبًا)'),disabled:!s.ready}); }));
    subSel.value=st.sid;
    main.appendChild(h('section.two',{},h('div',{},h('label.label',{text:'الموديول'}),modSel),h('div.'+S.cls,{},h('label.label',{text:'المادة'}),subSel)));

    /* tablets */
    var head=h('div.ws-th',{},h('div.label',{style:'margin:0',text:'الألواح (الفصول)'}),
      h('div.muted.ws-cnt',{text:S.n+' سؤال في '+S.parts.length+' '+(S.parts.length>10?'لوح':'ألواح')}),
      h('div.ws-sel',{},h('button.btn.ghost.sm',{type:'button',onclick:function(){ st.secs[st.sid]=allSecs(st.sid); persist(); render(); }},'اختار الكل'),h('button.btn.ghost.sm',{type:'button',onclick:function(){ st.secs[st.sid]=[]; persist(); render(); }},'امسح')));
    var grid=h('div.tiles');
    S.parts.forEach(function(p){
      var inSel=p.secs.filter(function(s){return secSet[s.id]}).length, full=inSel===p.secs.length, some=inSel>0&&!full;
      var t=IM.tiers(IM.statsPart(st.sid,p.id)), state=full?'مختار':(some?inSel+' من '+p.secs.length+' أقسام':(IM.statsPart(st.sid,p.id).answered?'مفتوح':'لسه ماتفتحش'));
      var tile=h('button.tile.'+S.cls+(full?'.sel':'')+(some?'.part':''),{type:'button','aria-pressed':String(full),onclick:function(e){
        if(e.target.closest('.tile-more')) return;
        var cur=selSet(st.sid).slice(); if(full){ cur=cur.filter(function(x){ return !p.secs.some(function(s){return s.id===x}) }); } else { p.secs.forEach(function(s){ if(cur.indexOf(s.id)<0) cur.push(s.id) }); }
        st.secs[st.sid]=cur; persist(); render(); }},
        h('span.tile-top',{},
          h('span.tile-t',{},h('span.tile-en',{text:p.en}),h('span.muted.tile-ar',{text:p.ar}),h('span.mono.muted.tile-n',{text:p.n+' سؤال'+(p.n!==p.total?' ('+(p.total-p.n)+' خارج)':'')})),
          IM.tp(t.on,44,4)),
        h('span.tile-state',{},icon(full?'check':(some?'list':'plus'),14),state),
        p.secs.length>1?h('span.tile-more',{role:'button',tabindex:0,onclick:function(e){ e.stopPropagation(); st.open[p.id]=!st.open[p.id]; render(); },onkeydown:function(e){ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); e.stopPropagation(); st.open[p.id]=!st.open[p.id]; render(); } }},icon(st.open[p.id]?'chevu':'chevd',14),'الأقسام ('+p.secs.length+')'):null);
      grid.appendChild(tile);
      if(st.open[p.id]){
        var box=h('div.secs.'+S.cls);
        p.secs.forEach(function(s){ var on=!!secSet[s.id]; box.appendChild(h('button.tog'+(on?'.on':''),{type:'button','aria-pressed':String(on),onclick:function(){ var cur=selSet(st.sid).slice(), i=cur.indexOf(s.id); if(i>-1) cur.splice(i,1); else cur.push(s.id); st.secs[st.sid]=cur; persist(); render(); }},s.en+(s.ar&&s.ar!==s.en?' · '+s.ar:''),h('span.mono.tog-n',{text:s.n}))); });
        grid.appendChild(box);
      }
    });
    main.appendChild(h('section',{},head,grid));

    /* sources */
    var gl=groupsSel(st.sid);
    if(S.groupsList.length>1){
      var gs=h('div.chips');
      S.groupsList.forEach(function(g){ var on=gl.indexOf(g.g)>-1; gs.appendChild(h('button.tog'+(on?'.on':''),{type:'button','aria-pressed':String(on),onclick:function(){ var cur=groupsSel(st.sid).slice(), i=cur.indexOf(g.g); if(i>-1) cur.splice(i,1); else cur.push(g.g); st.groups[st.sid]=cur; persist(); render(); }},g.g,h('span.mono.tog-n',{text:g.n}))); });
      main.appendChild(h('section',{},h('div.label',{text:'المصدر'}),gs,h('p.muted.ws-h',{text:'المصدر هو الوسم اللي على كل سؤال. السؤال اللي ليه أكتر من وسم بيدخل لو أي واحد منهم مختار.'})));
    }

    /* switches */
    function sw(label,hint,val,on){ var i=h('input.sw',{type:'checkbox',checked:val,'aria-label':label,onchange:function(){ on(i.checked); }}); return h('label.field.sw-f',{},h('span',{},h('span.sw-l',{text:label}),h('span.muted.sw-h',{text:hint})),i); }
    main.appendChild(h('section.two',{},
      sw('تخطّى الأسئلة المكررة','كل سؤال متكرر بيظهر مرة واحدة بس',st.dup,function(v){ st.dup=v; persist(); render(); }),
      sw('وضع المشاهدة','الإجابة الصح ظاهرة من الأول، من غير تسجيل إجابات',st.spectate,function(v){ st.spectate=v; persist(); render(); })));

    /* aside: the scroll */
    var n=poolSize(), c=cfg(), cnt=st.count>0?Math.min(st.count,n):n;
    var chosen=secs.length;
    var names=S.parts.filter(function(p){ return p.secs.some(function(s){return secSet[s.id]}) }).map(function(p){return p.en});
    var tabTxt=names.length===0?'ولا لوح':(names.length<=2?names.join('، '):names.length+' ألواح');
    var counts=h('div.seg',{role:'group','aria-label':'عدد الأسئلة'});
    [20,40,80,0].forEach(function(v){ counts.appendChild(h('button',{type:'button','aria-pressed':String(st.count===v),text:v?String(v):'الكل',onclick:function(){ st.count=v; persist(); render(); }})); });
    var saved=IM.sessions()[IM.sessKey(c)]; if(saved&&saved.state!=='run') saved=null;
    var wrongN=IM.wrongIds(st.sid).length, wrongAll=IM.wrongIds().length;
    var minutes=null;
    if(st.mode==='water'){
      var mi=h('input.field-i.min-i',{type:'number',min:1,max:600,value:curMinutes(),dir:'ltr','aria-label':'الوقت بالدقائق',onchange:function(){ var v=Math.round(+mi.value); if(v>0){ st.minutes=Math.min(600,v); st.minEdited=true; } else st.minEdited=false; persist(); render(); }});
      minutes=h('div',{},h('div.label',{text:'وقت الساعة المائية (دقائق)'}),mi,h('p.muted.ws-h',{text:'حوالي '+Math.max(1,Math.round(curMinutes()*60/Math.max(1,cnt)))+' ثانية للسؤال.'}));
    }
    var start=h('button.btn.primary.lg.go',{type:'button',disabled:n===0||chosen===0,onclick:function(){ begin(false); }},icon('play',20),st.spectate?'افتح للمشاهدة':'ابدأ لفافة');
    var aside=h('aside.stepcard.ws-aside',{},h('div.in',{style:'padding:26px 24px;display:flex;flex-direction:column;gap:16px'},
      h('div.ws-ah',{},icon('papyrus',26),h('h2.display',{text:'لفافتك'})),
      h('dl.ws-dl',{},h('dt.muted',{text:'الطريقة'}),h('dd',{text:MODES.filter(function(m){return m.id===st.mode})[0].name}),h('dt.muted',{text:'المادة'}),h('dd',{text:S.ar}),h('dt.muted',{text:'الألواح'}),h('dd',{text:tabTxt}),h('dt.muted',{text:'المتاح'}),h('dd',{text:n+' سؤال'})),
      st.spectate?null:h('div',{},h('div.label',{text:'عدد الأسئلة في اللفافة'}),counts),
      minutes,
      n===0&&chosen>0?h('p.g-msg',{text:'مفيش أسئلة مطابقة للاختيار ده. جرّب تغيّر المصادر.'}):(chosen===0?h('p.g-msg',{text:'اختار لوح واحد على الأقل.'}):null),
      start,
      saved?h('a.btn',{href:'#/run/'+saved.id},'كمّل اللفافة · سؤال '+Math.min(saved.idx+1,saved.items.length)+' من '+saved.items.length):null,
      h('div.ws-two',{},h('button.btn.ghost.sm',{type:'button',disabled:n===0||chosen===0,onclick:function(){ IM.printDialog(cfg()); }},icon('print',16),'تصدير PDF'),h('a.btn.ghost.sm',{href:'#/papyrus'},icon('papyrus',16),'البردية')),
      h('div.note.ws-wn',{},icon('scale',20),h('div.note-t',{text:wrongAll?('كفّة الأغلاط فيها '+wrongAll+' سؤال'):'كفّة الأغلاط فاضية'}),
        h('button.btn.sm',{type:'button',disabled:!wrongAll,onclick:function(){ beginWrong(); }},'خفّف الميزان'))));
    root.appendChild(h('div.ws-grid',{},main,aside));
  }

  function begin(){
    var c=cfg(); if(c.spectate) c.count=c.count; var sess=IM.newSession(c);
    if(!sess.items.length){ IM.toast('مفيش أسئلة مطابقة.',{kind:'bad'}); return; }
    IM.saveSession(sess); IM.go('#/run/'+sess.id);
  }
  function beginWrong(){
    var sid=st.sid; if(!IM.wrongIds(sid).length){ var best=null; subs.forEach(function(s){ var n=IM.wrongIds(s.id).length; if(n&&(!best||n>best.n)) best={id:s.id,n:n}; }); if(!best) return; sid=best.id; }
    var c={mode:'train',sid:sid,secs:null,groups:null,dup:false,spectate:false,count:0,wrongOnly:true,minutes:0};
    var sess=IM.newSession(c); if(!sess.items.length) return; IM.saveSession(sess); IM.go('#/run/'+sess.id);
  }
  render();
  return {};
};
})();
