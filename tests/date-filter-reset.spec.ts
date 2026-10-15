import {test,expect} from '@playwright/test';
const datasets=[['ijr','IJR - BNIdirect'],['regional','Regional - Non BNIDirect'],['corporate','Corporate - Non Piloting'],['piloting','Corporate - Piloting']];
for(const [kind,title] of datasets)test(`${title}: date, monthly and reset refresh the displayed data`,async({page})=>{
 const fixture=(date:string|null,index:number)=>kind==='ijr'?{'Application Number':'QA-'+index,'Applicant Name':'QA','Application Type':'Maintenance','Request Date':date,Status:'Dalam Proses'}:kind==='piloting'?{'No. Register':'QA-'+index,'Nama Perusahaan':'QA','PIC AT':'QA','Jenis Produk / Solusi':'BNIdirect','Tanggal Assign to AT':date,Kategori:'Done'}:{noreg:'QA-'+index,company:'QA',product:'BNIdirect',status:'Done',...(kind==='corporate'?{submitDate:date}:{salesDate:date})};
 await page.route(`**/__local-data/${kind}`,route=>route.fulfill({json:[fixture('2026-08-31',1),fixture('2026-09-01',2),fixture(null,3)]}));
 await page.goto('/');await page.getByRole('button',{name:'Buka preview lokal'}).click();await page.locator('.profile-button').click();await page.getByLabel('Bahasa / Language').selectOption('en');await page.keyboard.press('Escape');await page.getByRole('button',{name:title,exact:true}).click();
 const total=page.locator('.kpi').first();await expect(total).toContainText('3');
 await page.locator('.period-trigger').first().click();let dialog=page.locator('.period-popover');await dialog.getByLabel('Custom Dates',{exact:true}).check();await dialog.getByLabel('Start Date',{exact:true}).fill('2026-08-31');await dialog.getByLabel('End Date',{exact:true}).fill('2026-08-31');await dialog.getByRole('button',{name:'Apply',exact:true}).click();await expect(total).toContainText('1');
 await page.getByRole('button',{name:'Reset Filters',exact:true}).click();await expect(total).toContainText('3');await expect(page.locator('.period-trigger').first()).toContainText('All Period');
 await page.locator('.period-trigger').first().click();dialog=page.locator('.period-popover');await dialog.getByLabel('Monthly',{exact:true}).check();await dialog.locator('input[type=month]').fill('2026-09');await dialog.getByRole('button',{name:'Apply',exact:true}).click();await expect(total).toContainText('1');
 if(kind!=='piloting'){await page.locator('.chips button').filter({hasText:'2026-09'}).first().click();await expect(total).toContainText('3');await expect(page.locator('.chips')).toHaveCount(0);}
 else{await page.getByRole('button',{name:'Reset Filters',exact:true}).click();await expect(total).toContainText('3');}
 await page.locator('.period-trigger').first().click();await expect(page.locator('.period-popover').getByLabel('All Period',{exact:true})).toBeChecked();
});
