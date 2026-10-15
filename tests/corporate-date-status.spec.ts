import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
test('Corporate date statuses, request details and per-person Reject KPI stay consistent',async({page})=>{
 const base={product:'BNIdirect',projectType:'Maintenance',company:'QA',implementor:'Alex',assignDate:'2026-08-14',segment:'QA'};
 await page.route('**/__local-data/corporate',route=>route.fulfill({json:[
  {...base,noreg:'QA-PENDING',status:'Transactions Active',requestType:'Pending request'},
  {...base,noreg:'QA-PROGRESS',status:'Project Assignment',progressDate:'2026-08-15',requestType:'Progress request'},
  {...base,noreg:'QA-DONE',status:'Waiting Transactions Active',doneDate:'2026-08-18',requestType:'Completed request'},
  {...base,noreg:'QA-REJECT',status:'Rejected',doneDate:'2026-08-18',requestType:'Rejected request detail'},
  {...base,noreg:'QA-RETURN',status:'Returned',progressDate:'2026-08-15',requestType:'Returned request detail'},
  {...base,noreg:'QA-OTHER',status:'Reject',implementor:'Jamie',requestType:'Other person request'},
 ]}));
 await page.goto('/');await page.getByRole('button',{name:'Buka preview lokal'}).click();await page.locator('.profile-button').click();await page.getByLabel('Bahasa / Language').selectOption('en');await page.keyboard.press('Escape');await page.getByRole('button',{name:'Corporate - Non Piloting',exact:true}).click();
 const card=(name:string)=>page.locator('.kpis > button').filter({has:page.locator('small',{hasText:new RegExp('^'+name+'$')})});
 await expect(card('Done').locator('strong')).toHaveText('1');await expect(card('On Progress').locator('strong')).toHaveText('1');await expect(card('Pending Task').locator('strong')).toHaveText('1');await expect(card('Reject/Retur').locator('strong')).toHaveText('3');
 await page.getByRole('button',{name:'Performance & Workload',exact:true}).click();await page.locator('.person-row').filter({hasText:'Alex'}).click();
 const rejectCard=page.locator('.person-detail .person-kpis button').filter({hasText:'Reject/Retur'});await expect(rejectCard.locator('b')).toHaveText('2');await page.locator('.person-detail').screenshot({path:'private/corporate-date-status-kpi.png'});await rejectCard.click();await expect(page.locator('.person-detail tbody tr')).toHaveCount(2);await expect(page.locator('.person-detail tbody')).not.toContainText('QA-OTHER');
 await page.locator('.person-detail tbody tr').filter({hasText:'QA-REJECT'}).click();await expect(page.getByRole('dialog')).toBeVisible();await expect(page.locator('.detail-grid')).toContainText('Request Type');await expect(page.locator('.detail-grid')).toContainText('Rejected request detail');await expect(page.locator('.detail-grid')).toContainText('Reject/Retur');await page.getByRole('button',{name:'Close details',exact:true}).click();
 await page.getByRole('button',{name:'Data',exact:true}).click();await page.locator('tbody tr').filter({hasText:'QA-PENDING'}).getByRole('button',{name:'Details',exact:true}).click();await expect(page.locator('.detail-grid')).toContainText('Pending request');await expect(page.locator('.detail-grid')).toContainText('Pending Task');await page.getByRole('button',{name:'Close details',exact:true}).click();
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'CSV',exact:true}).click();const download=await pending;const csv=(await readFile((await download.path())!)).toString();expect(csv).toContain('Reject/Retur');expect(csv).not.toContain('Waiting Transactions Active');
});
