import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
const headers={'Access-Control-Allow-Origin':'https://imp-project-jade.vercel.app','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Content-Type':'application/json'};
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('origin')||'';
 const allowed=origin==='https://imp-project-jade.vercel.app'||/^http:\/\/(localhost|127\.0\.0\.1):517[34]$/.test(origin);
 const cors={...headers,...(allowed?{'Access-Control-Allow-Origin':origin}:{})};
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 const respond=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
 try{
 if(req.method!=='POST')return respond({error:'Method not allowed'},405);
 const token=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'');if(!token)return respond({error:'Sign in required'},401);
 const url=Deno.env.get('SUPABASE_URL')!,caller=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:'Bearer '+token}},auth:{persistSession:false}});
 const {data:auth,error:authError}=await caller.auth.getUser(token);if(authError||!auth.user)return respond({error:'Invalid session'},401);
 if(auth.user.app_metadata.must_change_password)return respond({error:'Ganti password sebelum melanjutkan'},403);
 const input=await req.json(),{workspace,action}=input;
 const {data:profile,error}=await caller.from('wci_profiles').select('role,active').eq('workspace_id',workspace).eq('user_id',auth.user.id).single();
 if(error||!profile?.active||!['admin','super_admin'].includes(profile.role))return respond({error:'Admin access required'},403);
 const service=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
 if(action==='create'){
 const email=String(input.email||'').trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Email tidak valid');
 const password=String(input.password||'');if(password.length<12)throw new Error('Password sementara minimal 12 karakter');
 const {data:user,error:e}=await service.auth.admin.createUser({email,email_confirm:true,password,app_metadata:{must_change_password:true,password_setup_nonce:crypto.randomUUID()},user_metadata:{display_name:String(input.name||'')}});if(e||!user.user)throw e||new Error('Create failed');
 const {error:save}=await caller.rpc('wci_save_user',{p_workspace:workspace,p_user:user.user.id,p_name:String(input.name||''),p_role:input.role,p_active:input.active!==false,p_access:input.access||[]});
 if(save){await service.auth.admin.deleteUser(user.user.id);throw save;}
 return respond({user_id:user.user.id});
 }
 if(action==='email'){
 const email=String(input.email||'').trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Email tidak valid');
 const {data:target,error:targetError}=await caller.from('wci_profiles').select('role,email').eq('workspace_id',workspace).eq('user_id',input.user_id).single();if(targetError||!target)throw new Error('User unavailable');
 if(profile.role!=='super_admin'&&['super_admin','admin'].includes(target.role))return respond({error:'Super Admin required'},403);
 const {error:change}=await service.auth.admin.updateUserById(input.user_id,{email,email_confirm:true});if(change)throw change;
 const {error:save}=await service.from('wci_profiles').update({email}).eq('user_id',input.user_id);
 if(save){await service.auth.admin.updateUserById(input.user_id,{email:target.email,email_confirm:true});throw save;}
 const {error:audit}=await service.from('wci_audit').insert({workspace_id:workspace,user_id:auth.user.id,action:'login_email_updated',details:{user:input.user_id}});if(audit)throw audit;
 return respond({user_id:input.user_id});
 }
 if(action==='reset'){
 const {data:target,error:e}=await caller.from('wci_profiles').select('email,role').eq('workspace_id',workspace).eq('user_id',input.user_id).single();if(e||!target)throw new Error('User unavailable');
 if(profile.role!=='super_admin'&&['super_admin','admin'].includes(target.role))return respond({error:'Super Admin required'},403);
 const password=String(input.password||'');if(password.length<12)throw new Error('Password sementara minimal 12 karakter');
 const {data:current,error:lookup}=await service.auth.admin.getUserById(input.user_id);if(lookup||!current.user)throw new Error('User unavailable');
 const {error:change}=await service.auth.admin.updateUserById(input.user_id,{password,app_metadata:{...current.user.app_metadata,must_change_password:true,password_setup_nonce:crypto.randomUUID()}});if(change)throw change;
 const {error:audit}=await service.from('wci_audit').insert({workspace_id:workspace,user_id:auth.user.id,action:'temporary_password_reset',details:{user:input.user_id}});if(audit)throw audit;
 return respond({user_id:input.user_id});
 }
 return respond({error:'Unknown action'},400);
 }catch(e){return respond({error:e instanceof Error?e.message:(e as {message?:string})?.message||String(e)},400);}
});
