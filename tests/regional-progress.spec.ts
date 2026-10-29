import {test,expect,type WebSocketRoute,type Page} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
test('Regional user New/maintenance workflow refreshes every authorized role via realtime',async({browser})=>{
 test.skip(process.env.WCI_CACHE_MOCK!=='1','Isolated Supabase fixture required');
 const rows=[{id:'new',position:1,payload:{company:'New A',cid:'source-1',type:'New',status:'In progress',product:'API OGP',implementor:'Person A',region:'W01',salesDate:'2026-10-01',docComplete:'2026-10-01'}},{id:'maint',position:2,payload:{company:'Maintenance A',cid:'source-2',type:'Maintenance',status:'In progress',product:'API OGP',implementor:'Person A',region:'W01',salesDate:'2026-10-01',docComplete:'2026-10-01'}},{id:'other',position:3,payload:{company:'Other B',cid:'source-3',type:'New',status:'Pending',product:'API OGP',implementor:'Person B',region:'W02',salesDate:'2026-10-01'}}] as {id:string;position:number;payload:Record<string,string>}[];
 let revision=1,calls=0;const sockets=new Map<string,{socket:WebSocketRoute;joinRef:string|null;v2:boolean;topic:string}>();
 const publish=()=>{for(const {topic,socket,joinRef,v2} of sockets.values()){const payload={ids:[1],data:{schema:'public',table:'wci_events',type:'UPDATE',columns:[{name:'workspace_id',type:'uuid'},{name:'revision',type:'int8'}],commit_timestamp:new Date().toISOString(),record:{workspace_id:'workspace',revision},old_record:{workspace_id:'workspace'},errors:null}};socket.send(JSON.stringify(v2?[joinRef,null,topic,'postgres_changes',payload]:{topic,event:'postgres_changes',payload,ref:null}));}};
 const pages=new Map<string,Page>();const contexts=[];
 try{
 for(const role of ['individual','super_admin','department_head','team_leader','other']){
  const context=await browser.newContext({viewport:{width:1440,height:1000}});contexts.push(context);const page=await context.newPage();pages.set(role,page);
  const user={id:role,aud:'authenticated',role:'authenticated',email:role+'@fixture.invalid',app_metadata:{},user_metadata:{}};
  const token=btoa(JSON.stringify({alg:'HS256',typ:'JWT'}))+'.'+btoa(JSON.stringify({sub:user.id,exp:4102444800,role:'authenticated'}))+'.signature';
  await page.routeWebSocket('wss://cache-test.supabase.co/**',socket=>socket.onMessage(raw=>{const parsed=JSON.parse(String(raw)),v2=Array.isArray(parsed),m=v2?{join_ref:parsed[0],ref:parsed[1],topic:parsed[2],event:parsed[3],payload:parsed[4]}:parsed;const reply=(payload:unknown)=>socket.send(JSON.stringify(v2?[m.join_ref,m.ref,m.topic,'phx_reply',payload]:{topic:m.topic,event:'phx_reply',ref:m.ref,payload}));if(m.event==='phx_join'){sockets.set(role+':'+m.topic,{socket,joinRef:m.join_ref??null,v2,topic:m.topic});reply({status:'ok',response:{postgres_changes:[{...m.payload.config.postgres_changes[0],id:1}]}});}else if(m.event==='heartbeat')reply({status:'ok',response:{}});}));
  await page.route('https://cache-test.supabase.co/**',async route=>{
   const url=new URL(route.request().url());let body:unknown=[];let count:number|undefined;
   if(url.pathname==='/auth/v1/token')body={access_token:token,refresh_token:'fixture',expires_in:3600,token_type:'bearer',user};
   else if(url.pathname==='/auth/v1/user')body=user;
   else if(url.pathname.endsWith('/wci_members'))body=[{workspace_id:'workspace',role:'viewer',wci_workspaces:{name:'Fixture'}}];
   else if(url.pathname.endsWith('/wci_profiles'))body={workspace_id:'workspace',user_id:user.id,name:role,email:user.email,role:role==='other'?'individual':role,active:true};
   else if(url.pathname.endsWith('/wci_access'))body=[{workspace_id:'workspace',user_id:user.id,dataset:'regional',source:'AT',team_id:null,pic:role==='individual'?'Person A':role==='other'?'Person B':''}];
   else if(url.pathname.endsWith('/wci_datasets'))body={active_batch:'batch',data_mode:'reference'};
   else if(url.pathname.endsWith('/wci_events'))body={revision};
   else if(url.pathname.endsWith('/wci_records')){const scoped=url.searchParams.get('dataset')==='eq.regional'?rows.filter(r=>role==='individual'?r.payload.implementor==='Person A':role==='other'?r.payload.implementor==='Person B':true):[];body=structuredClone(scoped);count=scoped.length;}
   else if(url.pathname.endsWith('/wci_regional_progress')){
    calls++;const update=route.request().postDataJSON();const row=rows.find(r=>r.id===update.p_id)!;expect(role).toBe('individual');expect(row.payload.implementor).toBe('Person A');
    if(update.p_action==='done'){if(row.payload.type==='New')row.payload.companyId=update.p_company_id;else expect(update.p_company_id).toBeNull();Object.assign(row.payload,{status:'Done',doneDate:'2026-10-29',dashboardUpdatedAt:new Date().toISOString()});}
    else Object.assign(row.payload,{handover:'Handover',dashboardHandoverAt:new Date().toISOString()});
    revision++;await route.fulfill({status:200,json:null});publish();return;
   }
   await route.fulfill({status:200,json:body,headers:count===undefined?{}:{'content-range':count?`0-${count-1}/${count}`:'*/0'}});
  });
  await page.goto('/');await page.getByLabel('Email',{exact:true}).fill(user.email);await page.getByLabel('Password',{exact:true}).fill('fixture-password');await page.getByRole('button',{name:'Login',exact:true}).click();await expect(page.locator('.app-shell')).toBeVisible();
  if(role==='super_admin')await page.getByRole('button',{name:'Regional Head Office',exact:true}).click();
  await page.getByRole('button',{name:role==='individual'?'My Task':'Data',exact:true}).click();
 }
 await expect.poll(()=>sockets.size).toBe(5);
 const user=pages.get('individual')!,newTask=user.locator('.my-tasks tbody tr').filter({hasText:'New A'}),maintenance=user.locator('.my-tasks tbody tr').filter({hasText:'Maintenance A'});
 await expect(newTask.getByRole('button',{name:'Handover',exact:true})).toHaveCount(0);
 await newTask.getByRole('button',{name:'Tandai Done',exact:true}).click();await user.getByRole('button',{name:'Konfirmasi Done',exact:true}).click();await expect(user.getByRole('alert')).toContainText('Company ID wajib');expect(calls).toBe(0);
 await user.getByLabel('Company ID',{exact:true}).fill('COMPANY-001');await mkdir('private/regional-workflow-qa',{recursive:true});await user.locator('.task-done-dialog').screenshot({path:'private/regional-workflow-qa/new-company.png'});await user.setViewportSize({width:390,height:844});expect(await user.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await user.locator('.task-done-dialog').screenshot({path:'private/regional-workflow-qa/new-company-mobile.png'});await user.setViewportSize({width:1440,height:1000});await user.getByRole('button',{name:'Konfirmasi Done',exact:true}).click();await expect(user.locator('.task-done-dialog')).toHaveCount(0);
 for(const role of ['super_admin','department_head','team_leader']){const record=pages.get(role)!.locator('.records tbody tr').filter({hasText:'New A'});await expect(record).toContainText('COMPANY-001');await expect(record).toContainText('Done');}
 await expect(pages.get('other')!.locator('.records')).not.toContainText('COMPANY-001');
 await newTask.getByRole('button',{name:'Handover',exact:true}).click();const doneDate=rows[0].payload.doneDate;await user.getByRole('button',{name:'Konfirmasi Handover',exact:true}).click();await expect(newTask.getByRole('button',{name:'Handover',exact:true})).toHaveCount(0);expect(rows[0].payload.doneDate).toBe(doneDate);
 for(const role of ['super_admin','department_head','team_leader'])await expect(pages.get(role)!.locator('.records tbody tr').filter({hasText:'New A'})).toContainText('Handover');
 await maintenance.getByRole('button',{name:'Tandai Done',exact:true}).click();await expect(user.getByLabel('Company ID',{exact:true})).toHaveCount(0);await user.getByRole('button',{name:'Konfirmasi Done',exact:true}).click();await expect(maintenance).toContainText('Done');await expect(maintenance.getByRole('button',{name:'Handover',exact:true})).toHaveCount(0);
 for(const role of ['super_admin','department_head','team_leader'])await expect(pages.get(role)!.locator('.records tbody tr').filter({hasText:'Maintenance A'})).toContainText('Done');
 expect(calls).toBe(3);await user.locator('.my-tasks').screenshot({path:'private/regional-workflow-qa/completed.png'});
 }finally{for(const context of contexts)await context.close();}
});
