import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import {readFile,mkdir} from 'node:fs/promises';
import {test,expect} from '@playwright/test';
const indicator={key:'sla',perspective:'Internal Business Process',section:'Project Delivery',label:'SLA Adherence',weight:1,unit:'%',nature:'Higher is Better',details:['New & Maintenance']};
for(const role of ['admin','super_admin','department_head','team_leader','individual'])test(`formal KPI ${role}: role menu, target history, empty month and realtime`,async({page})=>{
 test.skip(!process.env.WCI_CACHE_MOCK,'Isolated fake Supabase server required');
 let revision=1;const values:Record<string,any[]>={'2026-06-01':[{person_id:'person-a',period:'2026-06-01',indicator_key:'sla',target:'≥95%',actual:null,note:'',updated_at:'2026-01-01T00:00:00Z'}]};
 const user={id:'fixture-user',aud:'authenticated',role:'authenticated',email:'fixture@example.invalid',app_metadata:{},user_metadata:{}};
 const profile={workspace_id:'workspace',user_id:user.id,name:'Fixture',email:user.email,role,active:true};
 const people=[{id:'person-a',template_code:'pilot',name:'Person A',npp:'TEST-A',grade:'8',position:'AMGR',managed:'Activation Team',aliases:['Person A'],user_id:role==='individual'?user.id:null,leader_id:null},{id:'person-b',template_code:'pilot',name:'Person B',npp:'TEST-B',grade:'9',position:'AMGR',managed:'Activation Team',aliases:['Person B'],user_id:null,leader_id:null}];
 const templates=[{code:'pilot',group_code:'piloting',title:'Piloting – Activation Team',indicators:[indicator]}];
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
  else if(url.pathname.endsWith('/wci_kpi_read_year')){const req=route.request().postDataJSON();body={people:role==='individual'?people.slice(0,1):people,templates,values:Object.values(values).flat().filter(v=>v.period.startsWith(String(req.p_year)))};}
  else if(url.pathname.endsWith('/wci_kpi_read')){const req=route.request().postDataJSON();body={people:role==='individual'?people.slice(0,1):people,templates,values:values[req.p_period]||[]};}
  else if(url.pathname.endsWith('/wci_kpi_save_person')){const req=route.request().postDataJSON();const p=people.find(p=>p.id===req.p_person.id);if(p)Object.assign(p,req.p_person);revision++;body=null;}
  else if(url.pathname.endsWith('/wci_kpi_save')){const req=route.request().postDataJSON();saved++;values[req.p_period]=req.p_changes.map((c:any)=>({...c,person_id:req.p_person,period:req.p_period,updated_at:'2026-10-27T00:00:00Z'}));revision++;body=null;}
  await route.fulfill({status:200,json:body});
 });
 await page.goto('/');await page.getByLabel('Email',{exact:true}).fill(user.email);await page.getByLabel('Password',{exact:true}).fill('fixture-password');await page.getByRole('button',{name:'Login',exact:true}).click();
 const editable=role==='admin'||role==='super_admin';
 if(editable){if(role==='super_admin')await page.getByRole('button',{name:'Admin',exact:true}).click();await page.getByRole('button',{name:'Pengelolaan KPI',exact:true}).click();}
 else await page.getByRole('button',{name:'KPI',exact:true}).click();
 await expect(page.locator('.formal-kpi')).toBeVisible();if(role==='individual'){await expect(page.locator('.kpi-intro p')).toHaveCount(0);await expect(page.getByLabel('Kelompok KPI',{exact:true})).toHaveCount(0);}else{await expect(page.locator('.kpi-intro p')).toBeVisible();await expect(page.getByLabel('Kelompok KPI',{exact:true})).toBeVisible();}await page.getByLabel('Tahun KPI',{exact:true}).selectOption('2026');await page.getByLabel('Bulan KPI',{exact:true}).selectOption('06');
 if(role!=='individual')await page.getByLabel('Nama pegawai KPI',{exact:true}).selectOption('person-a');
 await expect(page.getByRole('heading',{name:'Person A',exact:true})).toBeVisible();
 if(role==='individual'){await expect(page.locator('.formal-kpi')).not.toContainText('Person B');await expect(page.getByLabel('Nama pegawai KPI')).toHaveCount(0);}
 if(editable){await expect(page.getByLabel('Target SLA Adherence',{exact:true})).toHaveValue('≥95%');await page.getByLabel('Bulan KPI',{exact:true}).selectOption('01');await expect(page.getByLabel('Target SLA Adherence',{exact:true})).toHaveValue('');await page.getByLabel('Target SLA Adherence',{exact:true}).fill('≥95%');await page.getByLabel('Realisasi SLA Adherence',{exact:true}).fill('96,5');await page.getByRole('button',{name:'Simpan target & realisasi',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Target dan realisasi berhasil disimpan.'})).toBeVisible();expect(saved).toBe(1);await page.getByLabel('Bulan KPI',{exact:true}).selectOption('02');await page.getByLabel('Bulan KPI',{exact:true}).selectOption('01');await expect(page.getByLabel('Realisasi SLA Adherence',{exact:true})).toHaveValue('96.5');}
 else {await expect(page.locator('.kpi-score-table')).toContainText('≥95%');await expect(page.getByRole('button',{name:'Simpan target & realisasi',exact:true})).toHaveCount(0);values['2026-06-01'][0].actual=97;revision++;await page.evaluate(()=>window.dispatchEvent(new Event('online')));await expect(page.locator('.kpi-score-table')).toContainText('97%');}
 await expect(page.getByLabel('Tahun KPI',{exact:true}).locator('option').first()).toHaveText('2026');await expect(page.getByLabel('Tahun KPI',{exact:true}).locator('option[value="2025"]')).toHaveCount(0);
 await page.getByRole('button',{name:'Tahunan',exact:true}).click();await expect(page.getByRole('heading',{name:'KPI Tahunan · 2026',exact:true})).toBeVisible();await expect(page.getByLabel('Bulan KPI',{exact:true})).toHaveCount(0);await expect(page.locator('.kpi-annual-table thead th')).toHaveCount(13);
 values['2026-06-01'][0].actual=98;revision++;await page.evaluate(()=>window.dispatchEvent(new Event('online')));await expect(page.locator('.kpi-annual-table tbody td').nth(5)).toContainText('98%');
 await page.getByLabel('Tahun KPI',{exact:true}).selectOption('2027');await expect(page.getByRole('heading',{name:'KPI Tahunan · 2027',exact:true})).toBeVisible();await expect(page.locator('.kpi-annual-table tbody')).not.toContainText('98%');await page.getByLabel('Tahun KPI',{exact:true}).selectOption('2026');await expect(page.locator('.kpi-annual-table tbody td').nth(5)).toContainText('98%');await page.getByRole('button',{name:'Buka bulan Juni',exact:true}).click();await expect(page.getByLabel('Bulan KPI',{exact:true})).toHaveValue('06');
 if(role==='team_leader'){const nav=page.locator('#sidebar-sections nav');const labels=await nav.getByRole('button').allTextContents();expect(labels.indexOf('KPI')).toBe(labels.indexOf('Kinerja & Beban Kerja')+1);await expect(page.getByRole('button',{name:'KPI',exact:true})).toHaveCount(1);await nav.getByRole('button',{name:'Kinerja & Beban Kerja',exact:true}).click();await expect(page.locator('.formal-kpi')).toHaveCount(0);await page.getByRole('button',{name:'KPI',exact:true}).click();await page.getByLabel('Bulan KPI',{exact:true}).selectOption('06');await page.getByLabel('Nama pegawai KPI',{exact:true}).selectOption('person-a');}
 if(role==='individual'){const nav=page.locator('#sidebar-sections nav');await expect(nav.getByRole('button')).toHaveText(['Ringkasan','Kinerja Saya','KPI','Data']);await expect(page.getByRole('button',{name:'KPI',exact:true})).toHaveCount(1);await nav.getByRole('button',{name:'Kinerja Saya',exact:true}).click();await expect(page.locator('.formal-kpi')).toHaveCount(0);await expect(page.locator('#sidebar-sections button[aria-current="page"]')).toHaveText('Kinerja Saya');await page.getByRole('button',{name:'KPI',exact:true}).click();await page.getByLabel('Bulan KPI',{exact:true}).selectOption('06');}
 if(role==='admin'){
  await page.getByLabel('Bulan KPI',{exact:true}).selectOption('02');await page.getByLabel('Realisasi SLA Adherence',{exact:true}).fill('0');await page.getByRole('button',{name:'Simpan target & realisasi',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Target dan realisasi berhasil disimpan.'})).toBeVisible();await expect(page.getByLabel('Target SLA Adherence',{exact:true})).toHaveValue('');await expect(page.locator('.kpi-score-table')).toContainText('Target belum diisi');
  await page.getByRole('button',{name:'Pemetaan pegawai',exact:true}).click();await page.getByLabel('Akun pegawai',{exact:true}).selectOption(user.id);await page.getByRole('button',{name:'Simpan pemetaan KPI',exact:true}).click();await expect(page.getByRole('heading',{name:'Pemetaan pegawai KPI',exact:true})).toHaveCount(0);
 }
 await page.getByLabel('Bulan KPI',{exact:true}).selectOption('06');
 await mkdir('private/kpi-report-qa',{recursive:true});
 // Export must re-read the server, even when the displayed value is older.
 values['2026-06-01'][0].actual=99;
 for(const mode of ['Bulanan','Tahunan']){
  await page.getByRole('button',{name:mode,exact:true}).click();
  for(const format of ['Word','Excel','PPT']){
   const ready=page.waitForEvent('download');await page.getByRole('button',{name:'Unduh '+format+' KPI',exact:true}).click();const download=await ready;
   const path=`private/kpi-report-qa/${role}-${mode}.${format==='Word'?'docx':format==='PPT'?'pptx':'xlsx'}`;await download.saveAs(path);const bytes=await readFile(path);
   if(format==='Word'){const zip=await JSZip.loadAsync(bytes);const xml=await zip.file('word/document.xml')!.async('string');expect(xml).toContain('Person A');expect(xml).not.toContain('Person B');expect(xml).toContain('99%');expect(xml).not.toContain('w:drawing');if(mode==='Tahunan'){expect(xml).toContain('Semester 1');expect(xml).toContain('Semester 2');}}
   else if(format==='PPT'){const zip=await JSZip.loadAsync(bytes);const xml=(await Promise.all(Object.keys(zip.files).filter(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n)).map(n=>zip.file(n)!.async('string')))).join('');expect(xml).toContain('Person A');expect(xml).not.toContain('Person B');expect(xml).toContain('99%');if(mode==='Tahunan'){expect(xml).toContain('Semester 1');expect(xml).toContain('Semester 2');}}
   else{const wb=XLSX.read(bytes,{type:'buffer'});expect(wb.SheetNames.length).toBeGreaterThan(1);const text=wb.SheetNames.map(name=>XLSX.utils.sheet_to_csv(wb.Sheets[name])).join('\n');expect(text).toContain('Person A');expect(text).not.toContain('Person B');expect(text).toContain('99');expect(wb.Sheets[wb.SheetNames[1]].A1.v).toBe('Person A');}
  }
 }
 await page.getByRole('button',{name:'Bulanan',exact:true}).click();
 if(role==='department_head'){
  await page.getByLabel('Nama pegawai KPI',{exact:true}).selectOption('');const ready=page.waitForEvent('download');await page.getByRole('button',{name:'Unduh Word KPI',exact:true}).click();const file=await ready;await file.saveAs('private/kpi-report-qa/multi-person.docx');const zip=await JSZip.loadAsync(await readFile('private/kpi-report-qa/multi-person.docx'));const xml=await zip.file('word/document.xml')!.async('string');expect(xml).toContain('Person B');expect(xml.match(/<w:sectPr>/g)?.length).toBe(3);for(const mode of ['Bulanan','Tahunan']){
   await page.getByRole('button',{name:mode,exact:true}).click();const wait=page.waitForEvent('download');await page.getByRole('button',{name:'Unduh PPT KPI',exact:true}).click();const ppt=await wait;const path='private/kpi-report-qa/all-'+mode+'.pptx';await ppt.saveAs(path);const archive=await JSZip.loadAsync(await readFile(path));const slides=Object.keys(archive.files).filter(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n));expect(slides.length).toBeLessThanOrEqual(6);const text=(await Promise.all(slides.map(n=>archive.file(n)!.async('string')))).join('');expect(text).toContain('Person A');expect(text).toContain('Person B');expect(text).toContain('Rekap per Indikator');expect(text).not.toContain('Rincian KPI Perorangan');const cover=await archive.file('ppt/slides/slide1.xml')!.async('string');expect(Number(cover.match(/<p:pic>[\s\S]*?<a:ext cx="(\d+)"/)?.[1])/914400).toBeCloseTo(13.333,2);expect(cover).toContain('Ringkasan Seluruh Anggota');if(mode==='Tahunan')expect(text).toContain('Tren Bulanan');
  }
  await page.getByRole('button',{name:'Bulanan',exact:true}).click();await page.getByLabel('Nama pegawai KPI',{exact:true}).selectOption('person-a');
 }
 await page.locator('.kpi-perspective').first().scrollIntoViewIfNeeded();await page.screenshot({path:`private/kpi-${role}.png`,fullPage:false});
 if(role==='individual'){await page.setViewportSize({width:390,height:844});await expect(page.locator('.kpi-toolbar')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:'private/kpi-mobile.png',fullPage:true});}
});
