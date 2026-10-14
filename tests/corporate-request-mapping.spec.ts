import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
test('current Corporate rows use approved product mapping in dashboard data and downloads',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const base={assignDate:'2026-08-14',doneDate:'2026-08-18',status:'Done',projectType:'Maintenance',implementor:'QA',segment:'QA'};
 await page.route('**/__local-data/corporate',route=>route.fulfill({json:[
  {...base,noreg:'QA-BNI',company:'QA BNIdirect',requestType:'Penambahan_Rekening,'},
  {...base,noreg:'QA-VA',company:'QA VA',formType:'Maintenance VA Debet',requestType:'Tambah rekening dan user BNIdirect'},
  {...base,noreg:'QA-GENERIC',company:'QA Generic',formType:'Maintenance VA',requestType:'Ubah user'},
 ]}));
 await page.goto('/');await page.getByRole('button',{name:'Buka preview lokal'}).click();await page.locator('.profile-button').click();await page.getByLabel('Bahasa / Language').selectOption('en');await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Corporate - Non Piloting',exact:true}).click();await expect(page.locator('.kpi').first()).toContainText('3');
 await page.getByRole('button',{name:'Data',exact:true}).click();await expect(page.locator('tbody')).toContainText('BNIdirect');await expect(page.locator('tbody')).toContainText('VA Debit berkartu');await expect(page.locator('tbody')).toContainText('Virtual Account');
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'CSV',exact:true}).click();const csv=await pending;const body=(await readFile((await csv.path())!)).toString();expect(body).toContain('BNIdirect');expect(body).toContain('VA Debit berkartu');expect(body).toContain('Virtual Account');
 await page.getByRole('button',{name:'Report',exact:true}).click();await page.getByLabel('Report Format',{exact:true}).selectOption('pptx');const reportPending=page.waitForEvent('download');await page.getByRole('button',{name:'Generate Report'}).click();const report=await reportPending;expect((await readFile((await report.path())!)).subarray(0,2).toString()).toBe('PK');expect(errors).toEqual([]);
});
