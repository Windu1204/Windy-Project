import {test,expect,type WebSocketRoute} from '@playwright/test';

test.skip(process.env.WCI_CACHE_MOCK!=='1','Requires an isolated fake Supabase dev server');
for(const role of ['team_leader','individual'])for(const kind of ['ijr','regional','corporate','piloting'])test(`${role} ${kind}: realtime updates members while preserving personal and mapped team scope`,async({page})=>{
 let revision=1,batch='first',mapped=role==='individual',requestedBatch='';
 let members=['Person A','Person B'];
 const sockets=new Map<string,{socket:WebSocketRoute;joinRef:string|null;v2:boolean}>();
 await page.routeWebSocket('wss://cache-test.supabase.co/**',socket=>{
  socket.onMessage(raw=>{
   const parsed=JSON.parse(String(raw)),v2=Array.isArray(parsed);
   const message=v2?{join_ref:parsed[0],ref:parsed[1],topic:parsed[2],event:parsed[3],payload:parsed[4]}:parsed;
   const reply=(payload:unknown)=>socket.send(JSON.stringify(v2?[message.join_ref,message.ref,message.topic,'phx_reply',payload]:{topic:message.topic,event:'phx_reply',ref:message.ref,payload}));
   if(message.event==='phx_join'){
    sockets.set(message.topic,{socket,joinRef:message.join_ref??null,v2});
    reply({status:'ok',response:{postgres_changes:[{...message.payload.config.postgres_changes[0],id:1}]}});
   }else if(message.event==='heartbeat')reply({status:'ok',response:{}});
  });
 });
 const user={id:'leader',aud:'authenticated',role:'authenticated',email:'leader@example.invalid',app_metadata:{},user_metadata:{}};
 const token=btoa(JSON.stringify({alg:'HS256',typ:'JWT'}))+'.'+btoa(JSON.stringify({sub:user.id,exp:4102444800,role:'authenticated'}))+'.signature';
 const payload=(name:string,index:number)=>kind==='ijr'?{'Application Number':'TEST-'+index,'Applicant Name':'Test','Application Type':'New Request',Status:'Dalam Proses','Request Date':'2026-10-01','Implementor 1':name,Wilayah:'W01'}:kind==='piloting'?{'No. Register':'TEST-'+index,'Nama Perusahaan':'Test','PIC AT':name,'Jenis Produk / Solusi':'BNIdirect','Jenis Formulir':'New','Tanggal Assign to AT':'2026-10-01',Kategori:'Done'}:{noreg:'TEST-'+index,cid:String(index),company:'Test',implementor:name,type:'New',projectType:'New',product:'BNIdirect',region:'W01',segment:'COB1',assignDate:'2026-10-01',salesDate:'2026-10-01',status:'Pending'};
 await page.route('https://cache-test.supabase.co/**',async route=>{
  const url=new URL(route.request().url());let body:unknown=[];let count:number|undefined;
  if(url.pathname==='/auth/v1/token')body={access_token:token,refresh_token:'fixture',expires_in:3600,token_type:'bearer',user};
  else if(url.pathname==='/auth/v1/user')body=user;
  else if(url.pathname.endsWith('/wci_members'))body=[{workspace_id:'workspace',role:'viewer',wci_workspaces:{name:'Fixture'}}];
  else if(url.pathname.endsWith('/wci_profiles'))body={workspace_id:'workspace',user_id:user.id,name:'Fixture account',email:user.email,role,active:true};
  else if(url.pathname.endsWith('/wci_access'))body=[{workspace_id:'workspace',user_id:user.id,dataset:kind,source:'AT',team_id:role==='team_leader'&&mapped?'team':null,pic:role==='individual'?'Person A':''}];
  else if(url.pathname.endsWith('/wci_team_people'))body=mapped?[{team_id:'team',pic:'Person A'}]:[];
  else if(url.pathname.endsWith('/wci_datasets'))body={active_batch:'reference',operational_batch:batch,data_mode:'operational'};
  else if(url.pathname.endsWith('/wci_events'))body={revision};
  else if(url.pathname.endsWith('/wci_records')){
   if(url.searchParams.get('dataset')==='eq.'+kind)requestedBatch=url.searchParams.get('batch_id')||'';
   const names=url.searchParams.get('dataset')==='eq.'+kind?(mapped?members.filter(name=>name==='Person A'):members):[];
   body=names.map((name,index)=>({id:name,position:index+1,payload:payload(name,index)}));count=names.length;
  }
  await route.fulfill({status:200,json:body,headers:count===undefined?{}:{'content-range':count?`0-${count-1}/${count}`:'*/0'}});
 });
 await page.goto('/');await page.getByLabel('Email',{exact:true}).fill(user.email);await page.getByLabel('Password',{exact:true}).fill('fixture-password');await page.getByRole('button',{name:'Login',exact:true}).click();
 await expect(page.locator('.app-shell')).toBeVisible();
 await page.getByRole('button',{name:role==='individual'?'Kinerja Saya':'Kinerja & Beban Kerja',exact:true}).click();
 await expect(page.locator('.person-row')).toHaveCount(role==='individual'?1:2);
 await expect.poll(()=>sockets.size).toBeGreaterThan(0);
 await expect(page.locator('.update-status:not(.offline)')).toBeVisible();
 const publish=()=>{for(const [topic,{socket,joinRef,v2}] of sockets){const payload={ids:[1],data:{schema:'public',table:'wci_events',type:'UPDATE',columns:[{name:'workspace_id',type:'uuid'},{name:'revision',type:'int8'}],commit_timestamp:new Date().toISOString(),record:{workspace_id:'workspace',revision},old_record:{workspace_id:'workspace'},errors:null}};socket.send(JSON.stringify(v2?[joinRef,null,topic,'postgres_changes',payload]:{topic,event:'postgres_changes',payload}));}};
 members.push('New Member');batch='second';revision++;publish();
 await expect.poll(()=>requestedBatch).toBe('eq.second');
 await expect(page.locator('.person-row')).toHaveCount(role==='individual'?1:3);
 if(role==='team_leader')await expect(page.locator('.person-list')).toContainText('New Member');
 else await expect(page.locator('.person-list')).not.toContainText('New Member');
 mapped=true;revision++;publish();
 await expect(page.locator('.person-row')).toHaveCount(1);
 await expect(page.locator('.person-list')).toContainText('Person A');
 await expect(page.locator('.person-list')).not.toContainText('Person B');
});
