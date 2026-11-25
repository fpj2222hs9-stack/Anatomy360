/* Imhotep — language (Arabic by default, English on request).
   The interface is written in Arabic and built in JavaScript, so English is a runtime layer: every text node / title /
   aria-label / placeholder / alt that contains Arabic is translated from the dictionary in js/i18n-en.js (generated from
   tools/i18n/en/*.json). Nothing here touches questions, keys, answers or any stored data.
   Order of lookup for a piece of text: exact entry -> template ({} / {#} placeholders) -> fragments (every dictionary
   entry found as whole words inside the text; accepted only when almost no Arabic is left, so free text typed by the
   student — names, notes, Horus replies — is never half-translated).
   The language lives in localStorage 'im_lang' ('ar' | 'en'); switching reloads the page so the shell is rebuilt cleanly. */
(function(){
'use strict';
var IM=window.IM=window.IM||{};
var KEY='im_lang', lang='ar', chosen=false;
try{ var l=localStorage.getItem(KEY); if(l==='en'||l==='ar'){ lang=l; chosen=true; } }catch(e){}
IM.lang=lang;
IM.langChosen=function(){ return chosen; };
IM.isEn=function(){ return lang==='en'; };
IM.setLang=function(l,reload){
  if(l!=='en'&&l!=='ar') return;
  try{ localStorage.setItem(KEY,l); }catch(e){}
  chosen=true;
  if(l===lang){ if(IM.emit) IM.emit('lang',l); return; }
  if(reload===false){ lang=IM.lang=l; return; }
  try{ if(IM.flush) IM.flush(); }catch(e){}
  try{ location.reload(); }catch(e){}
};
var de=document.documentElement;
if(lang==='en'){ de.lang='en'; de.dir='ltr'; }

var AR=/[؀-ۿ]/, ARG=/[؀-ۿ]/g, ARB='\\u0600-\\u06FF\\u0750-\\u077F';
var X=null, TP=null, FRE=null, FKEYS=null, cache=Object.create(null), nCache=0;

function esc(s){ return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }
function init(){
  if(X) return;
  var D=IM.EN||{x:{},t:[]}; X=D.x||{};
  TP=(D.t||[]).map(function(p){
    var re='^', parts=p[0].split(/(\{#?\})/);
    for(var i=0;i<parts.length;i++){ var s=parts[i]; re+= s==='{}'?'([\\s\\S]+?)': s==='{#}'?'(\\d[\\d,.]*)': esc(s); }
    return {re:new RegExp(re+'$'),v:p[1]};
  });
  FKEYS=Object.keys(X).filter(function(k){ return AR.test(k); }).sort(function(a,b){ return b.length-a.length; });
  /* a key that starts with an Arabic letter must not begin in the middle of a word; one that starts with punctuation ("). بعد …") needs no boundary */
  var a1=[], a2=[]; FKEYS.forEach(function(k){ (AR.test(k.charAt(0))?a1:a2).push(esc(k)); });
  var END='(?![' +ARB+'])';
  FRE=new RegExp('(^|[^'+ARB+'])('+(a1.join('|')||'(?!)')+')'+END+'|('+(a2.join('|')||'(?!)')+')'+END,'g');
}
function arCount(s){ var m=s.match(ARG); return m?m.length:0; }

/* "5 question" -> "5 questions", "1 questions" -> "1 question" (only on composed text) */
var NOUNS='question|answer|mistake|key|day|scroll|card|chapter|tablet|section|level|point|seal|attempt|minute|hour|sunrise|subject|participant|report|week|item|exam|assessment';
var PL=new RegExp('(^|[^\\w.])(\\d[\\d,]*)(\\s+)((?:'+NOUNS+')(?:s)?)(?![A-Za-z])','g');
function plural(s){
  s=s.replace(/(^|[^\w.])(1)(\s+sunrise) days(?![A-Za-z])/g,'$1$2$3 day');
  return s.replace(PL,function(m,pre,num,sp,w){
    var n=parseInt(num.replace(/,/g,''),10), base=w.replace(/s$/,''); if(base==='sunrise'&&w==='sunrises') base='sunrise';
    return pre+num+sp+(n===1?base:base+'s');
  });
}
function fill(v,args){
  return v.replace(/\{(\d+)(?:\?([^|}]*)\|([^}]*))?\}/g,function(m,i,a,b){
    var x=args[i-1]; if(x===undefined) return '';
    if(a===undefined) return x;
    return parseInt(String(x).replace(/[^\d]/g,''),10)===1?a:b;
  });
}
function core(t){
  var v=X[t]; if(v!==undefined) return v;
  for(var i=0;i<TP.length;i++){
    var m=TP[i].re.exec(t);
    if(m){ var args=[]; for(var j=1;j<m.length;j++) args.push(tr(m[j])); return fill(TP[i].v,args); }
  }
  var n=0, out=t.replace(FRE,function(_,pre,k,k2){ n++; return k2!==undefined?X[k2]:pre+X[k]; });
  if(!n) return null;
  if(arCount(out)>arCount(t)*0.2) return null;
  return plural(out.replace(/\b(and|in|of|to|from|by|with|for)(?=\d)/g,'$1 '));      /* "و11" -> "and 11" */
}
/* translate a string (identity unless the site is in English or the text has no Arabic) */
function tr(s){
  if(lang!=='en'||typeof s!=='string'||!AR.test(s)) return s;
  var c=cache[s]; if(c!==undefined) return c;
  init();
  var m=/^(\s*)([\s\S]*?)(\s*)$/.exec(s), r=core(m[2].replace(/\s+/g,' '));
  r=r===null?s:m[1]+r+m[3];
  if(nCache>6000){ cache=Object.create(null); nCache=0; }
  cache[s]=r; nCache++;
  return r;
}
IM.tr=tr;
IM.trRaw=function(s){ init(); return String(s).replace(FRE,function(_,pre,k,k2){ return k2!==undefined?X[k2]:pre+X[k]; }); };      /* debugging aid: fragment pass without the acceptance rule */
if(lang!=='en') return;

/* ---------- DOM layer ---------- */
var ATTRS=['title','aria-label','placeholder','alt'], SEL='[title],[aria-label],[placeholder],[alt]';
function skipEl(el,attr){
  while(el&&el.nodeType===1){
    var t=el.tagName;
    if(t==='SCRIPT'||t==='STYLE'||t==='NOSCRIPT'||(t==='TEXTAREA'&&!attr)) return true;      /* a textarea's own placeholder/aria-label still translate; what the student typed never does */
    if(el.hasAttribute('data-notr')) return true;
    el=el.parentNode;
  }
  return false;
}
function doText(n){
  var v=n.nodeValue; if(!v||!AR.test(v)) return;
  if(skipEl(n.parentNode)) return;
  var t=tr(v); if(t!==v) n.nodeValue=t;
}
function doAttr(el,a){
  var v=el.getAttribute(a); if(!v||!AR.test(v)) return;
  if(skipEl(el,true)) return;
  var t=tr(v); if(t!==v) el.setAttribute(a,t);
}
function doEl(el){ for(var i=0;i<ATTRS.length;i++) doAttr(el,ATTRS[i]); }
function walk(root){
  if(root.nodeType===3){ doText(root); return; }
  if(root.nodeType!==1&&root.nodeType!==9&&root.nodeType!==11) return;
  if(root.nodeType===1){ if(skipEl(root,true)) return; doEl(root); }
  var q=root.querySelectorAll?root.querySelectorAll(SEL):[], i;
  for(i=0;i<q.length;i++) doEl(q[i]);
  var tw=document.createTreeWalker(root,4,null,false), n;
  while((n=tw.nextNode())) doText(n);
}
IM.trDom=walk;
function start(){
  walk(document.documentElement);
  new MutationObserver(function(ms){
    for(var i=0;i<ms.length;i++){
      var m=ms[i];
      if(m.type==='childList'){ for(var j=0;j<m.addedNodes.length;j++) walk(m.addedNodes[j]); }
      else if(m.type==='characterData') doText(m.target);
      else if(m.type==='attributes') doAttr(m.target,m.attributeName);
    }
  }).observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:ATTRS});
}
start();
})();
