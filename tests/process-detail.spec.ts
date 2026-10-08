import {test,expect} from '@playwright/test';

test('Corporate process charts drill through actual PIC names to full job details',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Buka preview lokal'}).click();
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 for(const dashboard of ['Corporate - Non Piloting','Corporate - Piloting']){
  await page.getByRole('button',{name:dashboard,exact:true}).click();
  await page.getByRole('button',{name:'Proses Implementasi',exact:true}).click();
  await expect(page.locator('.corporate-process').getByRole('heading',{name:'Status Implementasi',exact:true})).toHaveCount(0);
  const groups=page.locator('.process-summary button');
  const groupCount=await groups.count();
  for(let i=0;i<groupCount;i++){
   const expected=Number((await groups.nth(i).locator('b').innerText()).replace(/\D/g,''));
   await groups.nth(i).click();const drill=page.locator('.process-people');await expect(drill).toBeVisible();
   const counts=await drill.locator('.person-row strong').allTextContents();expect(counts.reduce((sum,n)=>sum+Number(n.replace(/\D/g,'')),0)).toEqual(expected);
   await drill.locator('.person-row').first().click();await expect(drill.locator('tbody tr').first()).toBeVisible();
   await drill.locator('tbody .text-button').first().click();await expect(page.locator('dialog[open]')).toBeVisible();
   await page.keyboard.press('Escape');
  }
  for(const title of ['Volume by Segment','Jenis Pekerjaan','Top Products','Pekerjaan Pending']){
   const panel=page.locator('.corporate-process .panel').filter({has:page.getByRole('heading',{name:title,exact:true})});
   const bars=panel.locator('.bar-row');if(!await bars.count())continue;
   const expected=Number((await bars.first().locator('b').innerText()).replace(/\D/g,''));
   await bars.first().click();const drill=page.locator('.process-people');await expect(drill).toBeVisible();
   const counts=await drill.locator('.person-row strong').allTextContents();expect(counts.reduce((sum,n)=>sum+Number(n.replace(/\D/g,'')),0)).toEqual(expected);
   await drill.locator('.person-row').first().click();await expect(drill.locator('tbody tr').first()).toBeVisible();
   await drill.locator('tbody .text-button').first().click();await expect(page.locator('dialog[open]')).toBeVisible();
   await page.keyboard.press('Escape');
  }
 }
 expect(errors).toEqual([]);
});

test('Regional My Performance exposes source milestone dates and no Done action',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Buka preview lokal'}).click();await page.getByRole('button',{name:'Regional - Non BNIDirect',exact:true}).click();
 await page.getByRole('button',{name:'Kinerja & Beban Kerja',exact:true}).click();const work=page.locator('.person-work');await work.locator('.person-row').first().click();
 for(const name of ['Email Sales','Dokumen Lengkap','Selesai Setting'])await expect(work.getByRole('columnheader',{name,exact:true})).toBeVisible();
 await expect(work.getByRole('button',{name:'Tandai Done',exact:true})).toHaveCount(0);
 await work.locator('tbody tr').first().click();const detail=page.getByRole('dialog');await expect(detail).toContainText('Tanggal Email Sales');await expect(detail).toContainText('Tanggal Dokumen Lengkap');await expect(detail).toContainText('Tanggal Selesai Setting');
});

test('SLA reason charts filter only excluded jobs and open their source details',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Buka preview lokal'}).click();await page.getByRole('button',{name:'Regional - Non BNIDirect',exact:true}).click();
 const coverage=page.locator('.sla-coverage');await coverage.locator('.coverage-counts button').nth(2).click();
 const reasons=coverage.locator('.sla-reasons .bar-row'),counts=await reasons.locator('b').allTextContents();expect(counts.reduce((n,s)=>n+Number(s.replace(/\D/g,'')),0)).toBe(Number((await coverage.locator('.coverage-counts button').nth(2).locator('strong').innerText()).replace(/\D/g,'')));
 const label=await reasons.first().locator('span').first().innerText(),count=Number(counts[0].replace(/\D/g,''));await reasons.first().click();
 await expect(coverage.locator('.table-heading small')).toContainText(count.toLocaleString());await expect(coverage.locator('tbody .sla-diagnostic-cell').first()).toContainText(label);
 await coverage.locator('tbody .text-button').first().click();await expect(page.getByRole('dialog')).toContainText(label);await page.keyboard.press('Escape');
 await coverage.getByRole('button',{name:'Semua penyebab',exact:true}).click();await expect(coverage.locator('.table-heading small')).toContainText(counts.reduce((n,s)=>n+Number(s.replace(/\D/g,'')),0).toLocaleString());
});

test('Regional task dates appear in centered Done confirmation without modifying the source',async({page})=>{
 await page.goto('/');
 await page.evaluate(async()=>{
  const React=(await import('/node_modules/.vite/deps/react.js' as string)).default;
  const client=await import('/node_modules/.vite/deps/react-dom_client.js' as string),createRoot=client.createRoot||client.default.createRoot;
  const {MyTasks}=await import('/src/components/MyTasks.tsx' as string);
  const {LanguageProvider}=await import('/src/lib/language.tsx' as string);
  const row={id:'regional-test',payload:{company:'Perusahaan Uji',cid:'10',product:'BNIDirect',implementor:'PIC Uji',status:'In progress',salesDate:'2026-09-21',docComplete:'2026-09-22',settingDone:'2026-09-24',approvalDate:'2026-09-22',customerInfo:'2026-09-25',training:'2026-09-28',handover:'2026-09-29'},sla:{target:5,real:6,status:'Overdue',solution:'BNIdirect',over:1}};
  const host=document.getElementById('root')!;host.innerHTML='';host.className='app-shell';
  (window as any).taskSource=JSON.stringify(row.payload);(window as any).taskSaves=[];
  createRoot(host).render(React.createElement(LanguageProvider,null,React.createElement(MyTasks,{rows:[row],canDone:true,onOpen:()=>{},onDone:async(r:any,note:string)=>{(window as any).taskSaves.push({payload:r.payload,note});}})));
 });
 for(const date of ['2026-09-21','2026-09-22','2026-09-24'])await expect(page.locator('tbody')).toContainText(date);
 await page.getByRole('button',{name:'Tandai Done',exact:true}).click();const dialog=page.getByRole('dialog');
 for(const date of ['2026-09-21','2026-09-22','2026-09-24','2026-09-25','2026-09-28','2026-09-29'])await expect(dialog).toContainText(date);
 const b=await dialog.boundingBox(),viewport=page.viewportSize()!;expect(Math.abs(b!.x+b!.width/2-viewport.width/2)).toBeLessThan(2);expect(b!.height).toBeLessThanOrEqual(viewport.height);
 await page.getByRole('button',{name:'Batal',exact:true}).click();expect(await page.evaluate(()=>(window as any).taskSaves.length)).toBe(0);
 await page.getByRole('button',{name:'Tandai Done',exact:true}).click();await page.getByRole('button',{name:'Konfirmasi Done',exact:true}).click();
 expect(await page.evaluate(()=>JSON.stringify((window as any).taskSaves[0].payload)===(window as any).taskSource)).toBe(true);
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Tandai Done',exact:true}).click();
 const mobile=await dialog.boundingBox();expect(mobile!.width).toBeLessThanOrEqual(390);expect(mobile!.height).toBeLessThanOrEqual(844);
});
