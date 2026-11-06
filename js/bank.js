/* Imhotep · إمحتب — bank: loads the ORIGINAL content files untouched and builds the question model from them */
(function(){
'use strict';
var IM=window.IM;

/* ---------- subjects registry ---------- */
IM.modules=[{id:'m1',ar:'الموديول الأول',en:'Module 1',subjects:['anatomy','histology','biochemistry']}];
IM.subjects=[
  {id:'anatomy',en:'Anatomy',ar:'التشريح',cls:'sub-anat',mod:'m1',ready:true,
   content:'subjects/anatomy/anatomy.content.js',data:'subjects/anatomy/data.js',
   blurb:'نص الكتاب وبطاقات الاسترجاع وأسئلة الملزمة بمفاتيحها المطبوعة.'},
  {id:'histology',en:'Histology',ar:'الهستولوجيا',cls:'sub-hist',mod:'m1',ready:true,
   content:'subjects/histology/histology.content.js',data:null,
   blurb:'أسئلة د. زهرة بمفاتيحها. النص والبطاقات لاحقًا.'},
  {id:'biochemistry',en:'Biochemistry',ar:'الكيمياء الحيوية',cls:'sub-bio',mod:'m1',ready:true,
   content:'subjects/biochemistry/biochemistry.content.js',data:'subjects/biochemistry/data.js',
   blurb:'نص كتاب د. هشام عصمت بصوره، وبطاقات، وأسئلة الملزمة بمفاتيحها.'},
  {id:'physiology',en:'Physiology',ar:'وظائف الأعضاء',cls:'sub-phys',mod:'m1',ready:false,blurb:'المادة الرابعة، بتتضاف قريب.'}
];
IM.subject=function(id){ for(var i=0;i<IM.subjects.length;i++) if(IM.subjects[i].id===id) return IM.subjects[i]; return null; };

var bank=IM.bank={subs:{},q:{},order:[],ready:false,single:false};

/* ---------- source access: files next to index.html (tree) or base64 payloads inside it (single file) ---------- */
function b64text(b64){
  var bin=atob(b64), n=bin.length, u=new Uint8Array(n);
  for(var i=0;i<n;i++) u[i]=bin.charCodeAt(i);
  return new TextDecoder('utf-8').decode(u);
}
var payloads=null;
function findPayloads(){
  payloads={};
  IM.$$('script[type="text/im-src"]').forEach(function(s){ payloads[s.getAttribute('data-path')]=s; });
  bank.single=Object.keys(payloads).length>0;
}
function runText(text){ var s=document.createElement('script'); s.textContent=text; document.head.appendChild(s); document.head.removeChild(s); }
function loadFile(path){
  return new Promise(function(res,rej){
    if(!payloads) findPayloads();
    if(payloads[path]){ try{ var el=payloads[path]; if(el._txt==null) el._txt=b64text(el.textContent.trim()); runText(el._txt); el._txt=null; el.textContent=''; res(); }catch(e){ rej(e) } return; }
    var s=document.createElement('script'); s.src=path; s.async=false;
    s.onload=function(){ res() }; s.onerror=function(){ rej(new Error('تعذّر تحميل '+path)) };
    document.head.appendChild(s);
  });
}
/* images referenced by the original book markup: in single-file mode they are base64 payloads decoded lazily into blob URLs */
var blobs={}, assetEls=null;
IM.asset=function(path){
  if(!assetEls){ assetEls={}; IM.$$('script[type="text/im-asset"]').forEach(function(s){ assetEls[s.getAttribute('data-path')]=s; }); }
  var el=assetEls[path]; if(!el) return path;
  if(blobs[path]) return blobs[path];
  var bin=atob(el.textContent.trim()), n=bin.length, u=new Uint8Array(n);
  for(var i=0;i<n;i++) u[i]=bin.charCodeAt(i);
  blobs[path]=URL.createObjectURL(new Blob([u],{type:el.getAttribute('data-mime')||'application/octet-stream'}));
  return blobs[path];
};
IM.fixImgs=function(root){
  IM.$$('img',root).forEach(function(im){
    var s=im.getAttribute('src')||''; if(s.indexOf('assets/')===0){ im.setAttribute('src',IM.asset(s)); }
    if(!im.hasAttribute('loading')) im.setAttribute('loading','lazy'); im.setAttribute('decoding','async');
  });
};

/* ---------- helpers ---------- */
function norm(x){ return String(x||'').toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g,''); }
function cleanText(t){ return String(t==null?'':t).replace(/\s+/g,' ').trim(); }
function splitDash(sm){ /* "— علم الخلية · 385 سؤال · Dr. Zahra MCQs" -> "علم الخلية" */
  if(!sm) return ''; var t=cleanText(sm.textContent).replace(/^[—–-]\s*/,''); return cleanText(t.split(' · ')[0]);
}
function firstText(el){ var n=el&&el.firstChild; var out=''; while(n&&n.nodeType===3){ out+=n.nodeValue; n=n.nextSibling; } return cleanText(out); }
var NUM_RE=/^\s*(\d+[a-z]?)\s*[-.)]\s*/;
var SRC_TRAIL=/\s*\(([^()]*(?:DEP BOOK|IPKA|(?:19|20)\d\d)[^()]*)\)\s*$/;

/* source groups shown as filter chips (a question can belong to several) */
IM.srcGroups=function(tag){
  var t=cleanText(tag), g=[];
  if(!t) return ['بدون وسم'];
  var t2=t.replace(/OLD DEP BOOK/gi,' ');
  if(/OLD DEP BOOK/i.test(t)) g.push('OLD DEP BOOK');
  if(/\bDEP\b/i.test(t2)) g.push('DEP BOOK');
  if(/IPKA/i.test(t)) g.push('IPKA');
  if(/Module/i.test(t)) g.push('Module');
  if(/Exam/i.test(t)) g.push('Exam');
  if(/Final/i.test(t)) g.push('Final');
  if(/Revision/i.test(t)) g.push('Revision');
  var hasKw=/Module|Exam|Final|Revision/i.test(t);
  if(!hasKw&&(/\b(19|20)\d\d\b/.test(t)||/^\d\d\s*-\s*\d\d$/.test(t))) g.push('سنوات');
  if(!g.length) g.push('أخرى');
  return g;
};

/* ---------- parse one subject from its original package ---------- */
function parseSubject(meta,pkg,data){
  var doc=new DOMParser().parseFromString('<!doctype html><html><body>'+pkg.body+'</body></html>','text/html');
  var head=new DOMParser().parseFromString('<!doctype html><html><body>'+pkg.headA+'</body></html>','text/html');
  var S={id:meta.id,meta:meta,en:meta.en,ar:meta.ar,cls:meta.cls,
    eyebrow:cleanText((head.querySelector('.eyebrow')||{}).textContent||''),
    parts:[],secs:{},qids:[],chapters:[],cards:[],pairs:[],srcLabel:''};
  var seq=0;
  function pushQ(Q,part,sec){
    Q.sid=meta.id; Q.part=part.id; Q.sec=sec.id; Q.seq=seq++;
    if(IM.applyFix) IM.applyFix(Q);   /* تصحيحات ما بعد الداتا (js/fixes.js): الداتا نفسها ما بتتعدّلش */
    Q.sources=Q.tags.length?Q.tags:[]; Q.groups=[]; Q.tags.forEach(function(t){ IM.srcGroups(t).forEach(function(g){ if(Q.groups.indexOf(g)<0) Q.groups.push(g) }) });
    if(!Q.groups.length) Q.groups.push('بدون وسم');
    Q.elig=(Q.keys.length>0&&!Q.canc&&Q.keys.every(function(k){ return Q.opts.some(function(o){return o.o===k}) }));
    var m=Q.id.match(/^(.*\d)[a-z]$/); Q.block=m?m[1]:'';
    bank.q[Q.id]=Q; S.qids.push(Q.id); sec.qids.push(Q.id); sec.total++; if(Q.elig) sec.n++; part.total++; if(Q.elig) part.n++;
  }
  function readGq(el){
    var qt=el.querySelector('.qt'), c=qt.cloneNode(true), warns=[], tags=[], fixTag=false;
    IM.$$('.gtag',qt).forEach(function(g){
      var cl=g.classList, t=cleanText(g.textContent);
      if(cl.contains('warn')) warns.push(t); else if(cl.contains('fix')) fixTag=true; else if(t) tags.push(t);
    });
    IM.$$('.gtag',c).forEach(function(g){ g.remove() });
    var raw=cleanText(c.textContent), nm=raw.match(NUM_RE), n=nm?nm[1]:'', stem=nm?raw.replace(NUM_RE,''):raw;
    var opts=IM.$$('.opts li',el).map(function(li){ var o=li.getAttribute('data-o')||'', t=cleanText(li.textContent).replace(/^[a-h]\s*[-.)]\s*/i,''); return {o:o,t:t}; });
    var k=el.getAttribute('data-k')||'', fig=el.querySelector('.qfig');
    return {id:el.getAttribute('data-id'),n:n,stem:stem,opts:opts,keys:k?k.split(',').map(function(x){return x.trim()}).filter(Boolean):[],
      bk:el.getAttribute('data-bk')||'',fx:el.getAttribute('data-fx')||'',
      alt:el.hasAttribute('data-alt')?(el.getAttribute('data-alt')||'?'):'',
      canc:el.hasAttribute('data-canc'),rv:el.hasAttribute('data-rv')?(el.getAttribute('data-rv')||'قيد المراجعة'):'',
      review:warns.some(function(w){return /قيد المراجعة/.test(w)}),fix:!!el.getAttribute('data-bk')||fixTag,
      fig:fig?fig.getAttribute('src'):'',tags:tags,warns:warns};
  }
  /* --- the question bank (Dr.X MCQs pane) --- */
  var og=doc.querySelector('#gSel optgroup[data-srclabel]'); if(og) S.srcLabel=og.getAttribute('data-srclabel')||'';
  IM.$$('#tab-galal .gpart',doc).forEach(function(gp){
    var h2=gp.querySelector('h2'), htxt=firstText(h2), m=htxt.match(/^(Chapter|Part)\s+(\d+)\s*·\s*(.*)$/);
    var part={id:'p'+(gp.getAttribute('data-part')||S.parts.length+1),num:m?+m[2]:S.parts.length+1,kind:m?m[1]:'Chapter',
      en:m?m[3]:htxt,ar:splitDash(h2&&h2.querySelector('small')),secs:[],total:0,n:0};
    IM.$$('.gsec',gp).forEach(function(sc){
      var h3=sc.querySelector('h3'), sec={id:sc.getAttribute('data-g'),part:part.id,en:firstText(h3),ar:splitDash(h3&&h3.querySelector('small')),qids:[],total:0,n:0};
      part.secs.push(sec); S.secs[sec.id]=sec;
      IM.$$('.gq',sc).forEach(function(el){ pushQ(readGq(el),part,sec); });
    });
    S.parts.push(part);
  });
  /* --- book tests (anatomy only): same questions printed at the end of every chapter --- */
  var bt=doc.querySelector('#tab-tests');
  if(bt&&bt.querySelector('.q')){
    var bp={id:'pbk',num:S.parts.length+1,kind:'Book',en:'Book tests',ar:'اختبارات الكتاب',secs:[],total:0,n:0,isBook:true};
    IM.$$('.tsec',bt).forEach(function(ts){
      var h3=ts.querySelector('h3'), en=firstText(h3).replace(/\s*TEST\s*$/i,'');
      var sec={id:'bk_'+ts.getAttribute('data-ch'),part:bp.id,en:en,ar:splitDash(h3&&h3.querySelector('small')),qids:[],total:0,n:0};
      bp.secs.push(sec); S.secs[sec.id]=sec;
      IM.$$('.q',ts).forEach(function(el){
        var qt=el.querySelector('.qt'), raw=cleanText(qt.textContent), nm=raw.match(NUM_RE), tag='', stem=nm?raw.replace(NUM_RE,''):raw;
        var tm=stem.match(SRC_TRAIL); if(tm){ tag=cleanText(tm[1]); stem=stem.replace(SRC_TRAIL,''); }
        var opts=IM.$$('.opts li',el).map(function(li){ return {o:li.getAttribute('data-o')||'',t:cleanText(li.textContent).replace(/^[a-h]\s*[-.)]\s*/i,'')}; });
        var k=el.getAttribute('data-k')||'';
        pushQ({id:el.getAttribute('data-id'),n:nm?nm[1]:'',stem:stem,opts:opts,keys:k?k.split(',').filter(Boolean):[],bk:'',fx:'',alt:'',canc:false,rv:'',review:false,fix:false,fig:'',tags:tag?[tag]:[],warns:[]},bp,sec);
      });
    });
    S.parts.push(bp);
  }
  /* --- book chapters (study pane) --- */
  IM.$$('#tab-study section.chapter',doc).forEach(function(ch){
    var h2=ch.querySelector('h2'), ar=ch.querySelector('.ch-ar'), pg=ch.querySelector('.pgs bdi');
    S.chapters.push({id:ch.getAttribute('data-ch'),num:cleanText((ch.querySelector('.ch-num')||{}).textContent),en:cleanText(h2&&h2.textContent),
      ar:cleanText(ar?firstText(ar):''),pages:pg?cleanText(pg.textContent):'',html:ch.outerHTML,secs:IM.$$('.bk-sec',ch).length});
  });
  /* --- flashcards / pairs (data.js) --- */
  if(data){
    S.cards=(data.cards||[]).map(function(c,i){ return {i:i,ch:c.ch,f:c.f,b:c.b,p:c.p,x:!!c.x}; }).filter(function(c){return !c.x});
    S.pairs=data.pairs||[];
    var byId={}; (data.chapters||[]).forEach(function(c){ byId[c.id]=c; });
    S.cardChapters=data.chapters||[];
  }
  /* --- duplicates (same text + same options, any order) and stimulus blocks --- */
  var groups={};
  S.qids.forEach(function(id){
    var Q=bank.q[id], key=norm(Q.stem)+'|'+Q.opts.map(function(o){return norm(o.t)}).sort().join('|');
    (groups[key]=groups[key]||[]).push(id);
  });
  S.dupGroups=[];
  Object.keys(groups).forEach(function(k){ var g=groups[k]; if(g.length>1){ S.dupGroups.push(g); for(var i=1;i<g.length;i++) bank.q[g[i]].dupOf=g[0]; } });
  S.total=S.qids.length; S.n=S.qids.filter(function(id){return bank.q[id].elig}).length;
  S.groupsList=(function(){ var c={}; S.qids.forEach(function(id){ bank.q[id].groups.forEach(function(g){ c[g]=(c[g]||0)+1 }) }); return Object.keys(c).map(function(g){return {g:g,n:c[g]}}).sort(function(a,b){return b.n-a.n}); })();
  return S;
}

/* ---------- boot ---------- */
IM.loadBank=function(onProgress){
  findPayloads();
  var ready=IM.subjects.filter(function(s){return s.ready});
  var i=0;
  return ready.reduce(function(p,meta){
    return p.then(function(){
      if(onProgress) onProgress(meta,i);
      return loadFile(meta.content).then(function(){ return meta.data?loadFile(meta.data):null; }).then(function(){
        var pkg=window.MG&&window.MG.pkg&&window.MG.pkg[meta.id]; if(!pkg) throw new Error('محتوى '+meta.ar+' غير موجود');
        var data=meta.data?window.DATA:null; if(meta.data) window.DATA=undefined;
        bank.subs[meta.id]=parseSubject(meta,pkg,data);
        delete window.MG.pkg[meta.id]; i++;
        return new Promise(function(r){ setTimeout(r,0) });
      });
    });
  },Promise.resolve()).then(function(){
    ready.forEach(function(m){ bank.order=bank.order.concat(bank.subs[m.id].qids); });
    bank.ready=true; IM.emit('bank'); return bank;
  });
};

/* convenience */
IM.Q=function(id){ return bank.q[id]; };
IM.keyLabel=function(Q){ return Q.keys.map(function(k){return k.toUpperCase()}).join(' + '); };
IM.optText=function(Q,o){ for(var i=0;i<Q.opts.length;i++) if(Q.opts[i].o===o) return Q.opts[i].t; return ''; };
IM.statusOf=function(Q){ /* the four key states in the agreed vocabulary + a few neutral ones */
  if(Q.canc) return 'canc';
  if(!Q.keys.length) return 'nokey';
  if(Q.fix) return 'fix';
  if(Q.alt) return 'doubt';
  if(Q.review||Q.rv) return 'review';
  return 'ok';
};
})();
