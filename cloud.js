(()=>{'use strict';
const C=window.FAMILY_CONFIG,KEY='joetou.family.auth.v1';let session=null,refreshing=null;
try{session=JSON.parse(localStorage.getItem(KEY));}catch(_){}
const ready=()=>/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(C.url)&&!!C.publicKey;
function store(s){if(s?.access_token&&s?.refresh_token){session={access_token:s.access_token,refresh_token:s.refresh_token,expires_at:Date.now()+s.expires_in*1000,user:s.user};try{localStorage.setItem(KEY,JSON.stringify(session));}catch(_){}}else{session=null;try{localStorage.removeItem(KEY);}catch(_){}}}
async function request(path,{method='GET',body,auth=true,headers={}}={}){
 if(!ready())throw Error('雲端服務尚未設定。');if(!navigator.onLine)throw Error('目前離線，請連線後再試。');
 if(auth){if(!session)throw Error('請先登入。');if(session.expires_at<Date.now()+60000)await refresh();}
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
 try{const res=await fetch(C.url+path,{method,signal:controller.signal,headers:{apikey:C.publicKey,'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+session.access_token}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});const raw=await res.text();let data;try{data=raw?JSON.parse(raw):null;}catch(_){throw Error('雲端回應異常，請重新整理。');}
 if(!res.ok){const err=Error(res.status===401?'登入已過期，請登出後重新登入。':res.status===429?'操作太頻密，請稍後再試。':data?.error_description||data?.msg||data?.message||'未能連接雲端。');err.status=res.status;throw err;}return data;
 }catch(e){if(e.name==='AbortError')throw Error('連線逾時，請重新整理確認是否已儲存。');throw e;}finally{clearTimeout(timer);}
}
async function refresh(){if(refreshing)return refreshing;refreshing=(async()=>{const token=session?.refresh_token;if(!token)throw Error('請重新登入。');try{const s=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:token},auth:false});store(s);}catch(e){if(e.status===400||e.status===401)store(null);throw e;}})();try{await refreshing;}finally{refreshing=null;}}
const authBody=(email,password)=>({email,password});
const cloud={ready,loggedIn:()=>!!session,user:()=>session?.user,
 async login(email,password){store(await request('/auth/v1/token?grant_type=password',{method:'POST',body:authBody(email,password),auth:false}));},
 async signup(email,password){const s=await request('/auth/v1/signup',{method:'POST',body:authBody(email,password),auth:false});if(s.access_token)store(s);return !!s.access_token;},
 async reset(email){await request('/auth/v1/recover',{method:'POST',body:{email},auth:false});},
 async acceptRecovery(){const q=new URLSearchParams(location.hash.slice(1));if(!q.get('access_token'))return false;const recovery=q.get('type')==='recovery';store({access_token:q.get('access_token'),refresh_token:q.get('refresh_token'),expires_in:Number(q.get('expires_in'))||3600});history.replaceState(null,'',location.pathname);return recovery;},
 async password(password){const user=await request('/auth/v1/user',{method:'PUT',body:{password}});session.user=user;store({...session,expires_in:Math.max(60,(session.expires_at-Date.now())/1000)});},
 async logout(){try{if(session)await request('/auth/v1/logout?scope=local',{method:'POST'});}finally{store(null);}},
 async list(){return request('/rest/v1/family_wallets?select=*&order=position.asc,id.asc');},
 async add(name,state,position){const rows=await request('/rest/v1/family_wallets',{method:'POST',headers:{Prefer:'return=representation'},body:{name,state,position}});return rows[0];},
 async update(wallet,changes){const rows=await request('/rest/v1/family_wallets?id=eq.'+encodeURIComponent(wallet.id)+'&revision=eq.'+wallet.revision,{method:'PATCH',headers:{Prefer:'return=representation'},body:changes});if(rows.length!==1){const e=Error('家人剛更新了這個銀包，已重新載入。請確認後再操作一次。');e.conflict=true;throw e;}return rows[0];}
};window.FamilyCloud=cloud;
})();
