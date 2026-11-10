import {useEffect} from 'react';
import {supabase} from './supabase';

export const LOGIN_LIMIT_MS=15*60*1000;
/** A fixed deadline: refreshing tokens, opening menus and tab focus never restart it. */
export function watchSessionDeadline(deadline:number,expired:()=>void){
 let stopped=false;
 const check=()=>{if(!stopped&&Date.now()>=deadline){stopped=true;expired();}};
 const timer=setTimeout(check,Math.max(0,deadline-Date.now()));
 const poll=setInterval(check,1000);
 window.addEventListener('focus',check);document.addEventListener('visibilitychange',check);
 return ()=>{stopped=true;clearTimeout(timer);clearInterval(poll);window.removeEventListener('focus',check);document.removeEventListener('visibilitychange',check);};
}
export function useSessionLimit(userId:string|undefined,preview:boolean,onExpired:()=>void){
 useEffect(()=>{
  if(!userId||preview||!supabase)return;
  let active=true,stop=()=>{},expired=false;
  const expire=()=>{if(!active||expired)return;expired=true;onExpired();void supabase!.auth.signOut({scope:'local'}).catch(()=>{});};
  window.addEventListener('wci-session-expired',expire);
  void (async()=>{
   const {data}=await supabase!.auth.getSession();if(!active||!data.session)return;
   const session=data.session;
   let claims:{session_id?:string;iat?:number}={};try{claims=JSON.parse(atob(session.access_token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));}catch{/* Server check remains authoritative. */}
   const key='wci-login-deadline:'+userId+':'+(claims.session_id||session.user.last_sign_in_at||'current');
   let saved:number|null=null;try{saved=Number(sessionStorage.getItem(key))||null;}catch{/* Storage can be disabled. */}
   let deadline=saved||((Date.parse(session.user.last_sign_in_at||'')||(claims.iat||0)*1000||Date.now())+LOGIN_LIMIT_MS);
   stop=watchSessionDeadline(deadline,expire);
   const {data:result,error}=await supabase!.rpc('wci_session_deadline');if(!active||expired)return;
   if(error){if(error.code==='PT401'||error.message?.includes('WCI_SESSION_EXPIRED'))expire();return;}
   if(result?.expires_at&&result?.server_now){const remaining=Date.parse(result.expires_at)-Date.parse(result.server_now);deadline=Date.now()+remaining;stop();stop=watchSessionDeadline(deadline,expire);}
   try{sessionStorage.setItem(key,String(deadline));}catch{/* The in-memory clock still enforces the limit. */}
  })().catch(()=>{});
  return ()=>{active=false;stop();window.removeEventListener('wci-session-expired',expire);};
 },[userId,preview,onExpired]);
}
