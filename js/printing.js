/* Imhotep · إمحتب — export to PDF: a printable booklet (cover, contents, numbered questions, answer key, notes on keys).
   The booklet itself is ALWAYS English (it is a study handout); only the export dialog follows the site language.
   Nothing leaves the device: it builds a print-only page and calls the browser's print dialog ("Save as PDF").
   Design rule: it must still read perfectly when photocopied in black and white, so structure comes from rules, weight, borders and
   shapes (never from colour alone) and every marker also carries a text label. */
(function(){
'use strict';
var IM=window.IM, h=IM.h, icon=IM.icon;

var MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
var SMALL={a:1,an:1,and:1,or:1,of:1,the:1,in:1,on:1,at:1,to:1,for:1,with:1,by:1,vs:1,from:1};
var CREDIT='Made By Dr.Saif Youssry · Assisted by Abo El-Magd';
var CHK='<svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true"><path d="M1.8 6.6l3 3 5.4-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square"/></svg>';

function hasAr(s){ return /[\u0600-\u06FF]/.test(s||''); }
function enDate(key){ var p=String(key||'').split('-'); if(p.length<3||!MONTHS[+p[1]-1]) return ''; return (+p[2])+' '+MONTHS[+p[1]-1]+' '+p[0]; }
/* the data has ALL-CAPS section names in places: show them in Title Case (acronyms such as CNS stay) */
function nice(s){
  s=String(s||'').replace(/\s+/g,' ').trim();
  if(!s||/[a-z]/.test(s)) return s;
  var first=true;
  return s.replace(/[A-Za-z][A-Za-z']*/g,function(w){
    var l=w.toLowerCase(), f=first; first=false;
    if(w.length<=4&&!/[AEIOUY]/.test(w)) return w;
    if(!f&&SMALL[l]) return l;
    return l.charAt(0).toUpperCase()+l.slice(1);
  });
}
function subEn(sid){ if(sid==='all') return 'All Subjects'; var s=IM.bank.subs[sid]; return s?(s.en||s.ar||sid):sid; }
function secInfo(Q){
  var S=IM.bank.subs[Q.sid]||{secs:{},parts:[]}, s=S.secs[Q.sec]||{}, part=null;
  (S.parts||[]).forEach(function(p){ if(p.id===s.part) part=p; });
  return {sid:Q.sid, sub:subEn(Q.sid), name:nice(s.en||(hasAr(s.ar)?'':s.ar)||Q.sec),
    part:part?{key:Q.sid+':'+part.id, kind:part.kind||'Part', num:part.num, name:nice(part.en)}:null};
}
function partTxt(p){ return p?(p.kind+(p.num?' '+p.num:'')+(p.name?' · '+p.name:'')):''; }
function keyTxt(Q){ return Q.keys.length?Q.keys.map(function(k){return k.toUpperCase()}).join(' + '):'—'; }
function rangeTxt(at,n){ return n>1?('Q'+at+'–Q'+(at+n-1)):('Q'+at); }
function srcTxt(Q){
  return (Q.tags||[]).filter(function(t){ return !hasAr(t); }).map(function(t){ return t.replace(/\s+-\s+/g,' · ').replace(/\bDEP BOOK\b/g,'Department Book'); }).join(' · ');
}
function cssStr(s){ return '"'+String(s).replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/[\r\n]+/g,' ')+'"'; }
function clip(s,n){ s=String(s||'').replace(/\s+/g,' ').trim(); return s.length>n?s.slice(0,n-1).replace(/\s+\S*$/,'')+'…':s; }

/* key states shown in the booklet. A question can carry more than one (e.g. corrected and still under review). */
var LBL={fix:'Key corrected',added:'Key added',doubt:'Doubtful key',review:'Under review',nokey:'No key',void:'Cancelled'};
var MEAN={
  fix:'The key printed in the source booklet was changed after review. The corrected key is the one shown here.',
  added:'The source booklet printed no key for this question. One was added after review.',
  doubt:'The printed key looks scientifically inaccurate. Use this question with caution.',
  review:'The key is being re-checked and may change.',
  nokey:'No reliable key is available yet. The question is left out of scoring.',
  void:'The question was cancelled in the source booklet and is left out of scoring.'
};
var CARD={fix:'',added:'The source booklet printed no key for this question; this one was added after review.',doubt:'The printed key looks scientifically inaccurate. Use this question with caution.',review:'Being re-checked: the key may change.',nokey:'No reliable key is available yet. The question is left out of scoring.',void:'Cancelled in the source booklet. The question is left out of scoring.'};
var ORDER=['fix','added','doubt','review','nokey','void'];
function flags(Q){
  var f=[];
  if(Q.canc) return ['void'];
  if(!Q.keys.length) return ['nokey'];
  if(Q.fix&&Q.bk) f.push('fix'); else if(Q.added) f.push('added');
  if(Q.alt) f.push('doubt');
  if(Q.review||(Q.rv&&!Q.fix)) f.push('review');
  return f;
}
function chip(t){ return h('span.pd-chip.'+t,{text:LBL[t]}); }

/* ---------- pieces ---------- */
function pageHead(title,right){ return h('div.pd-h',{},h('h2',{text:title}),right?h('span',{text:right}):null); }

function qBlock(Q,n,fl,mode){
  var two=Q.opts.length===4&&Q.opts.every(function(op){ return op.t.length<=28; });
  var opts=h('div.pd-o'+(two?'.two':''));
  Q.opts.forEach(function(op){
    var ok=mode==='inline'&&Q.keys.indexOf(op.o)>=0;
    opts.appendChild(h('div.pd-opt'+(ok?'.ok':''),{},h('span.pd-k',{text:op.o.toUpperCase()}),h('span.pd-t',{},op.t,ok?h('span.pd-chk',{html:CHK}):null)));
  });
  var src=srcTxt(Q);
  var box=h('div.pd-qb',{},src?h('div.pd-src',{text:'Source · '+src}):null,h('p.pd-stem',{text:Q.stem}));
  if(Q.fig) box.appendChild(h('figure.pd-fig',{},h('img',{src:IM.asset(Q.fig),alt:''})));
  box.appendChild(opts);
  if(mode==='inline') box.appendChild(h('div.pd-ans',{},h('span.pd-al',{text:'Answer'}),h('b',{text:Q.canc?'Cancelled':keyTxt(Q)}),fl.map(chip)));
  return h('div.pd-q',{},h('div.pd-qn',{},h('b',{text:String(n)})),box);
}

/* answer key: blocks of ten, a number row over an answer row (reads like a marking sheet) */
function keyBlocks(Qs,F){
  var wrap=h('div.pd-keys');
  for(var s=0;s<Qs.length;s+=10){
    var nr=h('tr.n',{},h('th',{text:'Q'})), ar=h('tr.a',{},h('th',{text:'Answer'}));
    for(var j=0;j<10;j++){
      var i=s+j;
      if(i<Qs.length){
        var Q=Qs[i];
        nr.appendChild(h('td',{text:String(i+1)}));
        ar.appendChild(h('td'+(Q.canc?'.void':''),{},Q.canc?'Void':keyTxt(Q),F[i]&&F[i].length?h('span.pd-fl',{text:'*'}):null));
      } else { nr.appendChild(h('td.pd-pad')); ar.appendChild(h('td.pd-pad')); }
    }
    wrap.appendChild(h('table.pd-kt',{},h('tbody',{},nr,ar)));
  }
  return wrap;
}

function keyBox(label,val,main){ return h('div.pd-kb'+(main?'.main':''),{},h('small',{text:label}),h('b',{text:val})); }
function noteCard(Q,n,fl){
  var top=h('div.pd-nc-top',{},fl.map(chip));
  if(fl.indexOf('fix')>=0||fl.indexOf('added')>=0){ var d=enDate(Q.late); if(d) top.appendChild(h('span.pd-nc-date',{text:(fl.indexOf('fix')>=0?'Corrected ':'Added ')+d})); }
  var boxes=h('div.pd-kbs');
  if(fl.indexOf('fix')>=0){
    boxes.appendChild(keyBox('Printed key',String(Q.bk||'').split(',').map(function(k){return k.trim().toUpperCase()}).join(' + '),false));
    boxes.appendChild(h('span.pd-arrow',{text:'→'}));
    boxes.appendChild(keyBox('Approved key',keyTxt(Q),true));
  } else if(fl.indexOf('doubt')>=0){
    boxes.appendChild(keyBox('Printed key',keyTxt(Q),false));
    boxes.appendChild(keyBox('Likely answer',Q.alt&&Q.alt!=='?'?String(Q.alt).toUpperCase():'Not decided',true));
  } else if(fl.indexOf('void')<0&&fl.indexOf('nokey')<0){
    boxes.appendChild(keyBox(fl.indexOf('added')>=0?'Approved key':'Key as printed',keyTxt(Q),true));
  }
  var why=h('div.pd-nc-why',{},fl.filter(function(t){ return CARD[t]; }).map(function(t){ return h('p',{text:CARD[t]}); }));
  return h('div.pd-nc',{},h('div.pd-nc-n',{},h('small',{text:'Question'}),h('b',{text:String(n)})),
    h('div.pd-nc-b',{},top,h('p.pd-nc-q',{text:clip(Q.stem,130)}),boxes.childNodes.length?boxes:null,why.childNodes.length?why:null));
}

/* builds the booklet DOM. o: {title, ids, answers:'end'|'inline'|'none', notes:bool, sid, name} */
IM.printDoc=function(o){
  var mode=o.answers||'end', noteOn=!!o.notes&&mode!=='none';
  var Qs=o.ids.map(function(id){ return IM.bank.q[id]; }), N=Qs.length, today=enDate(IM.dayKey());
  var sids=[]; Qs.forEach(function(Q){ if(sids.indexOf(Q.sid)<0) sids.push(Q.sid); });
  var multi=sids.length>1, subLabel=multi?sids.map(subEn).join(' · '):subEn(sids[0]||o.sid);
  var title=(o.title||'').trim()||(subLabel+' · Questions');

  /* sections in the order they appear: first question number + how many */
  var secs=[], lastK=null;
  Qs.forEach(function(Q,i){ var k=Q.sid+':'+Q.sec; if(k!==lastK){ lastK=k; var s=secInfo(Q); s.at=i+1; s.n=0; secs.push(s); } secs[secs.length-1].n++; });
  var nFig=Qs.filter(function(Q){ return Q.fig; }).length;
  var F=Qs.map(function(Q){ return noteOn?flags(Q):[]; }), used={}, nNoted=0;
  F.forEach(function(a){ if(a.length) nNoted++; a.forEach(function(t){ used[t]=(used[t]||0)+1; }); });

  var doc=h('div.pd',{lang:'en',dir:'ltr','data-notr':''});      /* the booklet is English whatever the site language is: the i18n layer must not touch it */
  /* page furniture (running title + date) is set per document through the @page margin boxes */
  doc.appendChild(h('style',{text:'@media print{@page{@top-left{content:'+cssStr('Imhotep  ·  '+clip(title,64))+'}@top-right{content:'+cssStr(today)+'}}@page :first{@top-left{content:none}@top-right{content:none}}}'}));

  /* ---- cover ---- */
  var facts=[['Subject',subLabel],['Questions',String(N)],['Sections',String(secs.length)]];
  if(nFig) facts.push(['Figures',String(nFig)]);
  facts.push(['Answers',{end:'Answer key at the end',inline:'Shown under each question',none:'Not included (exam paper)'}[mode]]);
  if(o.name) facts.push(['Prepared for',o.name]);
  facts.push(['Issued',today]);
  doc.appendChild(h('section.pd-cover',{},h('div.pd-cv',{},
    h('div.pd-cv-top',{},
      h('div.pd-mark',{html:IM.pyr(6,{})}),
      h('div.pd-brand',{text:'IMHOTEP'}),
      h('div.pd-brand-sub',{text:'Medical Question Bank'})),
    h('div.pd-cv-mid',{},
      h('div.pd-cv-rule'),
      h('h1.pd-title',{text:title}),
      h('table.pd-facts',{},h('tbody',{},facts.map(function(f){ return h('tr',{},h('th',{text:f[0]}),h('td',{text:f[1]})); }))),
      mode==='none'?h('div.pd-sheet',{},h('div',{},h('span',{text:'Name'})),h('div',{},h('span',{text:'Date'})),h('div',{},h('span',{text:'Score'}),h('em',{text:'/ '+N}))):null),
    h('p.pd-by',{text:CREDIT}))));

  /* ---- contents ---- */
  var stats=[[String(N),N===1?'Question':'Questions'],[String(secs.length),secs.length===1?'Section':'Sections']];
  if(multi) stats.push([String(sids.length),'Subjects']);
  if(nFig) stats.push([String(nFig),nFig===1?'Figure':'Figures']);
  if(noteOn&&nNoted) stats.push([String(nNoted),nNoted===1?'Key note':'Key notes']);
  var idx=h('section.pd-index',{},pageHead('Contents',subLabel),
    h('div.pd-stats',{},stats.map(function(s){ return h('div',{},h('b',{text:s[0]}),h('span',{text:s[1]})); })));

  var guide=[];
  if(mode==='end') guide.push(['Answers','The answer key follows the last question. Look the question number up in the table.']);
  else if(mode==='inline') guide.push(['Answers','The correct answer is shown under each question and ticked in the option list.']);
  else guide.push(['Answers','No answers are included in this paper.']);
  guide.push(['Questions','Each question lists its source (department booklet, exam year) above the stem when it is known.']);
  var gl=h('div.pd-guide',{},h('div.pd-gt',{text:'How to use this booklet'}),guide.map(function(g){ return h('div.pd-gr',{},h('span.pd-gk',{text:g[0]}),h('span',{text:g[1]})); }));
  if(noteOn&&nNoted){
    if(mode==='end') gl.appendChild(h('div.pd-gr',{},h('span.pd-gk',{text:'Asterisk (*)'}),h('span',{text:'An asterisk beside an answer means that key has a note. See Notes on Keys at the end.'})));
    ORDER.forEach(function(t){ if(used[t]) gl.appendChild(h('div.pd-gr',{},h('span.pd-gk',{},chip(t)),h('span',{text:MEAN[t]}))); });
  }
  idx.appendChild(gl);

  var tb=h('tbody'), lastSub=null, lastPart=null;
  secs.forEach(function(s,i){
    if(multi&&s.sid!==lastSub){ lastSub=s.sid; lastPart=null; tb.appendChild(h('tr.pd-subj',{},h('td',{colspan:'4',text:s.sub}))); }
    var pk=s.part?s.part.key:null;
    if(pk&&pk!==lastPart){ lastPart=pk; tb.appendChild(h('tr.pd-part',{},h('td',{colspan:'4',text:partTxt(s.part)}))); }
    tb.appendChild(h('tr',{},h('td.no',{text:String(i+1)}),h('td.nm',{text:s.name}),h('td.qn',{text:String(s.n)}),h('td.rg',{text:rangeTxt(s.at,s.n)})));
  });
  idx.appendChild(h('table.pd-idx',{},h('thead',{},h('tr',{},h('th.no',{text:'No.'}),h('th',{text:'Section'}),h('th.qn',{text:'Questions'}),h('th.rg',{text:'Numbers'}))),tb));
  doc.appendChild(idx);

  /* ---- questions ---- */
  var qs=h('section.pd-qs'), lastS=-1, secNo=-1;
  Qs.forEach(function(Q,i){
    var k=Q.sid+':'+Q.sec;
    if(secNo<0||k!==(Qs[i-1].sid+':'+Qs[i-1].sec)){
      secNo++; var s=secs[secNo];
      qs.appendChild(h('div.pd-sec',{},
        h('div',{},h('span.pd-sec-eb',{text:'Section '+(secNo+1)+(multi?' · '+s.sub:'')+(s.part?' · '+partTxt(s.part):'')}),h('h3.pd-sec-t',{text:s.name||'Questions'})),
        h('div.pd-sec-r',{},h('b',{text:rangeTxt(s.at,s.n)}),h('small',{text:s.n+(s.n===1?' question':' questions')}))));
    }
    qs.appendChild(qBlock(Q,i+1,F[i],mode));
  });
  doc.appendChild(qs);

  /* ---- answer key ---- */
  if(mode==='end'){
    var key=h('section.pd-key',{},pageHead('Answer Key',N+(N===1?' question':' questions')),
      h('p.pd-lead',{text:'Find the question number in the top row; the answer is directly below it.'+(noteOn&&nNoted?' An asterisk (*) means the key has a note (see Notes on Keys).':'')+(used.void?' “Void” marks a cancelled question.':'')}),
      keyBlocks(Qs,F));
    doc.appendChild(key);
  }

  /* ---- notes on keys ---- */
  if(noteOn&&nNoted){
    var cards=[]; Qs.forEach(function(Q,i){ if(F[i].length) cards.push(noteCard(Q,i+1,F[i])); });
    doc.appendChild(h('section.pd-notes',{},pageHead('Notes on Keys',nNoted+(nNoted===1?' question':' questions')),
      h('p.pd-lead',{text:'These questions have a key that was corrected, added, doubted, withheld or is still being reviewed. Every other question uses the key exactly as printed in its source. The full explanations are in the Imhotep app.'}),
      h('div.pd-ncs',{},cards)));
  }
  doc.appendChild(h('div.pd-end',{},h('span',{text:'End of booklet'})));
  return doc;
};

IM.printNow=function(doc,fileTitle){
  var root=document.getElementById('printRoot');
  if(!root){ root=h('div#printRoot'); document.body.appendChild(root); }
  IM.clear(root); root.appendChild(doc);
  /* the browser proposes the document title as the PDF file name */
  var oldTitle=document.title;
  if(fileTitle) document.title=String(fileTitle).replace(/[\\\/:*?"<>|]+/g,' ').replace(/\s+/g,' ').trim()||oldTitle;
  var imgs=IM.$$('img',root), waits=imgs.map(function(im){ return im.complete?Promise.resolve():new Promise(function(r){ im.onload=im.onerror=r; }); });
  if(document.fonts&&document.fonts.load){
    ['400 10pt "IBM Plex Sans Arabic"','600 10pt "IBM Plex Sans Arabic"','700 10pt "IBM Plex Sans Arabic"','400 14pt "Marcellus"'].forEach(function(f){ try{ waits.push(document.fonts.load(f,'Aa1 Question')); }catch(e){} });
  }
  function after(){ document.body.classList.remove('printing'); IM.clear(root); document.title=oldTitle; window.removeEventListener('afterprint',after); }
  window.addEventListener('afterprint',after);
  return Promise.race([Promise.all(waits).catch(function(){}),new Promise(function(r){ setTimeout(r,4000); })]).then(function(){ document.body.classList.add('printing'); setTimeout(function(){ window.print(); },60); });
};

IM.printDialog=function(cfg){
  var S=IM.bank.subs[cfg.sid]||{ar:'كل المواد',secs:{}};
  var c0=Object.assign({},cfg,{count:0}); var pool=IM.pool(c0);
  if(!pool.length){ IM.toast('مفيش أسئلة مطابقة للتصدير.',{kind:'bad'}); return; }
  var want=cfg.count>0?Math.min(cfg.count,pool.length):pool.length;
  var oneSec=cfg.secs&&cfg.secs.length===1&&S.secs[cfg.secs[0]]?nice(S.secs[cfg.secs[0]].en):'';
  var defTitle=subEn(cfg.sid)+' · Questions'+(oneSec?' · '+oneSec:'');
  var nm=(IM.st.user&&IM.st.user.name)||''; if(hasAr(nm)) nm='';
  var title=h('input.field-i',{type:'text',maxlength:80,value:defTitle,dir:'ltr',lang:'en'});
  var who=h('input.field-i',{type:'text',maxlength:40,value:nm,dir:'ltr',lang:'en',placeholder:'Optional'});
  var cnt=h('input.field-i.min-i',{type:'number',min:1,max:pool.length,value:want,dir:'ltr'});
  var ans=h('select.field-i',{},h('option',{value:'end',text:'مفتاح الإجابات في آخر الملف'}),h('option',{value:'inline',text:'الإجابة تحت كل سؤال'}),h('option',{value:'none',text:'من غير إجابات (ورقة امتحان)'}));
  var shuf=h('input.sw',{type:'checkbox','aria-label':'ترتيب عشوائي'}), notes=h('input.sw',{type:'checkbox',checked:true,'aria-label':'ملاحظات المفاتيح'});
  function sw(l,i){ return h('label.field.sw-f',{},h('span.sw-l',{text:l}),i); }
  var msg=h('p.muted.ws-h',{text:'المتاح للتصدير: '+pool.length+' سؤال.'});
  var body=h('div.form',{},h('label.label',{text:'عنوان الملف (بالإنجليزي)'}),title,h('label.label',{text:'اسم الطالب على الغلاف (اختياري)'}),who,h('label.label',{text:'عدد الأسئلة'}),cnt,h('label.label',{text:'الإجابات'}),ans,sw('ترتيب عشوائي',shuf),sw('اطبع ملاحظات المفاتيح (التصحيحات والشك العلمي)',notes),msg,
    h('p.muted.ws-h',{text:'هيفتح نافذة الطباعة: اختار «حفظ كـ PDF» وورق A4، وشغّل «Background graphics» وطفّي «Headers and footers». ملف الـPDF بالإنجليزي بالكامل ومفيش حاجة بتتبعت لأي مكان.'}));
  var go=h('button.btn.primary',{type:'button',onclick:function(){
    var n=IM.clamp(Math.round(+cnt.value)||want,1,pool.length), ids=pool.slice();
    if(shuf.checked) ids=IM.shuffle(ids);
    ids=ids.slice(0,n); if(!shuf.checked) ids.sort(function(a,b){ return IM.bank.q[a].seq-IM.bank.q[b].seq; });
    go.disabled=true; go.textContent='بنجهّز الملف…';
    var t=title.value.trim()||defTitle;
    var doc=IM.printDoc({sid:cfg.sid,title:t,ids:ids,answers:ans.value,notes:notes.checked,name:who.value.trim()});
    IM.printNow(doc,t).then(function(){ dlg.close(); });
  }},icon('print',18),'طباعة / حفظ PDF');
  var dlg=IM.modal({title:'تصدير PDF',body:body,foot:[go,h('button.btn.ghost',{type:'button',onclick:function(){ dlg.close(); }},'إلغاء')]});
};
})();
