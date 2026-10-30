import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
const indicator={key:'sla',perspective:'Internal Business Process',section:'Project Delivery',label:'SLA Adherence',weight:.5,unit:'%',nature:'Higher is Better',details:['New & Maintenance']};
for(const role of ['admin','department_head','team_leader','individual'])test(`weighted ranking ${role}: all indicators, saved scores, scope and refresh`,async({page})=>{
 test.skip(!process.env.WCI_CACHE_MOCK,'Isolated fake Supabase server required');
 let revision=1;const values:Record<string,any[]>={'2026-06-01':[{person_id:'person-a',period:'2026-06-01',indicator_key:'sla',target:'≥95%',actual:null,note:'',updated_at:'2026-01-01T00:00:00Z'}]};
 values['2026-06-01']=[...['person-a','person-b'].flatMap(person_id=>[{person_id,period:'2026-06-01',indicator_key:'sla',target:'100',actual:person_id==='person-a'?120:80,note:'',updated_at:''},{person_id,period:'2026-06-01',indicator_key:'precise',target:'100',actual:100,note:'',updated_at:''},{person_id,period:'2026-06-01',indicator_key:'special',target:'',actual:80,note:'',updated_at:''}])];
 const user={id:'fixture-user',aud:'authenticated',role:'authenticated',email:'fixture@example.invalid',app_metadata:{},user_metadata:{}};
 const profile={workspace_id:'workspace',user_id:user.id,name:'Fixture',email:user.email,role,active:true};
 const people=[{id:'person-a',template_code:'pilot',name:'Person A',npp:'TEST-A',grade:'8',position:'AMGR',managed:'Activation Team',aliases:['Person A'],user_id:role==='individual'?user.id:null,leader_id:null},{id:'person-b',template_code:'pilot',name:'Person B',npp:'TEST-B',grade:'9',position:'AMGR',managed:'Activation Team',aliases:['Person B'],user_id:null,leader_id:null}];
 const templates=[{code:'pilot',group_code:'piloting',title:'Piloting – Activation Team',indicators:[indicator,{...indicator,key:'precise',label:'Precise compliance',weight:.3,nature:'Precise is Better'},{...indicator,key:'special',label:'Special achievement',weight:.2,unit:'Special Scoring'}]}];
 let saved=0;
 await page.routeWebSocket(/supabase\.co/,socket=>socket.close());
 await page.route('https://cache-test.supabase.co/**',async route=>{
  const url=new URL(route.request().url());let body:any=[];
  if(url.pathname==='/auth/v1/token')body={access_token:btoa(JSON.stringify({alg:'HS256',typ:'JWT'}))+'.'+btoa(JSON.stringify({sub:user.id,exp:4102444800,role:'authenticated'}))+'.signature',refresh_token:'fixture',expires_in:3600,token_type:'bearer',user};
  else if(url.pathname==='/auth/v1/user')body=user;
  else if(url.pathname.endsWith('/wci_members'))body=[{workspace_id:'workspace',role:'owner',wci_workspaces:{name:'Test'}}];
  else if(url.pathname.endsWith('/wci_profiles'))body=url.searchParams.has('user_id')?profile:[profile];
  else if(url.pathname.endsWith('/wci_access'))body=[{user_id:user.id,dataset:'piloting',source:'AT',team_id:null,pic:'Person A'}];
  else if(url.pathname.endsWith('/wci_datasets'))body={active_batch:'batch',data_mode:'reference'};
  else if(url.pathname.endsWith('/wci_events'))body={revision};
  else if(url.pathname.endsWith('/wci_kpi_read_year')){const req=route.request().postDataJSON();body={people:role==='individual'?people.slice(0,1):people,templates,values:Object.values(values).flat().filter(v=>v.period.startsWith(String(req.p_year))&&(role!=='individual'||v.person_id==='person-a'))};}
  else if(url.pathname.endsWith('/wci_kpi_read')){const req=route.request().postDataJSON();body={people:role==='individual'?people.slice(0,1):people,templates,values:(values[req.p_period]||[]).filter(v=>role!=='individual'||v.person_id==='person-a')};}
  else if(url.pathname.endsWith('/wci_kpi_save_person')){const req=route.request().postDataJSON();const p=people.find(p=>p.id===req.p_person.id);if(p)Object.assign(p,req.p_person);revision++;body=null;}
  else if(url.pathname.endsWith('/wci_kpi_save')){const req=route.request().postDataJSON();saved++;values[req.p_period]=[...(values[req.p_period]||[]).filter(v=>v.person_id!==req.p_person||!req.p_changes.some((c:any)=>c.indicator_key===v.indicator_key)),...req.p_changes.map((c:any)=>({...c,person_id:req.p_person,period:req.p_period,updated_at:'2026-10-27T00:00:00Z'}))];revision++;body=null;}
  await route.fulfill({status:200,json:body});
 });
 await page.goto('/');await page.getByLabel('Email',{exact:true}).fill(user.email);await page.getByLabel('Password',{exact:true}).fill('fixture-password');await page.getByRole('button',{name:'Login',exact:true}).click();
 const editable=role==='admin'||role==='super_admin';
 if(editable){if(role==='super_admin')await page.getByRole('button',{name:'Admin',exact:true}).click();await page.getByRole('button',{name:'Pengelolaan KPI',exact:true}).click();}
 else await page.getByRole('button',{name:'KPI',exact:true}).click();
 await expect(page.locator('.formal-kpi')).toBeVisible();if(role==='individual'){await expect(page.locator('.kpi-intro p')).toHaveCount(0);await expect(page.getByLabel('Kelompok KPI',{exact:true})).toHaveCount(0);}else{await expect(page.locator('.kpi-intro p')).toBeVisible();await expect(page.getByLabel('Kelompok KPI',{exact:true})).toBeVisible();}await page.getByLabel('Tahun KPI',{exact:true}).selectOption('2026');await page.getByLabel('Bulan KPI',{exact:true}).selectOption('06');
 if(role!=='individual')await page.getByLabel('Nama pegawai KPI',{exact:true}).selectOption('person-a');

 await expect(page.locator('.kpi-person-score')).toContainText('106%');
 if(role==='individual'){await expect(page.locator('.kpi-ranking')).toHaveCount(0);await expect(page.locator('.formal-kpi')).not.toContainText('Person B');}
 else {
  await expect(page.locator('.kpi-ranking tbody tr')).toHaveCount(2);
  await expect(page.locator('.kpi-ranking tbody tr').first()).toContainText('Person A');
  await expect(page.locator('.kpi-ranking tbody tr').first()).toContainText('#1');
 }
 if(editable){
  await page.getByLabel('Realisasi Special achievement',{exact:true}).fill('100');
  await expect(page.locator('.kpi-person-score')).toContainText('106%');
  await expect(page.locator('.kpi-ranking').getByRole('button',{name:'Person B',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Simpan target & realisasi',exact:true}).click();
  await expect(page.locator('.kpi-person-score')).toContainText('110%');
 }else {
  values['2026-06-01'].find(v=>v.person_id==='person-a'&&v.indicator_key==='special')!.actual=null;revision++;
  await page.evaluate(()=>window.dispatchEvent(new Event('online')));
  await expect(page.locator('.kpi-person-score')).toContainText('Data belum lengkap');
  if(role!=='individual'){
   await expect(page.locator('.kpi-ranking tbody tr').first()).toContainText('Person B');
   await expect(page.locator('.kpi-ranking tbody tr').last()).toContainText('Data belum lengkap');
  }
 }
 if(role==='department_head'){
  values['2026-06-01'].find(v=>v.person_id==='person-a'&&v.indicator_key==='special')!.actual=80;
  values['2026-07-01']=values['2026-06-01'].filter(v=>v.person_id==='person-a').map(v=>({...v,period:'2026-07-01',actual:v.indicator_key==='sla'?80:v.actual}));revision++;
  await page.getByRole('button',{name:'Tahunan',exact:true}).click();
  const row=page.locator('.kpi-ranking tbody tr').filter({hasText:'Person A'});
  await expect(row).toContainText('96,00%');await expect(row).toContainText('2 / 12');
  await page.getByLabel('Nama pegawai KPI',{exact:true}).selectOption('');
  await mkdir('private/kpi-ranking-qa',{recursive:true});await page.locator('.kpi-ranking').screenshot({path:'private/kpi-ranking-qa/ranking.png'});
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 }
});
