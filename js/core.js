/* Imhotep · إمحتب — core: namespace, DOM builder, storage, events, icons, small utilities */
(function(){
'use strict';
var IM=window.IM=window.IM||{};

/* ---------- DOM ---------- */
IM.$=function(s,r){return (r||document).querySelector(s)};
IM.$$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
IM.esc=function(t){return String(t==null?'':t).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};

/* h('div.card.x',{id:'a',onclick:fn,dataset:{k:1}},child,child) — children: Node | string | number | array | null */
IM.h=function(spec,attrs){
  var m=String(spec).match(/^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i), tag=(m&&m[1])||'div', el;
  var svgNS=/^(svg|g|path|circle|rect|line|polyline|polygon|ellipse|defs|use|text|tspan|clipPath|mask|linearGradient|stop)$/.test(tag);
  el=svgNS?document.createElementNS('http://www.w3.org/2000/svg',tag):document.createElement(tag);
  if(m&&m[2]){ m[2].replace(/([.#])([\w-]+)/g,function(_,t,n){ if(t==='.') el.classList.add(n); else el.id=n; }); }
  var start=2;
  if(attrs&&(attrs.nodeType||typeof attrs==='string'||typeof attrs==='number'||Array.isArray(attrs))){ start=1; attrs=null; }
  if(attrs){
    for(var k in attrs){
      if(!Object.prototype.hasOwnProperty.call(attrs,k)) continue;
      var v=attrs[k]; if(v==null||v===false) continue;
      if(k==='class'||k==='className'){ String(v).split(/\s+/).forEach(function(c){ if(c) el.classList.add(c) }); }
      else if(k==='style'){ if(typeof v==='string') el.setAttribute('style',v); else for(var s in v) el.style.setProperty(s,v[s]); }
      else if(k==='dataset'){ for(var d in v) el.dataset[d]=v[d]; }
      else if(k==='html'){ el.innerHTML=v; }
      else if(k==='text'){ el.textContent=v; }
      else if(k==='ref'){ v(el); }
      else if(k.slice(0,2)==='on'&&typeof v==='function'){ el.addEventListener(k.slice(2).toLowerCase(),v); }
      else if(v===true){ el.setAttribute(k,''); }
      else el.setAttribute(k,v);
    }
  }
  function add(c){
    if(c==null||c===false) return;
    if(Array.isArray(c)){ c.forEach(add); return; }
    el.appendChild(c.nodeType?c:document.createTextNode(String(c)));
  }
  for(var i=start;i<arguments.length;i++) add(arguments[i]);
  return el;
};
IM.clear=function(el){ while(el.firstChild) el.removeChild(el.firstChild); return el; };
/* digits and Latin runs inside Arabic sentences stay in order */
IM.n=function(x){ var b=document.createElement('bdi'); b.dir='ltr'; b.textContent=x; return b; };
IM.nhtml=function(x){ return '<bdi dir="ltr">'+IM.esc(x)+'</bdi>'; };

/* ---------- storage (localStorage with in-memory fallback) ---------- */
var mem={}, okLS=(function(){ try{ localStorage.setItem('__im','1'); localStorage.removeItem('__im'); return true }catch(e){ return false } })();
IM.store={
  ok:okLS,
  raw:function(k){ if(okLS){ try{ return localStorage.getItem(k) }catch(e){} } return Object.prototype.hasOwnProperty.call(mem,k)?mem[k]:null; },
  get:function(k,d){ var v=IM.store.raw(k); if(v==null) return d; try{ var j=JSON.parse(v); return j==null?d:j }catch(e){ return d } },
  set:function(k,v){ var s=JSON.stringify(v); if(okLS){ try{ localStorage.setItem(k,s); return true }catch(e){} } mem[k]=s; return false; },
  del:function(k){ if(okLS){ try{ localStorage.removeItem(k) }catch(e){} } delete mem[k]; },
  keys:function(prefix){ var out=[],i; if(okLS){ try{ for(i=0;i<localStorage.length;i++){ var k=localStorage.key(i); if(k&&k.indexOf(prefix)===0) out.push(k) } }catch(e){} } for(var m in mem) if(m.indexOf(prefix)===0&&out.indexOf(m)<0) out.push(m); return out; }
};

/* ---------- tiny event bus ---------- */
var subs={};
IM.on=function(ev,fn){ (subs[ev]=subs[ev]||[]).push(fn); return function(){ subs[ev]=(subs[ev]||[]).filter(function(f){return f!==fn}) } };
IM.emit=function(ev,a,b){ (subs[ev]||[]).slice().forEach(function(f){ try{ f(a,b) }catch(e){ try{console.error(e)}catch(_){} } }); };

/* ---------- dates / numbers ---------- */
IM.dayKey=function(d){ d=d||new Date(); var m=d.getMonth()+1, dd=d.getDate(); return d.getFullYear()+'-'+(m<10?'0':'')+m+'-'+(dd<10?'0':'')+dd; };
IM.addDays=function(key,n){ var p=key.split('-'), d=new Date(+p[0],+p[1]-1,+p[2]+n); return IM.dayKey(d); };
IM.daysBetween=function(a,b){ var pa=a.split('-'), pb=b.split('-'); return Math.round((new Date(+pb[0],+pb[1]-1,+pb[2])-new Date(+pa[0],+pa[1]-1,+pa[2]))/864e5); };
IM.fmtTime=function(ms){ var s=Math.max(0,Math.round(ms/1000)), h=Math.floor(s/3600), m=Math.floor(s%3600/60), x=s%60; return (h?h+':'+(m<10?'0':''):'')+m+':'+(x<10?'0':'')+x; };
IM.pct=function(a,b){ return b?Math.round(a/b*100):0; };
IM.clamp=function(x,a,b){ return Math.min(b,Math.max(a,x)); };
IM.dayNames=['ح','ن','ث','ر','خ','ج','س']; /* Sunday-first, matches Date.getDay() */
IM.dayNamesLong=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
IM.fmtDate=function(key){ var p=key.split('-'); return +p[2]+' '+['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'][+p[1]-1]+' '+p[0]; };

/* ---------- seeded random ---------- */
IM.rng=function(seed){ var a=(seed>>>0)||1; return function(){ a|=0; a=a+0x6D2B79F5|0; var t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; };
IM.seed=function(){ return (Math.random()*4294967295)>>>0; };
IM.shuffle=function(arr,rnd){ rnd=rnd||Math.random; var a=arr.slice(),i,j,t; for(i=a.length-1;i>0;i--){ j=Math.floor(rnd()*(i+1)); t=a[i]; a[i]=a[j]; a[j]=t; } return a; };
IM.hash=function(s){ var h=2166136261; s=String(s); for(var i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return (h>>>0).toString(36); };

/* ---------- icons (24px, stroke) ---------- */
var P={
 home:'M3 20H21V17H18V14H15V11H13V8H11V11H9V14H6V17H3Z',
 train:'M6 21V10a6 6 0 0 1 12 0v11ZM9.5 11h5M9.5 14.5h5M9.5 18h3',
 scale:'M12 4v15M7 19h10M5 7h14M5 7l-3 6a3 3 0 0 0 6 0ZM19 7l-3 6a3 3 0 0 0 6 0Z',
 papyrus:'M8 4.5h10A1.5 1.5 0 0 1 19.5 6v12a1.5 1.5 0 0 1-1.5 1.5H8M8 4.5A2.5 2.5 0 0 0 5.5 7v.5H8M8 19.5A2.5 2.5 0 0 1 5.5 17V7.5M11.5 9H17M11.5 12H17M11.5 15h3.5',
 feather:'M12 2.5C8 6 7 11.5 10.4 16.7L12 21.5l1.6-4.8C17 11.5 16 6 12 2.5ZM12 6v15M12 9l-2 1.2M12 12l2.2-1.3M12 15l-2.2 1.2',
 mix:'M3 7h4l10 10h4M3 17h4l3-3M14 10l3-3h4M18 4l3 3-3 3M18 14l3 3-3 3',
 water:'M6 4h12l-2 14H8ZM9 9h6M9.6 13h4.8M12 18v1.5M12.8 21.2a.8.8 0 1 1-1.6 0a.8.8 0 0 1 1.6 0Z',
 back:'M9 6l6 6-6 6', next:'M15 6l-6 6 6 6',
 bookmark:'M7 4h10v16l-5-3.5L7 20Z',
 check:'M5 12.5l4.5 4.5L19 7.5', cross:'M6 6l12 12M18 6L6 18',
 reset:'M4 12a8 8 0 1 0 2.6-5.9M4 4v4.5h4.5',
 moon:'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z',
 sun:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6',
 sliders:'M4 7h9M17 7h3M4 17h3M11 17h9M15 4v6M9 14v6',
 lock:'M7 11V8a5 5 0 0 1 10 0v3M5.5 11h13v9h-13Z',
 camera:'M4 8h3.2L9 5.5h6L16.8 8H20v11H4ZM12 11a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4Z',
 print:'M7 8V4h10v4M7 17H5v-7h14v7h-2M7 14h10v6H7Z',
 download:'M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14',
 upload:'M12 15.5V4.5M7.5 9L12 4.5 16.5 9M5 19.5h14',
 flag:'M6 21V4M6 5h11l-2.5 4L17 13H6',
 book:'M4 5.5C6.5 4.5 9.5 4.5 12 6c2.5-1.5 5.5-1.5 8-.5V19c-2.5-1-5.5-1-8 .5-2.5-1.5-5.5-1.5-8-.5ZM12 6v13.5',
 cards:'M4.5 8.5h10v11h-10ZM9.5 5h10v11',
 peak:'M3 20l6-10 4 6 3-4 5 8Z',
 trash:'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13',
 info:'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17ZM12 11v5M12 8h.01',
 eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12ZM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z',
 clock:'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17ZM12 7.5V12l3 2',
 list:'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
 grid:'M4 4h7v7H4ZM13 4h7v7h-7ZM4 13h7v7H4ZM13 13h7v7h-7Z',
 plus:'M12 5v14M5 12h14',
 key:'M3 7h18v10H3ZM7 11h.01M11 11h.01M15 11h.01M7 14h10',
 shield:'M12 3l7 3v5c0 5-3 8.5-7 10-4-1.5-7-5-7-10V6Z',
 play:'M7 4.5v15l12-7.5Z',
 pause:'M8 5v14M16 5v14',
 stop:'M6 6h12v12H6Z',
 split:'M4 12h6M14 12h6M10 7l-3 5 3 5M14 7l3 5-3 5',
 star:'M12 3.5l2.6 5.4 5.9.8-4.3 4.2 1 5.9L12 17l-5.2 2.8 1-5.9L3.5 9.7l5.9-.8Z',
 link:'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
 user:'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20a7.5 7.5 0 0 1 15 0',
 edit:'M4 20h4L19 9l-4-4L4 16Z',
 chevd:'M6 9l6 6 6-6', chevu:'M6 15l6-6 6 6',
 menu:'M4 7h16M4 12h16M4 17h16',
 warn:'M12 4l9 16H3ZM12 10v4.5M12 17.3h.01',
 heart:'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z',
 bell:'M12 3v1.2M12 4.2a5 5 0 0 0-5 5v3.4L5.5 16h13L17 12.6V9.2a5 5 0 0 0-5-5ZM10 19a2 2 0 0 0 4 0',
 award:'M12 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM8.5 14l-1.5 6.5 5-2.8 5 2.8L15.5 14'
};
IM.icon=function(name,size,extra){
  var s=document.createElementNS('http://www.w3.org/2000/svg','svg');
  s.setAttribute('viewBox','0 0 24 24'); s.setAttribute('fill','none'); s.setAttribute('stroke','currentColor');
  s.setAttribute('stroke-width','1.8'); s.setAttribute('stroke-linecap','round'); s.setAttribute('stroke-linejoin','round'); s.setAttribute('aria-hidden','true');
  if(size){ s.setAttribute('width',size); s.setAttribute('height',size); }
  if(extra) s.setAttribute('class',extra);
  var p=document.createElementNS('http://www.w3.org/2000/svg','path'); p.setAttribute('d',P[name]||P.info); s.appendChild(p);
  return s;
};

/* ---------- the pyramid mark: six tiers + sun. on = tiers lit (0..6) ---------- */
var TIERS=[[2,55,60],[6,47,52],[11,39,42],[16,31,32],[21,23,22],[26,15,12]];
IM.pyr=function(on,o){
  o=o||{}; on=on==null?6:on;
  var cls='pyr'+(o.anim?' intro':'')+(o.cls?' '+o.cls:'');
  var s='<svg class="'+cls+'" viewBox="-6 -10 76 76" '+(o.label?'role="img" aria-label="'+IM.esc(o.label)+'"':'aria-hidden="true"')+(o.size?' width="'+o.size+'" height="'+o.size+'"':'')+'>';
  s+='<g class="sr'+(o.anim?' sun-rise':'')+'"><g class="rays"><path d="M32 -.4V-3.4M36.53 1.47L38.65 -.65M27.47 1.47L25.35 -.65M38.4 6H41.4M25.6 6H22.6M36.53 10.53L38.65 12.65M27.47 10.53L25.35 12.65M32 12.4V14.4"/></g><circle class="sun" cx="32" cy="6" r="3.8"/></g>';
  for(var i=0;i<6;i++){ var t=TIERS[i]; s+='<rect class="t'+(i<on?'':' off')+'" x="'+t[0]+'" y="'+t[1]+'" width="'+t[2]+'" height="7"'+(o.anim?' style="animation-delay:'+(i*0.12).toFixed(2)+'s"':'')+'/>'; }
  return s+'</svg>';
};
IM.pyrEl=function(on,o){ var d=document.createElement('span'); d.className='pyr-w'; d.style.display='inline-flex'; d.innerHTML=IM.pyr(on,o); return d.firstChild.nodeType===1&&d.childNodes.length===1?d.firstChild:d; };
IM.dunes=function(h){ return '<div class="dunes" aria-hidden="true" style="--dh:'+(h||160)+'px"><svg class="d1" viewBox="0 0 2400 200" preserveAspectRatio="none"><path d="M0 110C220 40 420 50 600 100S980 170 1200 110C1420 40 1620 50 1800 100S2180 170 2400 110V200H0Z"/></svg><svg class="d2" viewBox="0 0 2400 200" preserveAspectRatio="none"><path d="M0 140C180 90 380 100 560 135S1000 175 1200 140C1380 90 1580 100 1760 135S2200 175 2400 140V200H0Z"/></svg><svg class="d3" viewBox="0 0 2400 200" preserveAspectRatio="none"><path d="M0 165C240 135 420 150 640 170S1020 190 1200 165C1440 135 1620 150 1840 170S2220 190 2400 165V200H0Z"/></svg></div>'; };

/* ---------- toast ---------- */
var toastBox=null;
IM.toast=function(msg,o){
  o=o||{};
  if(!toastBox){ toastBox=IM.h('div.toasts',{role:'status','aria-live':'polite'}); document.body.appendChild(toastBox); }
  var t=IM.h('div.toast'+(o.kind?'.'+o.kind:''),{}, o.icon?IM.icon(o.icon,18):null, IM.h('span',{text:msg}));
  if(o.action){ t.appendChild(IM.h('button.toast-a',{type:'button',text:o.action.label,onclick:function(){ o.action.fn(); kill(); }})); }
  toastBox.appendChild(t);
  var timer=setTimeout(kill,o.ms||3800);
  function kill(){ clearTimeout(timer); t.classList.add('out'); setTimeout(function(){ if(t.parentNode) t.parentNode.removeChild(t) },260); }
  return kill;
};

/* ---------- modal dialog ---------- */
IM.modal=function(o){
  var prev=document.activeElement;
  var ov=IM.h('div.ov',{role:'presentation'});
  var box=IM.h('div.dlg'+(o.cls?'.'+o.cls:''),{role:'dialog','aria-modal':'true','aria-label':o.title||''},
    IM.h('div.dlg-h',{}, IM.h('h2.display',{text:o.title||''}), IM.h('button.iconbtn.dlg-x',{type:'button','aria-label':'إغلاق',onclick:close},IM.icon('cross',20))),
    IM.h('div.dlg-b',{},o.body||null),
    o.foot?IM.h('div.dlg-f',{},o.foot):null);
  ov.appendChild(box);
  function close(r){ document.removeEventListener('keydown',key,true); document.body.classList.remove('lock'); if(ov.parentNode) ov.parentNode.removeChild(ov); if(prev&&prev.focus&&prev.isConnected){ try{prev.focus()}catch(e){} } if(o.onclose) o.onclose(r); }
  function key(e){
    if(e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); close(); }
    else if(e.key==='Tab'){
      var f=IM.$$('button:not([disabled]),input:not([disabled]):not([tabindex="-1"]),select,textarea,a[href],[tabindex]:not([tabindex="-1"])',box).filter(function(x){return x.offsetParent!==null});
      if(!f.length) return; var a=f[0], z=f[f.length-1];
      if(e.shiftKey&&document.activeElement===a){ e.preventDefault(); z.focus(); } else if(!e.shiftKey&&document.activeElement===z){ e.preventDefault(); a.focus(); }
    }
  }
  ov.addEventListener('mousedown',function(e){ if(e.target===ov) close(); });
  document.addEventListener('keydown',key,true);
  document.body.classList.add('lock'); document.body.appendChild(ov);
  setTimeout(function(){ var f=IM.$(o.focus||'input,textarea,select,button.btn',box); if(f&&f.focus) try{f.focus()}catch(e){} },30);
  return {close:close,box:box,ov:ov};
};

/* two-press confirm: first press arms the button for 4 s, second does it */
IM.arm=function(btn,label,action,armLabel){
  var timer=null;
  function idle(){ btn.classList.remove('armed'); btn.textContent=label; }
  btn.addEventListener('click',function(e){
    e.preventDefault();
    if(btn.classList.contains('armed')){ clearTimeout(timer); idle(); action(); return; }
    btn.classList.add('armed'); btn.textContent=armLabel||'اضغط مرة أخرى للتأكيد';
    clearTimeout(timer); timer=setTimeout(idle,4000);
  });
  idle(); return btn;
};

/* tab visibility aware stopwatch (per-question time, capped) */
IM.Watch=function(cap){
  var acc=0, t0=0, running=false;
  function vis(){ if(document.hidden) pause(); else if(running&&!t0) t0=Date.now(); }
  function pause(){ if(t0){ acc+=Date.now()-t0; t0=0; } }
  document.addEventListener('visibilitychange',vis);
  return {
    start:function(){ acc=0; running=true; t0=document.hidden?0:Date.now(); },
    stop:function(){ pause(); running=false; var r=Math.min(acc,cap||120000); return r; },
    peek:function(){ return Math.min(acc+(t0?Date.now()-t0:0),cap||120000); },
    off:function(){ document.removeEventListener('visibilitychange',vis); }
  };
};

IM.text=function(html){ var d=document.createElement('div'); d.innerHTML=html; return d.textContent; };
IM.copy=function(text){ if(navigator.clipboard&&navigator.clipboard.writeText) return navigator.clipboard.writeText(text); return new Promise(function(res,rej){ try{ var t=document.createElement('textarea'); t.value=text; t.style.position='fixed'; t.style.opacity='0'; document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t); res(); }catch(e){ rej(e) } }); };
IM.download=function(name,text,type){ var b=new Blob([text],{type:type||'application/json'}), a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=name; document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove() },500); };
})();
