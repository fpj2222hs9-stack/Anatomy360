/* Imhotep · إمحتب — محوّل Firebase لمحرّك المزامنة (js/cloud.js). بيتفعّل لما IM.CLOUD.provider = 'firebase' (أو ?fb=1 على متصفح واحد للتجربة).
   من غير أي مكتبة خارجية (زي Supabase بالظبط): REST مباشرة. مصمّم لخطة Spark المجانية (من غير Cloud Functions ومن غير بطاقة):
   - الدخول: جوجل OpenID Connect (full-page redirect، من غير نافذة منبثقة ومن غير تخزين طرف تالت: شغّال في iPhone والتطبيق على الشاشة الرئيسية)
     ← id_token بيرجع في # الرابط ← Firebase Auth REST (accounts:signInWithIdp) ← idToken + refreshToken. نفس الـ UID للمستخدمين المنقولين.
   - التجديد: securetoken.googleapis.com. التقدّم والمحادثة: Firestore REST بتوكن الطالب (القواعد في tools/firebase/firestore.rules بتحميه).
   - حورس: بيفضل دالة Supabase (هي اللي بتكلّم Gemini)، والطالب بيبعتلها توكن Firebase بتاعه وهي بتتحقق منه (tools/horus/edge/src/firebase.js).
   - مسح الحساب: من المتصفح نفسه (Firestore + accounts:delete) من غير دالة سيرفر.
   - حدود Spark اليومية (قراءة 50 ألف / كتابة 20 ألف): المزامنة هنا أهدى من Supabase (الأوقات في cloud.js حسب المزوّد)، ولو الحد خلص (429) الموقع بيكمّل على الجهاز ويحاول بعدين.
   الإعداد في js/cloud-config.js ← fb:{projectId, apiKey, clientId, redirects}. الخطوات: tools/firebase/README.md. */
(function(){
'use strict';
var IM=window.IM; IM.cloudAdapters=IM.cloudAdapters||{};
IM.cloudAdapters.firebase=function(X){
  var CFG=X.CFG, FB=CFG.fb||{}, C=X.C, S=X.S, PK=X.PK;
  var AUTH='https://identitytoolkit.googleapis.com/v1', TOKEN='https://securetoken.googleapis.com/v1/token';
  var DBN='projects/'+FB.projectId+'/databases/(default)/documents', FS='https://firestore.googleapis.com/v1/'+DBN;
  var GOOGLE='https://accounts.google.com/o/oauth2/v2/auth';

  /* الرابط اللي جوجل هيرجّع عليه: لازم يتطابق حرفيًا مع «Authorized redirect URIs» (بالـ / في الآخر وبدون index.html) */
  function redirectUri(){
    if(CFG.redirect) return String(CFG.redirect);
    var p=location.pathname.replace(/index\.html$/,''); if(p.slice(-1)!=='/') p+='/';
    return location.origin+p;
  }
  function originAllowed(){ return !Array.isArray(FB.redirects)||!FB.redirects.length||FB.redirects.indexOf(redirectUri())>-1; }

  /* ---------- شبكة ---------- */
  function http(method,url,o){
    o=o||{}; var hd={};
    if(o.headers) for(var hk in o.headers) hd[hk]=o.headers[hk];
    if(o.token) hd.Authorization='Bearer '+o.token;
    if(o.form!==undefined) hd['Content-Type']='application/x-www-form-urlencoded';
    else if(o.body!==undefined) hd['Content-Type']='application/json';
    var ctl=window.AbortController?new AbortController():null, t=ctl?setTimeout(function(){ ctl.abort(); },o.timeout||25000):null;
    return fetch(url,{method:method,headers:hd,body:o.form!==undefined?o.form:(o.body!==undefined?JSON.stringify(o.body):undefined),signal:ctl?ctl.signal:undefined,cache:'no-store'}).then(function(r){
      if(t) clearTimeout(t);
      return r.text().then(function(tx){ var j=null; try{ j=tx?JSON.parse(tx):null; }catch(e){} return {status:r.status,ok:r.ok,json:j}; });
    },function(e){ if(t) clearTimeout(t); var er=new Error('net'); er.net=1; er.cause=e; throw er; });
  }
  /* خطأ Google/Firebase: {error:{code,message,status}} */
  function bytes(s){ try{ return new TextEncoder().encode(s).length; }catch(e){ return String(s).length*2; } }
  var MAX_BYTES=1000000;                                                  /* حد Firestore 1,048,576 بايت للوثيقة (العربي = 2 بايت للحرف) */
  function tooBig(){ return X.httpErr({status:413,json:{code:'TOO_BIG',message:'progress is too large for one document'}}); }
  function emsg(r){ var e=r&&r.json&&r.json.error; return e?String(e.message||e.status||''):''; }
  function estatus(r){ var e=r&&r.json&&r.json.error; return e?String(e.status||''):''; }
  function fsErr(r){ return {status:r.status,json:{code:estatus(r),message:emsg(r)}}; }
  function keyq(){ return '?key='+encodeURIComponent(FB.apiKey); }

  /* ---------- قيم Firestore ---------- */
  function sv(s){ return {stringValue:String(s)}; }
  function iv(n){ return {integerValue:String(n)}; }
  function fld(doc,k){ return doc&&doc.fields?doc.fields[k]:undefined; }
  function numOf(v){ if(!v) return 0; if(v.integerValue!==undefined) return +v.integerValue; if(v.doubleValue!==undefined) return Math.round(+v.doubleValue); return 0; }
  function docUrl(col,id){ return FS+'/'+col+'/'+encodeURIComponent(id); }
  function docName(col,id){ return DBN+'/'+col+'/'+id; }
  var REQ_TIME='REQUEST_TIME';

  /* ---------- JWT (للتحقق من nonce و aud بس؛ التوقيع بيتحقق منه Firebase) ---------- */
  function jwt(t){
    try{
      var p=String(t).split('.')[1].replace(/-/g,'+').replace(/_/g,'/'); while(p.length%4) p+='=';
      var s=atob(p), u=new Uint8Array(s.length); for(var i=0;i<s.length;i++) u[i]=s.charCodeAt(i);
      return JSON.parse(new TextDecoder().decode(u));
    }catch(e){ return null; }
  }
  function normSignIn(j){
    return {at:j.idToken,rt:j.refreshToken,exp:Date.now()+((+j.expiresIn)||3600)*1000,
      user:{id:j.localId,email:j.email,name:j.displayName||j.fullName||'',avatar:j.photoUrl||''}};
  }
  /* id_token من جوجل ← جلسة Firebase */
  function exchange(idTok,nonce){
    var p=jwt(idTok), aud=p&&p.aud;
    if(!p||p.nonce!==nonce||(FB.clientId&&aud!==FB.clientId)||!/^(https:\/\/)?accounts\.google\.com$/.test(String(p.iss||''))){ var eb=new Error('token'); eb.bad=1; throw eb; }
    return http('POST',AUTH+'/accounts:signInWithIdp'+keyq(),{body:{postBody:'id_token='+encodeURIComponent(idTok)+'&providerId=google.com',requestUri:'http://localhost',returnSecureToken:true,returnIdpCredential:true}}).then(function(r){
      if(r.ok&&r.json&&r.json.idToken&&r.json.localId&&!r.json.needConfirmation) return normSignIn(r.json);
      var e=new Error('exchange'); e.status=r.status; e.code=emsg(r); e.msg=e.code;
      /* مشاكل إعداد عندنا (مش من الطالب): المزوّد مقفول، الـ client id مش مسموح، المفتاح مش صالح… الموقع بيفتح من غير بوابة لحد ما تتصلّح */
      if(r.status===403||(r.status===400&&(/OPERATION_NOT_ALLOWED|API key|API_KEY|PROJECT_NOT_ALLOWED|CONFIGURATION_NOT_FOUND|INVALID_REQUEST_URI/i.test(e.code)||(/INVALID_IDP_RESPONSE/i.test(e.code)&&/audience|not allowed|not authorized|client ?id/i.test(e.code))))) e.cfg=1;
      if(/USER_DISABLED/.test(e.code)) e.disabled=1;
      throw e;
    });
  }

  /* ---------- حزمة التقدّم: progress/{uid} ---------- */
  function parseRow(doc){
    var d=fld(doc,'data'), up=fld(doc,'updatedAt');
    var row={rev:numOf(fld(doc,'rev')),updated_at:(up&&up.timestampValue)||doc.updateTime||''};
    if(d!==undefined){
      var o=null; try{ o=JSON.parse(d.stringValue||''); }catch(e){}
      if(o&&typeof o==='object'&&!Array.isArray(o)) row.data=o; else { row.data={}; row.corrupt=1; }
    }
    return row;
  }
  function getRow(uid,light){
    var url=docUrl('progress',uid)+(light?'?mask.fieldPaths=rev&mask.fieldPaths=updatedAt':'');
    return X.withToken(function(t){ return http('GET',url,{token:t}); }).then(function(r){
      if(r.status===404) return null;
      if(!r.ok) throw X.httpErr(fsErr(r));
      return parseRow(r.json||{});
    });
  }
  function commit(writes){
    return X.withToken(function(t){ return http('POST',FS+':commit',{token:t,body:{writes:writes}}); });
  }
  function insertRow(uid,data,dev){
    if(bytes(JSON.stringify(data))>MAX_BYTES) return Promise.reject(tooBig());
    var w={update:{name:docName('progress',uid),fields:{data:sv(JSON.stringify(data)),rev:iv(1),device:sv(dev||'')}},currentDocument:{exists:false},
      updateTransforms:[{fieldPath:'createdAt',setToServerValue:REQ_TIME},{fieldPath:'updatedAt',setToServerValue:REQ_TIME}]};
    return commit([w]).then(function(r){
      if(r.ok) return {ok:true,rev:1};
      if(r.status===409||estatus(r)==='ALREADY_EXISTS') return {dup:true};          /* حد سبقنا (جهاز تاني بيربط في نفس اللحظة) */
      /* الصف موجود فعلًا: Firestore بيقيّم القواعد قبل الشرط فممكن يرجّع 403 بدل 409. نتأكد بقراءة خفيفة قبل ما نعتبره خطأ */
      if(r.status===403||estatus(r)==='FAILED_PRECONDITION'){
        return getRow(uid,true).then(function(row){ if(row) return {dup:true}; throw X.httpErr(fsErr(r)); });
      }
      throw X.httpErr(fsErr(r));
    });
  }
  function pushRow(uid,data,rev,dev){
    if(bytes(JSON.stringify(data))>MAX_BYTES) return Promise.reject(tooBig());
    var w={update:{name:docName('progress',uid),fields:{data:sv(JSON.stringify(data)),rev:iv(rev+1),device:sv(dev||'')}},updateMask:{fieldPaths:['data','rev','device']},currentDocument:{exists:true},
      updateTransforms:[{fieldPath:'updatedAt',setToServerValue:REQ_TIME}]};
    return commit([w]).then(function(r){
      if(r.ok) return {ok:true,rev:rev+1};
      if(r.status===404) return {conflict:true};                                    /* الصف اتمسح */
      /* القواعد بترفض الكتابة لو rev مش rev الحالي + 1: نفرّق بين «تعارض» (جهاز تاني كتب قبلنا) وبين رفض حقيقي */
      if(r.status===403||r.status===409||estatus(r)==='FAILED_PRECONDITION'){
        return getRow(uid,true).then(function(row){
          if(!row||row.rev!==rev) return {conflict:true};
          throw X.httpErr(fsErr(r));
        });
      }
      throw X.httpErr(fsErr(r));
    });
  }

  /* ---------- حورس: المحادثة المحفوظة horus_chat/{uid} (msgs نص JSON) ---------- */
  function chatGet(uid){
    return X.withToken(function(t){ return http('GET',docUrl('horus_chat',uid),{token:t}); }).then(function(r){
      if(r.status===404) return null;
      if(!r.ok) throw new Error('http');
      var m=fld(r.json,'msgs'), a=null; try{ a=JSON.parse((m&&m.stringValue)||'[]'); }catch(e){}
      return {msgs:Array.isArray(a)?a:[]};
    });
  }
  function chatPut(uid,msgs){
    var w={update:{name:docName('horus_chat',uid),fields:{msgs:sv(JSON.stringify(msgs)),by:sv('web')}},updateMask:{fieldPaths:['msgs','by']},
      updateTransforms:[{fieldPath:'updatedAt',setToServerValue:REQ_TIME}]};
    return commit([w]).then(function(r){ if(!r.ok) throw new Error('http'); return true; });
  }

  /* ---------- حورس: دالة Supabase (بتتحقق من توكن Firebase بتاع الطالب) ---------- */
  function horusUrl(){ var P=(IM.AI&&IM.AI.chat&&IM.AI.chat.path)||'/functions/v1/horus'; return String(CFG.url||'').replace(/\/+$/,'')+P; }
  function fn(method,qs,o){
    o=o||{};
    return X.withToken(function(t){ return http(method,horusUrl()+(qs||''),{token:t,body:o.body,timeout:o.timeout,headers:{apikey:CFG.anon}}); });
  }

  /* ---------- مسح الحساب (من المتصفح): التقدّم والمحادثة والنسخ الاحتياطية، وبعدين حساب الدخول نفسه ----------
     Firebase بيطلب «دخول حديث» لمسح حساب الدخول (CREDENTIAL_TOO_OLD_LOGIN_AGAIN): بنتأكد قبل ما نمسح أي حاجة عشان ما يحصلش مسح نصّاني. */
  var FRESH_MS=4*60*1000;
  function authAge(){ var p=jwt(C.at||''); return p&&p.auth_time?(Date.now()-p.auth_time*1000):Infinity; }
  function delDoc(col,id){ return {delete:docName(col,id)}; }
  function backupIds(uid){
    return X.withToken(function(t){ return http('POST',FS+':runQuery',{token:t,body:{structuredQuery:{from:[{collectionId:'progress_backups'}],where:{fieldFilter:{field:{fieldPath:'uid'},op:'EQUAL',value:sv(uid)}},select:{fields:[{fieldPath:'uid'}]},limit:500}}}); }).then(function(r){
      if(!r.ok) throw X.httpErr(fsErr(r));
      return (Array.isArray(r.json)?r.json:[]).filter(function(x){ return x&&x.document; }).map(function(x){ return String(x.document.name).split('/').pop(); });
    });
  }
  function deleteAccount(){
    var uid=C.uid;
    if(!uid) return Promise.reject(Object.assign(new Error('signed-out'),{auth:1}));
    return X.withToken(function(){ return Promise.resolve({status:200,ok:true,json:null}); }).then(function(){          /* بيجدّد التوكن لو لزم قبل ما نحسب عمر الدخول */
      if(authAge()>FRESH_MS){ var er=new Error('relogin'); er.relogin=1; throw er; }
      /* 1) علامة المسح (بتمنع جهاز تاني لسه توكنه شغّال إنه يعيد إنشاء البيانات، وبتمنع النقل المتكرر من Supabase إنه يرجّع الحساب) */
      var tomb={update:{name:docName('deleted_accounts',uid),fields:{}},currentDocument:{exists:false},updateTransforms:[{fieldPath:'at',setToServerValue:REQ_TIME}]};
      return commit([tomb]).then(function(r){
        if(!r.ok&&r.status!==409&&r.status!==403&&estatus(r)!=='ALREADY_EXISTS'&&estatus(r)!=='FAILED_PRECONDITION') throw X.httpErr(fsErr(r));   /* موجودة قبل كده (محاولة سابقة): تمام */
        return backupIds(uid);
      });
    }).then(function(ids){
      var w=[delDoc('progress',uid),delDoc('horus_chat',uid)].concat(ids.map(function(i){ return delDoc('progress_backups',i); }));
      var chunks=[]; for(var i=0;i<w.length;i+=200) chunks.push(w.slice(i,i+200));
      return chunks.reduce(function(p,c){ return p.then(function(){ return commit(c).then(function(r){ if(!r.ok) throw X.httpErr(fsErr(r)); }); }); },Promise.resolve());
    }).then(function(){
      /* 2) حساب الدخول نفسه */
      return X.withToken(function(t){ return http('POST',AUTH+'/accounts:delete'+keyq(),{body:{idToken:t}}); }).then(function(r){
        if(r.ok) return true;
        if(/CREDENTIAL_TOO_OLD_LOGIN_AGAIN|TOKEN_EXPIRED/.test(emsg(r))){ var er=new Error('relogin'); er.relogin=1; throw er; }
        if(/USER_NOT_FOUND/.test(emsg(r))) return true;
        throw X.httpErr(fsErr(r));
      });
    });
  }

  return {
    id:'firebase', key:'im_cloud_fb',
    configured:function(){ return !!(FB.projectId&&FB.apiKey&&FB.clientId&&originAllowed()); },
    fnReady:function(){ return !!(CFG.url&&CFG.anon); },          /* حورس على دالة Supabase */

    /* ---------- تسجيل الدخول: جوجل OIDC (redirect كامل) ---------- */
    signIn:function(ret){
      var st=X.rnd(24), nonce=X.rnd(24);
      S.set(PK,{st:st,n:nonce,ret:ret,t:Date.now()});
      var q=new URLSearchParams({client_id:FB.clientId,redirect_uri:redirectUri(),response_type:FB.responseType||'id_token',scope:'openid email profile',nonce:nonce,state:st});
      if(C.email) q.set('login_hint',C.email);                           /* اللي كان مسجّل قبل كده: جوجل بيختاره لوحده */
      location.href=GOOGLE+'?'+q.toString();
      return Promise.resolve(true);
    },
    early:function(){
      var hs=String(location.hash||'').replace(/^#/,'');
      if(!/(^|&)(id_token|error|access_token)=/.test(hs)) return null;
      var hp; try{ hp=new URLSearchParams(hs); }catch(e){ return null; }
      var pk=S.get(PK,null), err=hp.get('error')||'', tok=hp.get('id_token')||'', st=hp.get('state')||'';
      if(!pk&&!err&&!(hp.get('id_token')&&hp.get('state'))) return null; /* مش بتاعنا (لو فيه id_token و state يبقى بتاعنا والتخزين اتمسح: بننضّف الرابط ونرجّع 'state') */
      S.del(PK);
      var ret=(pk&&pk.ret&&/^#\//.test(pk.ret))?pk.ret:'#/';
      try{ history.replaceState(null,'',location.pathname+location.search+ret); }catch(e){}
      if(err) return {err:err};
      if(!pk||!pk.st||st!==pk.st||!tok) return {err:'state'};
      return {promise:exchange(tok,pk.n)};
    },
    /* تجديد التوكن ← {status, ok, bundle} */
    refresh:function(rt){
      return http('POST',TOKEN+keyq(),{form:'grant_type=refresh_token&refresh_token='+encodeURIComponent(rt)}).then(function(r){
        var j=r.json||{}, ok=!!(r.ok&&j.id_token);
        /* الجلسة ماتت فعلًا بس لو جوجل قال كده. أي رفض تاني (مفتاح اتقيّد، API مقفول، referrer…) مشكلة إعداد عندنا: مانطلّعش الطلبة، بنعتبرها مؤقتة */
        var dead=(r.status===400||r.status===401)&&/TOKEN_EXPIRED|INVALID_REFRESH_TOKEN|USER_DISABLED|USER_NOT_FOUND|MISSING_REFRESH_TOKEN|CREDENTIAL_MISMATCH/.test(emsg(r));
        return {status:ok?r.status:(dead?r.status:503),ok:ok,bundle:ok?{at:j.id_token,rt:j.refresh_token||rt,exp:Date.now()+((+j.expires_in)||3600)*1000,user:{id:j.user_id}}:null};
      });
    },
    /* هل Firebase Auth واصل والمفتاح صالح؟ 'on' | 'off' | 'net' (مزوّد جوجل نفسه بيتأكد منه الدخول الفعلي) */
    probe:function(){
      return http('POST',AUTH+'/accounts:lookup'+keyq(),{body:{idToken:''},timeout:6000}).then(function(r){
        if(r.status>=500||r.status===429||r.status===0) return 'net';
        if(r.status===403||/API key|API_KEY|PERMISSION_DENIED|referer|blocked/i.test(emsg(r)+' '+estatus(r))) return 'off';
        return 'on';
      },function(){ return 'net'; });
    },
    logout:function(){},                                                  /* توكنات Firebase بتنتهي لوحدها؛ مفيش logout على السيرفر */

    getRow:getRow, insertRow:insertRow, pushRow:pushRow,
    /* مسح الحساب: من المتصفح (انظر deleteAccount فوق) */
    deleteAccount:deleteAccount,

    call:function(){ var e=new Error('unsupported'); e.unsupported=1; return Promise.reject(e); },
    fn:fn, chatGet:chatGet, chatPut:chatPut
  };
};
})();
