import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { calculateSla } from '../src/domain/sla';
import { metrics, isDone } from '../src/domain/analytics';
import { text, type DatasetKind, type Payload } from '../src/types';
test.beforeEach(async ({ page }) => { await page.goto('/'); await page.getByRole('button', { name: 'Buka preview lokal' }).click(); await expect(page.locator('.kpi').first()).toContainText('1,000'); });
test('shared navigation, stage durations, merged KPI and exact category drilldowns', async ({ page }) => {
 const errors: string[]=[]; page.on('pageerror',error=>errors.push(error.message));
 for(const kind of ['ijr','regional'] as DatasetKind[]) {
  await page.getByRole('button',{name:kind==='ijr'?'IJR - BNIdirect':'Regional - Non BNIDirect',exact:true}).click();
  await expect(page.locator('.tabs button')).toHaveText(['Ringkasan','Proses Implementasi','Wilayah','Kinerja & Beban Kerja','Report','Data']);
  await page.getByRole('button',{name:'Proses Implementasi',exact:true}).click();
  if(kind==='ijr') {
   await expect(page.getByRole('heading',{name:'Durasi Penyelesaian',exact:true})).toHaveCount(0);
   await expect(page.getByRole('heading',{name:'Waktu Proses di Cabang',exact:true})).toBeVisible();
   await expect(page.getByRole('heading',{name:'Waktu Proses di TBS',exact:true})).toBeVisible();
   await expect(page.locator('.duration-card').first().locator('strong')).toHaveText(['777','198','25','0']);
   await expect(page.locator('.duration-card').nth(1).locator('strong')).toHaveText(['724','248','28','0']);
   await page.locator('.duration-card button').first().click();
   await expect(page.locator('.records')).toContainText('777');
  } else await expect(page.getByRole('heading',{name:'Kelengkapan Milestone'})).toBeVisible();
  await page.getByRole('button',{name:'Kinerja & Beban Kerja',exact:true}).click();
  const panel=page.locator('.person-work');await expect(panel).toHaveCount(1);await expect(panel.getByRole('searchbox')).toHaveCount(1);
  const name=(await panel.locator('.person-row b').first().innerText()).trim();await panel.getByRole('searchbox').fill(name.toLowerCase());await panel.locator('.person-row').first().click();
  const payload=await (await page.request.get('/__local-data/'+kind)).json() as Payload[];
  const records=payload.filter(p=>(kind==='ijr'?['Implementor 1','Implementor 2']:['implementor']).some(key=>text(p[key])===name)).map((p,i)=>({id:String(i),payload:p,sla:calculateSla(p,kind,[])}));
  const categories=[records,records.filter(r=>!isDone(r,kind)),records.filter(r=>isDone(r,kind))];
  for(let i=0;i<3;i++){await expect(panel.locator('.person-kpis button').nth(i).locator('b')).toHaveText(categories[i].length.toLocaleString());await panel.locator('.person-kpis button').nth(i).click();await expect(panel.locator('tbody tr')).toHaveCount(Math.min(10,categories[i].length));if(categories[i].length){await panel.locator('tbody tr').first().click();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('button',{name:'Tutup detail',exact:true}).click();}}
  await panel.getByRole('searchbox').fill('no-match-xyz');await expect(panel.locator('.person-row')).toHaveCount(0);
 }
 expect(errors).toEqual([]);
});
test('account popover language persists and preserves dashboard data',async({page})=>{
 await page.locator('.profile-button').click();const picker=page.getByLabel('Bahasa / Language');await expect(picker).toHaveValue('id');const nameBox=await page.locator('.profile-button').boundingBox(),languageBox=await picker.boundingBox();expect(languageBox!.y).toBeGreaterThan(nameBox!.y);await page.keyboard.press('Escape');await page.getByRole('button',{name:'Kinerja & Beban Kerja',exact:true}).click();const values=await page.locator('.workload-kpi tbody tr').first().locator('td').allTextContents();await page.locator('.profile-button').click();await picker.selectOption('en');await page.keyboard.press('Escape');await expect(page.locator('.tabs button')).toHaveText(['Overview','Implementation Process','Region','Performance & Workload','Report','Data']);await expect(page.locator('.workload-kpi tbody tr').first().locator('td')).toHaveText(values.map(v=>v.replace(' hari',' days')));await page.reload();await page.getByRole('button',{name:'Buka preview lokal'}).click();await page.locator('.profile-button').click();await expect(picker).toHaveValue('en');await page.keyboard.press('Escape');await page.getByRole('button',{name:'Corporate - Non Piloting',exact:true}).click();await expect(page.locator('.kpi').first()).toContainText('4,509');await expect(page.locator('.tabs')).toContainText('Performance & Workload');
});
test('all tabs in both languages fit desktop and phone; reports still export',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 for(const width of [1280,390])for(const language of ['id','en'])for(const dashboard of ['IJR - BNIdirect','Regional - Non BNIDirect','Corporate - Non Piloting']) {
  await page.setViewportSize({width,height:844});await page.locator('.profile-button').click();await page.getByLabel('Bahasa / Language').selectOption(language);await page.keyboard.press('Escape');await page.getByRole('button',{name:dashboard,exact:true}).click();
  for(const tab of await page.locator('.tabs button').allTextContents()) {await page.locator('.tabs').getByRole('button',{name:tab,exact:true}).click(); const widths=await page.evaluate(()=>({page:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,main:document.querySelector('.main')!.clientWidth,mainScroll:document.querySelector('.main')!.scrollWidth}));expect(widths.scroll).toBeLessThanOrEqual(widths.page+2);expect(widths.mainScroll).toBeLessThanOrEqual(widths.main+2);}
 }
 await page.setViewportSize({width:1440,height:1000});await page.locator('.profile-button').click();await page.getByLabel('Bahasa / Language').selectOption('en');await page.keyboard.press('Escape');await page.getByRole('button',{name:'IJR - BNIdirect',exact:true}).click();await page.getByRole('button',{name:'Report',exact:true}).click();
 for(const format of ['Word (.docx)','PowerPoint (.pptx)']){await page.getByLabel('Report Format',{exact:true}).selectOption(format.startsWith('Word')?'docx':'pptx');const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Generate Report',exact:true}).click();const download=await pending;expect((await readFile((await download.path())!)).subarray(0,2).toString()).toBe('PK');}
 await page.getByRole('button',{name:'Performance & Workload',exact:true}).click();await page.screenshot({path:'private/merged-kpi-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:'private/merged-kpi-mobile.png',fullPage:true});expect(errors).toEqual([]);
});
