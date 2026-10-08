import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const folder='private/pending-qa';
test.beforeEach(async({page})=>{await page.goto('/');await page.getByRole('button',{name:'Buka preview lokal'}).click();});

test('IJR status cards cover all source statuses and region charts share the same population',async({page})=>{
 const data=await (await page.request.get('/__local-data/ijr')).json();
 const statuses=[...new Set(data.map((r:any)=>String(r.Status||'').trim()).filter(Boolean))] as string[];
 await expect(page.locator('.kpis .kpi')).toHaveCount(statuses.length+1);
 for(const name of statuses){const card=page.locator('.kpis .kpi').filter({has:page.locator('small').filter({hasText:new RegExp('^'+name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$')})});await expect(card).toHaveCount(1);}
 const waiting=page.locator('.kpis .kpi').filter({has:page.locator('small').filter({hasText:'Waiting for Approval'})});
 await waiting.click();await expect(page.locator('.inline-drill-detail')).toHaveCount(1);
 await page.getByRole('button',{name:'Reset Filter',exact:true}).click();
 await page.locator('.kpis .kpi').first().click();await expect(page.locator('.inline-drill-detail .records')).toHaveCount(1);
 await page.getByRole('button',{name:'Wilayah',exact:true}).click();
 const panel=page.locator('.panel').filter({has:page.getByRole('heading',{name:'Data per Wilayah',exact:true})});
 const region=await panel.locator('.bar-row').first().getAttribute('title');await panel.locator('.bar-row').first().click();
 const scoped=data.filter((r:any)=>String(r.Wilayah||'').trim()===region);
 for(const [heading,key] of [['Cabang Terbanyak','Cabang'],['Unit Pembuka Terbanyak','Unit Pembuka']]){
  const chart=page.locator('.panel').filter({has:page.getByRole('heading',{name:heading,exact:true})});
  for(const row of await chart.locator('.bar-row').all()){
   const label=await row.getAttribute('title'),n=Number((await row.locator('b').innerText()).replace(/\D/g,''));
   expect(n).toBe(scoped.filter((r:any)=>String(r[key]||'').trim()===label).length);
  }
 }
});

test('Regional combined bars open correct adjacent jobs and remain usable on mobile',async({page})=>{
 await mkdir(folder,{recursive:true});await page.getByRole('button',{name:'Regional - Non BNIDirect',exact:true}).click();await page.getByRole('button',{name:'Wilayah',exact:true}).click();
 const rows=page.locator('.region-activity-row');await expect(rows.first()).toBeVisible();
 for(const category of ['volume','completed']){
  const button=rows.first().locator('.'+category),count=Number((await button.locator('b').innerText()).replace(/\D/g,''));await button.click();
  await expect(page.locator('.inline-drill-detail')).toHaveCount(1);
  await expect(page.locator('.inline-drill-detail .table-heading small')).toContainText(count.toLocaleString());
  if(category==='completed')for(const row of await page.locator('.inline-drill-detail tbody tr').all())await expect(row).toContainText('Done');
  expect(await page.locator('.inline-drill-detail').evaluate(el=>el.previousElementSibling?.getAttribute('data-drill-anchor'))).toBe('Volume dan Selesai per Wilayah');
 }
 await page.screenshot({path:folder+'/regional-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
 await page.screenshot({path:folder+'/regional-mobile.png',fullPage:true});
});

test('Corporate person metrics exclude missing duration and shared menus respect role props',async({page})=>{
 await page.evaluate(async()=>{
  const React=(await import('/node_modules/.vite/deps/react.js' as string)).default,client=await import('/node_modules/.vite/deps/react-dom_client.js' as string),createRoot=client.createRoot||client.default.createRoot;
  const {default:Dashboard}=await import('/src/components/Dashboard.tsx' as string),{LanguageProvider}=await import('/src/lib/language.tsx' as string);
  document.body.innerHTML='<div class="app-shell"><aside id="sidebar-sections"></aside><main id="qa-root" class="main"></main></div>';
  const root=createRoot(document.getElementById('qa-root'));
  const rows=[{id:'1',payload:{implementor:'PIC A',status:'Done',noreg:'1',company:'Company',product:'BNIDirect'},sla:{status:'Within SLA',target:3,real:0,over:0,solution:'BNIDirect'}},{id:'2',payload:{implementor:'PIC A',status:'Done',noreg:'2'},sla:{status:'Overdue',target:3,real:4,over:1,solution:'BNIDirect'}},{id:'3',payload:{implementor:'PIC A',status:'Done',noreg:'3'},sla:{status:'SLA Real Unavailable',target:3,real:null,over:null,solution:'BNIDirect'}}];
  (window as any).mountRole=(role:string)=>root.render(React.createElement(LanguageProvider,null,React.createElement(Dashboard,{key:role,kind:'corporate',rows,rules:[],individual:role==='individual',sidebarNavigation:role==='team_leader',personNames:role==='individual'?['PIC A']:undefined,canReport:role!=='individual',canEdit:false,onApply:async()=>{},onRestore:async()=>{},onDone:async()=>{},onSaveRule:async()=>{},onDeleteRule:async()=>{}})));
 });
 for(const role of ['department_head','team_leader','individual']){
  await page.evaluate(role=>(window as any).mountRole(role),role);
  await expect(page.getByRole('button',{name:'Report',exact:true})).toHaveCount(role==='individual'?0:1);
  await page.getByRole('button',{name:role==='individual'?'Kinerja Saya':'Kinerja & Beban Kerja',exact:true}).click();
  if(role!=='individual')await page.locator('.person-row').click();
  const metrics=page.locator('.person-metrics');await expect(metrics).toContainText('Rata-rata Hari Kerja: 2.0');await expect(metrics).toContainText('Pencapaian SLA: 50.0%');
 }
 await page.screenshot({path:folder+'/corporate-metrics.png',fullPage:true});
});

test('Piloting Reject diagnostics, SLA card hints and project closure remain distinct',async({page})=>{
 await page.getByRole('button',{name:'Corporate - Piloting',exact:true}).click();
 const close=page.locator('.project-close-bar');await expect(close).toContainText('Persentase proyek ditutup');await expect(close).toContainText('Bukan persentase pencapaian SLA');await expect(close).toContainText('Belum Close: 4');
 const colors=await page.locator('.project-close-track i').evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).backgroundColor));expect(colors[0]).not.toBe(colors[1]);
 const coverage=page.locator('.sla-coverage');await coverage.locator('.coverage-counts button').nth(2).click();
 const reject=coverage.locator('.bar-row').filter({hasText:'Reject/Retur — tidak termasuk penilaian SLA'});await expect(reject.locator('b')).toHaveText('15');await reject.click();await expect(coverage.locator('.table-heading small')).toContainText('15');
 await expect(coverage.locator('tbody tr').first()).toContainText('Reject/Retur');await page.screenshot({path:folder+'/piloting-reject.png',fullPage:true});
 await page.getByRole('button',{name:'Kinerja & Beban Kerja',exact:true}).click();
 const cards=page.locator('.pilot-cards .kpi');await expect(cards).toHaveCount(5);const hints=await cards.locator('span').allTextContents();expect(new Set(hints).size).toBe(5);
 await cards.first().click();await expect(page.locator('.inline-drill-detail')).toHaveCount(1);expect(await page.locator('.inline-drill-detail').evaluate(el=>el.previousElementSibling?.getAttribute('data-drill-anchor'))).toBe('pilot-sla-cards');
});

test('revised reports export product panels, discrepancy tables and monthly region comparisons',async({page})=>{
 test.setTimeout(120000);await mkdir(folder,{recursive:true});
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.evaluate(async()=>{
  const {generatePilotReport}=await import('/src/piloting/reports.ts' as string),{pilotSla}=await import('/src/piloting/sla.ts' as string),{initialFilters}=await import('/src/piloting/model.ts' as string);
  const raw=await (await fetch('/__local-data/piloting')).json(),rows=raw.map((payload:any,i:number)=>({id:String(i),payload,sla:pilotSla(payload)}));
  const save=async(file:any)=>{const a=document.createElement('a');a.href=URL.createObjectURL(file.blob);a.download=file.name;a.click();};
  (window as any).exportPilot=async(format:any)=>save(await generatePilotReport(rows,'',format,['products','segments','discrepancy'],initialFilters,false));
  const {generateReport}=await import('/src/domain/reports.ts' as string),{calculateSla}=await import('/src/domain/sla.ts' as string);
  const reg=Array.from({length:18},(_,i)=>Array.from({length:7},(_,j)=>{const payload={region:'W'+String(i+1).padStart(2,'0'),company:'Company',type:i%2?'Maintenance':'New',product:'BNIDirect',salesDate:`2026-${String(j+1).padStart(2,'0')}-15`,implementor:'PIC',status:'Done'};return {id:`${i}-${j}`,payload,sla:calculateSla(payload,'regional')};})).flat();
  (window as any).exportRegional=async(format:any)=>save(await generateReport(reg,'regional',['Wilayah'],format,{},false));
 });
 for(const dataset of ['Pilot','Regional'])for(const format of ['pptx','docx']){
  const download=page.waitForEvent('download');await page.evaluate(async({dataset,format})=>(window as any)['export'+dataset](format),{dataset,format});await (await download).saveAs(`${folder}/${dataset}.${format}`);
 }
 expect(errors).toEqual([]);
});
