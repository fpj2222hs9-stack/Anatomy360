/* Imhotep · إمحتب — محوّل Supabase لمحرّك المزامنة (js/cloud.js).
   ده نفس كود Supabase اللي كان جوه cloud.js (الدخول PKCE، التجديد، جدول progress، دالة horus، جدول horus_chat) من غير تغيير في السلوك،
   اتنقل هنا عشان المحرّك يشتغل مع مزوّد تاني (js/cloud-fb.js). بيتفعّل لما IM.CLOUD.provider = 'supabase' (الافتراضي).
   الـ API كلها REST مباشرة (من غير مكتبة خارجية). */
(function(){
'use strict';
var IM=window.IM; IM.cloudAdapters=IM.cloudAdapters||{};
IM.cloudAdapters.supabase=function(X){
  var CFG=X.CFG, C=X.C, S=X.S, PK=X.PK;
  function base(){ return String(CFG.url).replace(/\/+$/,''); }

  /* ---------- شبكة ---------- */
  function req(method,path,o){
    o=o||{}; var hd={apikey:CFG.anon};
    if(o.token) hd.Authorization='Bearer '+o.token;                       /* توكن الطالب (JWT) */
    else if(/^eyJ/.test(CFG.anon)) hd.Authorization='Bearer '+CFG.anon;   /* المفتاح القديم JWT بس. المفتاح الجديد sb_publishable_ ممنوع يتبعت في Authorization */
    if(o.body!==undefined) hd['Content-Type']='application/json';
    if(o.prefer) hd.Prefer=o.prefer;
    var ctl=window.AbortController?new AbortController():null, t=ctl?setTimeout(function(){ ctl.abort(); },o.timeout||25000):null;
    return fetch(base()+path,{method:method,headers:hd,body:o.body!==undefined?JSON.stringify(o.body):undefined,signal:ctl?ctl.signal:undefined,cache:'no-store'}).then(function(r){
      if(t) clearTimeout(t);
      return r.text().then(function(tx){ var j=null; try{ j=tx?JSON.parse(tx):null; }catch(e){} return {status:r.status,ok:r.ok,json:j}; });
    },function(e){ if(t) clearTimeout(t); var er=new Error('net'); er.net=1; er.cause=e; throw er; });
  }
  function call(method,path,o){ o=o||{}; return X.withToken(function(t){ return req(method,path,Object.assign({},o,{token:t})); }); }
  /* رد Supabase (token / user) ← شكل موحّد للمحرّك */
  function norm(r){
    var u=r.user||{}, m=u.user_metadata||{};
    return {at:r.access_token,rt:r.refresh_token,exp:r.expires_at?(+r.expires_at*1000):(Date.now()+((+r.expires_in)||3600)*1000),
      user:{id:u.id,email:u.email||m.email,name:m.full_name||m.name,avatar:m.avatar_url||m.picture}};
  }

  return {
    id:'supabase', key:'im_cloud',
    configured:function(){ return !!(CFG.url&&CFG.anon); },
    fnReady:function(){ return true; },

    /* ---------- تسجيل الدخول (PKCE) ---------- */
    signIn:function(ret){
      var redirect=CFG.redirect||(location.origin+location.pathname);
      function go(extra){ location.href=base()+'/auth/v1/authorize?provider=google&redirect_to='+encodeURIComponent(redirect)+(extra||''); }
      if(window.crypto&&crypto.subtle){
        var v=X.rnd(48);
        return X.sha256(v).then(function(ch){ S.set(PK,{v:v,ret:ret,t:Date.now()}); go('&code_challenge='+ch+'&code_challenge_method=s256'); return true; });
      }
      S.set(PK,{ret:ret,t:Date.now()}); go(''); return Promise.resolve(true);
    },
    /* الرجوع من جوجل: بيتقرا أول ما الملف يشتغل (قبل الراوتر) وبيتنضّف الرابط فورًا. بيرجّع null أو {promise} أو {err} */
    early:function(){
      var q, hs=String(location.hash||'').replace(/^#/,''), hp=null;
      try{ q=new URLSearchParams(location.search); if(/^(access_token|error)=/.test(hs)) hp=new URLSearchParams(hs); }catch(e){ return null; }
      var code=q.get('code'), err=q.get('error')||(hp&&hp.get('error'))||'';
      if(!code&&!(hp&&hp.get('access_token'))&&!err) return null;
      var pk=S.get(PK,null);
      if(!pk&&!err) return null;                                  /* مش بتاعنا */
      S.del(PK);
      var keep=new URLSearchParams(location.search); ['code','error','error_code','error_description'].forEach(function(k){ keep.delete(k); });
      var qs=keep.toString(), ret=(pk&&pk.ret&&/^#\//.test(pk.ret))?pk.ret:'#/';
      try{ history.replaceState(null,'',location.pathname+(qs?'?'+qs:'')+ret); }catch(e){}
      if(err) return {err:err};
      if(code){
        return {promise:req('POST','/auth/v1/token?grant_type=pkce',{body:{auth_code:code,code_verifier:(pk&&pk.v)||''}}).then(function(r){
          if(r.ok&&r.json&&r.json.access_token) return norm(r.json);
          var e=new Error('exchange'); e.status=r.status; throw e;
        })};
      }
      var tok={access_token:hp.get('access_token'),refresh_token:hp.get('refresh_token'),expires_in:+hp.get('expires_in')||3600};
      return {promise:req('GET','/auth/v1/user',{token:tok.access_token}).then(function(r){ if(!r.ok||!r.json) throw new Error('user'); tok.user=r.json; return norm(tok); })};
    },
    /* تجديد التوكن ← {status, ok, bundle} */
    refresh:function(rt){
      return req('POST','/auth/v1/token?grant_type=refresh_token',{body:{refresh_token:rt}}).then(function(r){
        return {status:r.status,ok:!!(r.ok&&r.json&&r.json.access_token),bundle:(r.ok&&r.json&&r.json.access_token)?norm(r.json):null};
      });
    },
    /* هل جوجل مفعّل فعلًا في Supabase؟ 'on' | 'off' | 'net' */
    probe:function(){
      return req('GET','/auth/v1/settings',{timeout:6000}).then(function(r){
        return (r.ok&&r.json&&r.json.external)?(r.json.external.google===true?'on':'off'):'net';
      });
    },
    logout:function(t){ if(t) req('POST','/auth/v1/logout',{token:t}).catch(function(){}); },

    /* ---------- حزمة التقدّم (جدول progress، صف لكل طالب) ---------- */
    getRow:function(uid,light){
      return call('GET','/rest/v1/progress?user_id=eq.'+encodeURIComponent(uid)+'&select='+(light?'rev,updated_at':'data,rev,updated_at')).then(function(r){
        if(!r.ok) throw X.httpErr(r); return (r.json&&r.json[0])||null;
      });
    },
    insertRow:function(uid,data,dev){
      return call('POST','/rest/v1/progress?select=rev',{body:{user_id:uid,data:data,rev:1,device:dev},prefer:'return=representation'}).then(function(r){
        if(r.ok&&r.json&&r.json[0]) return {ok:true,rev:r.json[0].rev};
        if(r.status===409||r.status===400&&/duplicate|23505/i.test(JSON.stringify(r.json||''))) return {dup:true};        /* حد سبقنا (جهاز تاني بيربط في نفس اللحظة) */
        throw X.httpErr(r);
      });
    },
    pushRow:function(uid,data,rev,dev){
      return call('PATCH','/rest/v1/progress?select=rev&user_id=eq.'+encodeURIComponent(uid)+'&rev=eq.'+rev,{body:{data:data,rev:rev+1,updated_at:new Date().toISOString(),device:dev},prefer:'return=representation'}).then(function(r){
        if(r.ok&&Array.isArray(r.json)&&r.json.length===1) return {ok:true,rev:r.json[0].rev};
        if(r.ok&&Array.isArray(r.json)&&r.json.length===0) return {conflict:true};                  /* تعارض: جهاز تاني كتب قبلنا (أو الصف مش موجود) */
        throw X.httpErr(r);
      });
    },
    /* مسح الحساب وكل بياناته من السيرفر (RPC delete_my_account في tools/cloud/supabase.sql) */
    deleteAccount:function(){
      return call('POST','/rest/v1/rpc/delete_my_account',{body:{}}).then(function(r){ if(!(r.ok||r.status===204)) throw X.httpErr(r); return true; });
    },

    /* ---------- حورس: الدالة + المحادثة المحفوظة ---------- */
    call:call,
    fn:function(method,qs,o){ var P=(IM.AI&&IM.AI.chat&&IM.AI.chat.path)||'/functions/v1/horus'; return call(method,P+(qs||''),o||{}); },
    chatGet:function(uid){
      return call('GET','/rest/v1/horus_chat?select=msgs&user_id=eq.'+encodeURIComponent(uid)).then(function(r){
        if(!r.ok) throw new Error('http'); return (r.json&&r.json[0])||null;
      });
    },
    chatPut:function(uid,msgs){
      return call('POST','/rest/v1/horus_chat',{body:{user_id:uid,msgs:msgs},prefer:'resolution=merge-duplicates,return=minimal'}).then(function(w){
        if(!w.ok&&w.status!==201&&w.status!==204) throw new Error('http'); return true;
      });
    }
  };
};
})();
