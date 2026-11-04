/* Imhotep · إمحتب — export to PDF: a printable booklet (cover, index, numbered questions, answer key).
   Nothing leaves the device: it builds a print-only page and calls the browser's print dialog ("Save as PDF"). */
(function(){
'use strict';
var IM=window.IM, h=IM.h, icon=IM.icon;

function keyTxt(Q){ return Q.keys.length?Q.keys.map(function(k){return k.toUpperCase()}).join(' + '):'—'; }

/* builds the booklet DOM. o: {title, ids, answers:'end'|'inline'|'none', notes:bool, sid} */
IM.printDoc=function(o){
  var S=IM.bank.subs[o.sid], ids=o.ids, today=IM.fmtDate(IM.dayKey());
  var doc=h('div.pd');
  /* cover */
  doc.appendChild(h('section.pd-cover',{},
    h('div.pd-mark',{html:IM.pyr(6,{})}),
    h('div.pd-brand',{},h('span.pd-en',{text:'IMHOTEP'}),h('span.pd-ar',{text:'إمحتب'})),
    h('h1.pd-title',{text:o.title}),
    h('div.pd-meta',{},h('div',{},h('b',{text:String(ids.length)}),' سؤال'),h('div',{text:IM.subName(o.sid)}),h('div',{text:today}),IM.st.user?h('div',{text:'للطالب: '+IM.st.user.name}):null),
    h('p.pd-by',{},'Made By Dr.Saif Youssry')));
  /* index: sections in the order they appear, with the first question number */
  var idx=[], last=null;
  ids.forEach(function(id,i){ var Q=IM.bank.q[id]; if(Q.sec!==last){ last=Q.sec; var sec=S.secs[Q.sec]; idx.push({sec:sec,at:i+1,n:0}); } idx[idx.length-1].n++; });
  var tb=h('table.pd-idx',{},h('thead',{},h('tr',{},h('th',{text:'القسم'}),h('th',{text:'من سؤال'}),h('th',{text:'العدد'}))));
  var tbody=h('tbody'); idx.forEach(function(x){ tbody.appendChild(h('tr',{},h('td',{dir:'ltr',lang:'en',text:x.sec.en+(x.sec.ar&&x.sec.ar!==x.sec.en?' · '+x.sec.ar:'')}),h('td.mono',{text:String(x.at)}),h('td.mono',{text:String(x.n)}))); }); tb.appendChild(tbody);
  doc.appendChild(h('section.pd-index',{},h('h2',{text:'الفهرس'}),tb));
  /* questions */
  var qs=h('section.pd-qs',{}); last=null;
  ids.forEach(function(id,i){
    var Q=IM.bank.q[id];
    if(Q.sec!==last){ last=Q.sec; var sec=S.secs[Q.sec]; qs.appendChild(h('h3.pd-sec',{dir:'ltr',lang:'en',text:sec.en+(sec.ar&&sec.ar!==sec.en?' · '+sec.ar:'')})); }
    var box=h('div.pd-q'), opts=h('div.pd-o',{dir:'ltr',lang:'en'});
    Q.opts.forEach(function(op){ opts.appendChild(h('div.pd-opt',{},h('span.pd-k',{text:op.o.toUpperCase()}),h('span',{text:op.t}))); });
    box.appendChild(h('div.pd-qh',{},h('span.pd-n',{text:String(i+1)}),Q.tags.length?h('span.pd-tag',{text:Q.tags.join(' · ')}):null));
    box.appendChild(h('p.pd-stem',{dir:'ltr',lang:'en',text:Q.stem}));
    if(Q.fig) box.appendChild(h('img.pd-fig',{src:IM.asset(Q.fig),alt:''}));
    box.appendChild(opts);
    if(o.answers==='inline') box.appendChild(h('p.pd-ans',{},'الإجابة: ',h('b.mono',{text:keyTxt(Q)})));
    qs.appendChild(box);
  });
  doc.appendChild(qs);
  /* answer key + notes */
  if(o.answers==='end'){
    var grid=h('div.pd-grid');
    ids.forEach(function(id,i){ var Q=IM.bank.q[id]; grid.appendChild(h('div.pd-gk',{},h('span.mono.pd-gn',{text:String(i+1)}),h('b.mono',{text:Q.canc?'ملغي':keyTxt(Q)}))); });
    doc.appendChild(h('section.pd-key',{},h('h2',{text:'مفتاح الإجابات'}),grid));
  }
  if(o.notes&&o.answers!=='none'){
    var nl=[]; ids.forEach(function(id,i){
      var Q=IM.bank.q[id], t=null;
      if(Q.fix&&Q.bk) t='اتصحّح المفتاح: المطبوع '+Q.bk.toUpperCase()+' والمعتمد '+keyTxt(Q)+(Q.fx?'. '+Q.fx:'');
      else if(Q.fx) t=Q.fx;
      else if(Q.alt) t='مفتاح الملزمة هنا شكله غير دقيق علميًا'+(Q.alt!=='?'?'، والأرجح '+Q.alt.toUpperCase():'')+'.';
      else if(Q.review) t='قيد المراجعة.';
      if(t) nl.push(h('li',{},h('b.mono',{text:String(i+1)}),' ',t));
    });
    if(nl.length) doc.appendChild(h('section.pd-notes',{},h('h2',{text:'ملاحظات على المفاتيح'}),h('ul',{},nl)));
  }
  return doc;
};

IM.printNow=function(doc){
  var root=document.getElementById('printRoot');
  if(!root){ root=h('div#printRoot'); document.body.appendChild(root); }
  IM.clear(root); root.appendChild(doc);
  var imgs=IM.$$('img',root), waits=imgs.map(function(im){ return im.complete?Promise.resolve():new Promise(function(r){ im.onload=im.onerror=r; }); });
  function after(){ document.body.classList.remove('printing'); IM.clear(root); window.removeEventListener('afterprint',after); }
  window.addEventListener('afterprint',after);
  return Promise.race([Promise.all(waits),new Promise(function(r){ setTimeout(r,4000); })]).then(function(){ document.body.classList.add('printing'); setTimeout(function(){ window.print(); },60); });
};

IM.printDialog=function(cfg){
  var S=IM.bank.subs[cfg.sid];
  var c0=Object.assign({},cfg,{count:0}); var pool=IM.pool(c0);
  if(!pool.length){ IM.toast('مفيش أسئلة مطابقة للتصدير.',{kind:'bad'}); return; }
  var want=cfg.count>0?Math.min(cfg.count,pool.length):pool.length;
  var title=h('input.field-i',{type:'text',maxlength:80,value:S.ar+' · أسئلة'+(cfg.secs&&cfg.secs.length===1&&S.secs[cfg.secs[0]]?' · '+S.secs[cfg.secs[0]].en:'')});
  var cnt=h('input.field-i.min-i',{type:'number',min:1,max:pool.length,value:want,dir:'ltr'});
  var ans=h('select.field-i',{},h('option',{value:'end',text:'مفتاح الإجابات في آخر الملف'}),h('option',{value:'inline',text:'الإجابة تحت كل سؤال'}),h('option',{value:'none',text:'من غير إجابات (ورقة امتحان)'}));
  var shuf=h('input.sw',{type:'checkbox','aria-label':'ترتيب عشوائي'}), notes=h('input.sw',{type:'checkbox',checked:true,'aria-label':'ملاحظات المفاتيح'});
  function sw(l,i){ return h('label.field.sw-f',{},h('span.sw-l',{text:l}),i); }
  var msg=h('p.muted.ws-h',{text:'المتاح للتصدير: '+pool.length+' سؤال.'});
  var body=h('div.form',{},h('label.label',{text:'عنوان الملف'}),title,h('label.label',{text:'عدد الأسئلة'}),cnt,h('label.label',{text:'الإجابات'}),ans,sw('ترتيب عشوائي',shuf),sw('اطبع ملاحظات المفاتيح (التصحيحات والشك العلمي)',notes),msg,
    h('p.muted.ws-h',{text:'هيفتح نافذة الطباعة، اختار منها «حفظ كـ PDF». مفيش حاجة بتتبعت لأي مكان.'}));
  var go=h('button.btn.primary',{type:'button',onclick:function(){
    var n=IM.clamp(Math.round(+cnt.value)||want,1,pool.length), ids=pool.slice();
    if(shuf.checked) ids=IM.shuffle(ids);
    ids=ids.slice(0,n); if(!shuf.checked) ids.sort(function(a,b){ return IM.bank.q[a].seq-IM.bank.q[b].seq; });
    go.disabled=true; go.textContent='بنجهّز الملف…';
    var doc=IM.printDoc({sid:cfg.sid,title:title.value.trim()||(S.ar+' · أسئلة'),ids:ids,answers:ans.value,notes:notes.checked});
    IM.printNow(doc).then(function(){ dlg.close(); });
  }},icon('print',18),'طباعة / حفظ PDF');
  var dlg=IM.modal({title:'تصدير PDF',body:body,foot:[go,h('button.btn.ghost',{type:'button',onclick:function(){ dlg.close(); }},'إلغاء')]});
};
})();
