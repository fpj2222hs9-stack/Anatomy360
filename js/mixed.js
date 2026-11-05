/* Imhotep · إمحتب — اللفافة الشاملة: أسئلة متخلطة من كل المواد في لفافة واحدة */
(function(){
'use strict';
var IM=window.IM, h=IM.h, icon=IM.icon;
var KEY='im_mixed';
var COUNTS=[20,40,80,120,0];

function readyIds(){ return IM.subjects.filter(function(s){ return s.ready&&IM.bank.subs[s.id]; }).map(function(s){ return s.id; }); }
function poolOf(sid,dup){ return IM.pool({sid:sid,mode:'mix',secs:null,groups:null,dup:!!dup,spectate:false,count:0}); }

/* how many of the n questions each subject gets: equal split, or by the size of each subject */
function shares(n,ids,per,how){
  var avail={}, total=0, out={};
  ids.forEach(function(s){ avail[s]=per[s].length; total+=avail[s]; out[s]=0; });
  if(!n||n>total) n=total;
  if(how==='size'&&total){
    var f=ids.map(function(s){ var x=n*avail[s]/total; return {s:s,f:Math.floor(x),r:x-Math.floor(x)}; });
    var left=n-f.reduce(function(a,x){ return a+x.f; },0);
    f.slice().sort(function(a,b){ return b.r-a.r; }).slice(0,left).forEach(function(x){ x.f++; });
    f.forEach(function(x){ out[x.s]=Math.min(avail[x.s],x.f); });
  }else{
    var rest=n, open=ids.slice();
    while(rest>0&&open.length){
      var each=Math.max(1,Math.floor(rest/open.length)), next=[];
      open.forEach(function(s){ if(rest<=0) return; var give=Math.min(avail[s]-out[s],each,rest); out[s]+=give; rest-=give; if(avail[s]-out[s]>0) next.push(s); });
      open=next;
    }
  }
  return {n:n,by:out,total:total};
}

/* called by IM.pick when a scroll is "mixed": draws from every chosen subject, keeps stimulus blocks together, shuffles across subjects */
IM.pickMixed=function(c,rnd){
  var m=c.mixed, ids=m.subs.filter(function(s){ return IM.bank.subs[s]; }), per={}, picked=[];
  ids.forEach(function(s){ per[s]=poolOf(s,c.dup); });
  var sh=shares(m.count,ids,per,m.how);
  ids.forEach(function(s){
    if(!sh.by[s]) return;
    picked.push(IM.pick({mode:m.first==='new'?'train':'mix',sid:s,secs:null,groups:null,dup:!!c.dup,spectate:false,count:sh.by[s]},rnd));
  });
  var units=[];
  picked.forEach(function(arr){ var cur=null; arr.forEach(function(id){ var b=IM.bank.q[id].block; if(b&&cur&&cur.b===b) cur.ids.push(id); else{ cur={b:b||null,ids:[id]}; units.push(cur); } }); });
  var out=[]; IM.shuffle(units,rnd).forEach(function(u){ out=out.concat(u.ids); });
  return out;
};

IM.screens.mixed=function(view){
  var all=readyIds();
  var st=Object.assign({subs:all.slice(),count:40,how:'equal',first:'weak',mode:'mix',dup:true,minutes:0,minEdited:false},IM.store.get(KEY,{}));
  st.subs=(st.subs||[]).filter(function(s){ return all.indexOf(s)>-1; }); if(!st.subs.length) st.subs=all.slice();
  if(COUNTS.indexOf(st.count)<0) st.count=40;
  var root=h('div.ws.mx'); view.appendChild(root);
  function persist(){ IM.store.set(KEY,st); }

  function render(){
    IM.clear(root);
    var per={}; st.subs.forEach(function(s){ per[s]=poolOf(s,st.dup); });
    var sh=shares(st.count,st.subs,per,st.how);
    root.appendChild(h('div.pg-h',{},h('div',{},IM.eyebrow('التدريب'),h('h1.display',{text:'اللفافة الشاملة'})),h('p.muted',{text:'أسئلة متخلطة من كل المواد في لفافة واحدة، زي الامتحان الشامل. بتشوف نفسك واقف فين من غير ما تقعد في مادة واحدة.'})));
    var main=h('div.ws-main');

    /* subjects */
    var chips=h('div.chips',{role:'group','aria-label':'المواد'});
    all.forEach(function(sid){
      var on=st.subs.indexOf(sid)>-1, n=poolOf(sid,st.dup).length;
      chips.appendChild(h('button.tog.'+IM.subClass(sid)+(on?'.on':''),{type:'button','aria-pressed':String(on),onclick:function(){
        var cur=st.subs.slice(), i=cur.indexOf(sid);
        if(i>-1){ if(cur.length===1){ IM.toast('لازم تفضل مادة واحدة على الأقل.',{kind:'bad'}); return; } cur.splice(i,1); } else cur.push(sid);
        st.subs=all.filter(function(x){ return cur.indexOf(x)>-1; }); persist(); render();
      }},h('span.dot'),IM.subName(sid),h('span.mono.muted',{text:String(n)})));
    });
    main.appendChild(h('section',{},h('div.label',{text:'المواد اللي هتتخلط'}),chips,h('p.muted.ws-h',{text:'المتاح من '+sh.total+' سؤال بيتحسب. الأسئلة بتتسحب من كل مادة مختارة وبتتخلط مع بعض.'})));

    /* how many */
    var counts=h('div.seg',{role:'group','aria-label':'عدد الأسئلة'});
    COUNTS.forEach(function(v){ counts.appendChild(h('button',{type:'button','aria-pressed':String(st.count===v),text:v?String(v):'الكل',onclick:function(){ st.count=v; persist(); render(); }})); });
    main.appendChild(h('section',{},h('div.label',{text:'عدد الأسئلة'}),counts));

    /* split + priority */
    function seg(label,opts,cur,on,hint){
      var w=h('div.seg',{role:'group','aria-label':label});
      opts.forEach(function(o){ w.appendChild(h('button',{type:'button','aria-pressed':String(cur===o[0]),text:o[1],onclick:function(){ on(o[0]); persist(); render(); }})); });
      return h('div',{},h('label.label',{text:label}),w,hint?h('p.muted.ws-h',{text:hint}):null);
    }
    main.appendChild(h('section.two',{},
      seg('توزيع الأسئلة',[['equal','بالتساوي'],['size','حسب حجم المادة']],st.how,function(v){ st.how=v; },st.how==='equal'?'كل مادة بتاخد نفس العدد تقريبًا.':'المادة الأكبر بتاخد عدد أكبر.'),
      seg('اللي يظهر الأول',[['weak','الأضعف عندك'],['new','الجديد']],st.first,function(v){ st.first=v; },st.first==='weak'?'الأسئلة اللي غلطت فيها أو لسه ماجاوبتهاش بتظهر أكتر.':'الأسئلة اللي ماجاوبتهاش الأول، وبعدها الأغلاط.')));

    /* way */
    var MODES=[{id:'mix',name:'تدريب شامل',icon:'mix',text:'كل إجابة بتتصحّح فورًا وإنت ماشي.'},{id:'water',name:'الساعة المائية',icon:'water',text:'امتحان شامل بوقت، ومفيش تصحيح غير في الآخر.'}];
    var modes=h('div.modes.mx-modes'); MODES.forEach(function(m){ modes.appendChild(h('button.mode'+(st.mode===m.id?'.sel':''),{type:'button','aria-pressed':String(st.mode===m.id),onclick:function(){ st.mode=m.id; persist(); render(); }},h('span.mode-h',{},icon(m.icon,22),h('span.display',{text:m.name})),h('span.muted',{text:m.text}))); });
    var wayBox=h('section',{},h('div.label',{text:'طريقة الحل'}),modes);
    var defMin=Math.max(1,Math.ceil(sh.n*0.75));
    if(st.mode==='water'){
      var mi=h('input.field-i.min-i',{type:'number',min:1,max:600,value:st.minEdited&&st.minutes>0?st.minutes:defMin,dir:'ltr','aria-label':'الوقت بالدقائق',onchange:function(){ var v=Math.round(+mi.value); if(v>0){ st.minutes=Math.min(600,v); st.minEdited=true; } else st.minEdited=false; persist(); render(); }});
      wayBox.appendChild(h('div.mx-min',{},h('label.label',{text:'وقت الساعة المائية (دقائق)'}),mi,h('p.muted.ws-h',{text:'حوالي '+Math.max(1,Math.round((st.minEdited&&st.minutes>0?st.minutes:defMin)*60/Math.max(1,sh.n)))+' ثانية للسؤال.'})));
    }
    main.appendChild(wayBox);

    /* duplicates */
    var dupI=h('input.sw',{type:'checkbox',checked:st.dup,'aria-label':'تخطّى الأسئلة المكررة',onchange:function(){ st.dup=dupI.checked; persist(); render(); }});
    main.appendChild(h('section',{},h('label.field.sw-f',{},h('span',{},h('span.sw-l',{text:'تخطّى الأسئلة المكررة'}),h('span.muted.sw-h',{text:'كل سؤال متكرر بيظهر مرة واحدة بس'})),dupI)));

    /* aside: the scroll */
    var rows=h('div.mx-sh',{});
    st.subs.forEach(function(sid){ rows.appendChild(h('div.mx-r.'+IM.subClass(sid),{},h('span.mx-n',{},h('span.dot'),IM.subName(sid)),h('span.mono',{text:String(sh.by[sid]||0)}))); });
    var start=h('button.btn.primary.lg.go',{type:'button',disabled:sh.n===0,onclick:begin},icon('play',20),'ابدأ اللفافة الشاملة');
    var aside=h('aside.stepcard.ws-aside',{},h('div.in',{style:'padding:26px 24px;display:flex;flex-direction:column;gap:16px'},
      h('div.ws-ah',{},icon('mix',26),h('h2.display',{text:'لفافتك الشاملة'})),
      h('dl.ws-dl',{},h('dt.muted',{text:'الطريقة'}),h('dd',{text:st.mode==='water'?'الساعة المائية':'تدريب شامل'}),h('dt.muted',{text:'المواد'}),h('dd',{text:st.subs.length===all.length?'كل المواد':st.subs.map(IM.subName).join('، ')}),h('dt.muted',{text:'الأسئلة'}),h('dd',{text:sh.n+' سؤال'})),
      h('div',{},h('div.label',{text:'من كل مادة'}),rows),
      start,
      h('p.muted.ws-h',{text:'التقدّم بيتسجّل في كل مادة على حدة، وهرم كل مادة بيطلع زي أي لفافة.'})));
    root.appendChild(h('div.ws-grid',{},main,aside));
  }
  function begin(){
    var c={mode:st.mode,sid:'all',secs:null,groups:null,dup:st.dup,spectate:false,count:0,minutes:st.mode==='water'&&st.minEdited?st.minutes:0,
      mixed:{subs:st.subs.slice(),count:st.count,how:st.how,first:st.first}};
    var s=IM.newSession(c); if(!s.items.length){ IM.toast('مفيش أسئلة مطابقة.',{kind:'bad'}); return; }
    IM.saveSession(s); IM.go('#/run/'+s.id);
  }
  render();
  return {destroy:function(){}};
};
})();
