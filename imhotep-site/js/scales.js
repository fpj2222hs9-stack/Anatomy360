/* Imhotep · إمحتب — ميزان الأداء (statistics), تصحيحات المفاتيح, فحص الداتا */
(function(){
'use strict';
var IM=window.IM, h=IM.h, icon=IM.icon;

function startFor(sid,secIds,label){
  var c={mode:'train',sid:sid,secs:secIds,groups:null,dup:true,spectate:false,count:40,minutes:0};
  var ns=IM.newSession(c); if(!ns.items.length){ IM.toast('مفيش أسئلة هنا.'); return; }
  ns.tier0=IM.tiers(IM.statsFor(sid)).on; IM.saveSession(ns); IM.go('#/run/'+ns.id);
}
function ms(v){ return v?Math.round(v/1000)+' ث':'—'; }

IM.screens.scales=function(view){
  var subs=IM.subjects.filter(function(s){return s.ready}), sid=(IM.lastSession()&&IM.lastSession().cfg.sid)||subs[0].id, open={};
  var wrap=h('div.sx'); view.appendChild(wrap);
  function render(){
    IM.clear(wrap);
    var S=IM.bank.subs[sid], a=IM.statsFor(sid), t=IM.tiers(a), cls=IM.subClass(sid);
    wrap.appendChild(h('div.pg-h',{},h('div',{},IM.eyebrow('أداءك'),h('h1.display',{text:'ميزان الأداء'})),h('p.muted',{text:'كل رقم هنا من إجاباتك على جهازك بس. الدقة بتتحسب من أول مرة جاوبت فيها كل سؤال.'})));
    var chips=h('div.chips',{role:'group','aria-label':'المادة'});
    subs.forEach(function(s){ chips.appendChild(h('button.tog'+(s.id===sid?'.on':''),{type:'button','aria-pressed':String(s.id===sid),onclick:function(){ sid=s.id; open={}; render(); }},s.ar)); });
    wrap.appendChild(chips);

    /* overview */
    var wr=IM.wrongIds(sid).length;
    wrap.appendChild(h('section.card.sx-ov.'+cls,{},
      h('div.sx-pm',{html:IM.pyr(t.on,{cls:'mid'})}),
      h('div.sx-ot',{},h('div.display.sx-big',{},String(t.on),h('small.muted',{text:' من 6 درجات'})),
        h('div.bar',{},h('i',{style:'width:'+IM.pct(a.answered,a.total)+'%;background:var(--p)'})),
        h('div.muted.mono',{text:a.answered+' / '+a.total+' سؤال اتفتح'})),
      h('div.sx-kp',{},kp('الدقة من أول مرة',a.answered?a.acc+'%':'—'),kp('الغلط الحالي',a.wrong),kp('متوسط السؤال',ms(a.avgMs)),kp('في كفّة الأغلاط',wr))));
    function kp(l,v){ return h('div.sx-k',{},h('b.display',{text:String(v)}),h('span.muted',{text:l})); }

    /* activity: last 14 days */
    var days=[], mx=1; for(var i=13;i>=0;i--){ var k=IM.addDays(IM.dayKey(),-i), n=IM.dayN(k); days.push({k:k,n:n}); if(n>mx) mx=n; }
    var st=IM.streak(), plan=IM.planInfo();
    var bars=h('div.sx-bars',{role:'img','aria-label':'نشاطك في آخر 14 يوم'});
    days.forEach(function(d){ bars.appendChild(h('div.sx-bc',{title:d.n+' إجابة في '+IM.fmtDate(d.k)},h('i'+(IM.lit(d.k)?'.on':''),{style:'height:'+Math.max(d.n?6:2,Math.round(d.n/mx*100))+'%'}),h('span.mono',{text:d.k.slice(8)}))); });
    wrap.appendChild(h('section.sx-two',{},
      h('div.card.sx-card',{},h('div.hc-h',{},h('h3.display',{text:'نشاطك'}),h('span.chip.ok',{text:st.now?st.now+(st.now===1?' يوم':' أيام')+' شروق':'لسه'})),bars,h('div.muted.sx-nt',{text:'الأعمدة الذهبية = يوم طلعت فيه الشمس ('+IM.DAY_GOAL+' أسئلة أو أكتر). أطول سلسلة: '+st.best+' '+(st.best<=10?'أيام':'يوم')+'.'})),
      h('div.card.sx-card',{},h('div.hc-h',{},h('h3.display',{text:'الأختام'}),icon('feather',22)),
        h('div.sx-seals',{},IM.SEALS.map(function(s){ var at=IM.st.seals[s]; return h('div.sx-seal'+(at?'.on':''),{title:at?('اتختم '+IM.fmtDate(IM.dayKey(new Date(at)))):'لسه'},icon('feather',22),h('b.mono',{text:String(s)}),h('span.muted',{text:'إجابة'})); })),
        h('div.muted.sx-nt',{text:'إجمالي إجاباتك: '+IM.totalAnswered()+' سؤال مختلف.'}))));

    /* hierarchical progress: parts → sections */
    var list=h('div.sx-parts.'+cls);
    S.parts.forEach(function(p){
      var pa=IM.statsPart(sid,p.id), pt=IM.tiers(pa), isOpen=!!open[p.id];
      var row=h('div.sx-p'+(isOpen?'.open':''),{},
        h('button.sx-ph',{type:'button','aria-expanded':String(isOpen),onclick:function(){ open[p.id]=!open[p.id]; render(); }},
          h('span.sx-pn',{},h('b.sx-pen',{text:p.en}),h('span.muted',{text:p.ar})),
          IM.tp(pt.on,36,4),
          h('span.sx-pb',{},h('span.bar.sm',{},h('i',{style:'width:'+IM.pct(pa.answered,pa.total)+'%;background:var(--p)'})),h('span.mono.muted',{text:pa.answered+'/'+pa.total})),
          h('span.sx-pa.mono',{text:pa.answered?pa.acc+'%':'—'}),
          icon(isOpen?'chevu':'chevd',16)));
      if(isOpen){
        var inner=h('div.sx-secs');
        p.secs.forEach(function(s){
          var sa=IM.statsSec(sid,s.id);
          inner.appendChild(h('div.sx-s',{},h('span.sx-sn',{dir:'ltr',lang:'en',text:s.en+(s.ar&&s.ar!==s.en?' · '+s.ar:'')}),h('span.sx-pb',{},h('span.bar.sm',{},h('i',{style:'width:'+IM.pct(sa.answered,sa.total)+'%;background:var(--p)'})),h('span.mono.muted',{text:sa.answered+'/'+sa.total})),h('span.sx-pa.mono',{text:sa.answered?sa.acc+'%':'—'}),h('button.btn.ghost.sm',{type:'button',onclick:function(){ startFor(sid,[s.id]); }},'تدرّب')));
        });
        inner.appendChild(h('div.sx-ft',{},h('button.btn.sm',{type:'button',onclick:function(){ startFor(sid,p.secs.map(function(s){return s.id})); }},icon('play',16),'تدرّب على اللوح كله')));
        row.appendChild(inner);
      }
      list.appendChild(row);
    });
    wrap.appendChild(h('section',{},IM.section('الألواح','اضغط على اللوح عشان تشوف أقسامه.'),list));

    /* hardest sections */
    var hard=[]; S.parts.forEach(function(p){ p.secs.forEach(function(s){ var sa=IM.statsSec(sid,s.id); if(sa.answered>=5) hard.push({s:s,a:sa}); }); });
    hard.sort(function(x,y){ return x.a.acc-y.a.acc; }); hard=hard.slice(0,5).filter(function(x){ return x.a.acc<85; });
    if(hard.length) wrap.appendChild(h('section',{},IM.section('أضعف الأقسام','أقسام جاوبت فيها 5 أسئلة على الأقل ودقتك فيها أقل.'),
      h('div.sx-hard.'+cls,{},hard.map(function(x){ return h('div.card.sx-hd',{},h('div',{},h('b',{dir:'ltr',lang:'en',text:x.s.en}),h('div.muted.mono',{text:x.a.acc+'% · '+x.a.answered+' سؤال'})),h('button.btn.sm',{type:'button',onclick:function(){ startFor(sid,[x.s.id]); }},'تدرّب')); }))));

    /* sessions log */
    var hist=IM.st.hist.slice().reverse().slice(0,10);
    wrap.appendChild(h('section',{},IM.section('آخر اللفافات'),hist.length?h('div.card.sx-log',{},hist.map(function(r){
      var p=IM.pct(r.ok,r.n);
      return h('a.sx-lr',{href:'#/result/'+r.id},h('span.sx-ld.muted',{text:IM.fmtDate(IM.dayKey(new Date(r.ts)))}),h('span.sx-ll',{text:(r.label||IM.subName(r.sid))+' · '+(IM.modeName[r.mode]||'')}),h('span.mono.sx-lp'+(p>=70?'.ok':'.bad'),{text:r.ok+'/'+r.n+' · '+p+'%'}),h('span.mono.muted',{text:IM.fmtTime(r.ms||0)}));
    })):h('p.muted',{text:'لسه مفيش لفافات. ابدأ أول واحدة من ورشة الألواح.'})));
    if(plan) wrap.appendChild(h('p.muted.sx-nt',{text:'القمة الجاية: '+(plan.plan.label||'امتحان')+' بعد '+Math.max(0,plan.daysLeft)+' يوم.'}));
  }
  render();
  return {};
};

/* ---------- key corrections ---------- */
IM.screens.corrections=function(view){
  var all=IM.corrections(), only=false, wrap=h('div.sx'); view.appendChild(wrap);
  var pend=all.filter(function(c){return c.hit}).length;
  function render(){
    IM.clear(wrap);
    wrap.appendChild(h('div.pg-h',{},h('div',{},IM.eyebrow('بعد مراجعة الدكتور'),h('h1.display',{text:'تصحيحات المفاتيح'})),h('p.muted',{text:'أسئلة اتغيّر مفتاحها عن المطبوع في الملزمة. اللي بيتحسب لك هو المفتاح الجديد.'})));
    if(!all.length){ wrap.appendChild(IM.empty('مفيش تصحيحات','كل المفاتيح زي ما هي في الملزمة.',h('a.btn',{href:'#/'},'الرئيسية'))); return; }
    var chips=h('div.chips'); [[false,'الكل',all.length],[true,'جاوبتها بالمفتاح القديم',pend]].forEach(function(x){ chips.appendChild(h('button.tog'+(only===x[0]?'.on':''),{type:'button','aria-pressed':String(only===x[0]),onclick:function(){ only=x[0]; render(); }},x[1],h('span.mono.tog-n',{text:x[2]}))); });
    wrap.appendChild(chips);
    var list=h('div.pp-list'); wrap.appendChild(list);
    all.filter(function(c){ return !only||c.hit; }).forEach(function(c){
      var Q=c.q, open=false, body=null, sec=IM.bank.subs[Q.sid].secs[Q.sec];
      var el=h('div.pp-i.'+IM.subClass(Q.sid));
      var hd=h('div.pp-h',{role:'button',tabindex:0,'aria-expanded':'false',onclick:tg,onkeydown:function(e){ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); tg(); } }},h('span.dot'),h('span.pp-q',{dir:'ltr',lang:'en',text:Q.stem}),
        h('span.pp-m.muted',{},(sec?sec.en:'')+' · '+Q.bk.toUpperCase()+' ← '+Q.keys.map(function(k){return k.toUpperCase()}).join('+')),
        c.hit?h('span.chip.fix',{},icon('flag',14),'جاوبتها بالقديم'):null);
      function tg(){ open=!open; el.classList.toggle('open',open); hd.setAttribute('aria-expanded',String(open)); if(open&&!body){ body=h('div.pp-b'); var a=c.ans; body.appendChild(IM.questionBlock(Q,{item:{r:0},res:function(){ return {pick:a?a.l:'',ok:!!(a&&a.lo)}; },cut:function(){return null},spectate:true,tools:false,onMark:function(){ IM.toggleMark(Q.id); },onReport:function(){ IM.reportDialog(Q,a&&a.l); }}).el); el.appendChild(body); } else if(body) body.hidden=!open; }
      el.appendChild(hd); list.appendChild(el);
    });
    IM.markNoticesSeen();
  }
  render();
  return {};
};

/* ---------- data audit: what is in the question bank, counted from the files ---------- */
IM.screens.audit=function(view){
  var wrap=h('div.sx'); view.appendChild(wrap);
  wrap.appendChild(h('div.pg-h',{},h('div',{},IM.eyebrow('الداتا'),h('h1.display',{text:'فحص الداتا'})),h('p.muted',{text:'أرقام محسوبة من ملفات الأسئلة نفسها كل ما الموقع يفتح. الأسئلة بتتعرض زي ما هي من غير أي تعديل.'})));
  var rows=h('tbody');
  var T={q:0,e:0,c:0,nk:0,fx:0,db:0,rv:0,du:0,bl:0,fg:0};
  IM.subjects.filter(function(s){return s.ready}).forEach(function(s){
    var S=IM.bank.subs[s.id], r={q:S.qids.length,e:0,c:0,nk:0,fx:0,db:0,rv:0,du:0,bl:0,fg:0}, blocks={};
    S.qids.forEach(function(id){ var Q=IM.bank.q[id], st=IM.statusOf(Q); if(Q.elig) r.e++; if(st==='canc') r.c++; if(st==='nokey') r.nk++; if(st==='fix') r.fx++; if(st==='doubt') r.db++; if(st==='review') r.rv++; if(Q.dupOf) r.du++; if(Q.block) blocks[Q.block]=1; if(Q.fig) r.fg++; });
    r.bl=Object.keys(blocks).length;
    Object.keys(r).forEach(function(k){ T[k]+=r[k]; });
    rows.appendChild(h('tr.'+IM.subClass(s.id),{},h('td',{},h('span.dot'),' '+s.ar),[r.q,r.e,r.c,r.nk,r.fx,r.db,r.rv,r.du,r.bl,r.fg].map(function(v){ return h('td.mono',{text:String(v)}); })));
  });
  rows.appendChild(h('tr.sx-tot',{},h('td',{text:'الإجمالي'}),[T.q,T.e,T.c,T.nk,T.fx,T.db,T.rv,T.du,T.bl,T.fg].map(function(v){ return h('td.mono',{text:String(v)}); })));
  var cols=['المادة','أسئلة','بتتحسب','ملغي','بدون مفتاح','مفتاح اتصحّح','شك علمي','قيد المراجعة','مكرر','حالات مجمعة','بصور'];
  wrap.appendChild(h('div.card.sx-au',{},h('div.scroll',{},h('table.sx-t',{},h('thead',{},h('tr',{},cols.map(function(c){ return h('th',{text:c}); }))),rows))));
  wrap.appendChild(h('p.muted.sx-nt',{text:'«بتتحسب» = له مفتاح مطبوع، مش ملغي، والمفتاح موجود في الاختيارات. «مكرر» = نفس نص السؤال واختياراته ظهر قبل كده، وبيتخطّى لما تفعّل «تخطّى المكرر».'}));
  return {};
};
})();
