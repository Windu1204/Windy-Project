import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{await page.goto('/');await page.getByRole('button',{name:'Buka preview lokal'}).click();});
for(const [kind,name] of [['regional','Regional - Non BNIDirect'],['ijr','IJR - BNIdirect']] as const){
 test(kind+' overview retains chart populations and opens matching selected details',async({page})=>{
  await page.getByRole('button',{name,exact:true}).click();
  if(kind==='regional')await page.getByRole('combobox',{name:'Wilayah',exact:true}).selectOption('W10');
  const charts=page.locator('.grid-three').first().locator(':scope > section[data-drill-anchor]'),before=await charts.allTextContents();
  const statusChart=charts.first(),legend=statusChart.locator('.legend button').first(),n=Number((await legend.locator('b').innerText()).split(' ')[0].replace(/\D/g,''));
  await legend.click();await expect(legend).toHaveAttribute('aria-pressed','true');expect(await charts.allTextContents()).toEqual(before);
  await expect(page.locator('.inline-drill-detail .table-heading small')).toContainText(n.toLocaleString());
  if(kind==='regional'){
   await expect(statusChart.locator('.donut strong')).toHaveText('171');await expect(charts.nth(1).locator('.donut strong')).toHaveText('171');
   const blank=statusChart.locator('.legend button').filter({hasText:'Belum diisi'});await expect(blank.locator('b')).toContainText('12');await blank.click();await expect(page.locator('.inline-drill-detail .table-heading small')).toContainText('12');
   await page.getByRole('button',{name:'Reset Filter',exact:true}).click();await page.getByRole('button',{name:'Proses Implementasi',exact:true}).click();await expect(page.getByRole('heading',{name:'Ketersediaan Milestone'})).toHaveCount(0);
  }
 });
 test(kind+' paired region charts and quick detail filters keep totals and selection',async({page})=>{
  await page.getByRole('button',{name,exact:true}).click();await page.getByRole('button',{name:'Wilayah',exact:true}).click();
  const groups=page.locator('.region-activity-row'),button=groups.first().locator('.volume'),region=await groups.first().locator('strong').innerText();
  if(kind==='regional')expect(await groups.locator('strong').allTextContents()).not.toContain('0');
  const count=Number((await button.locator('b').innerText()).replace(/\D/g,'')),groupCount=await groups.count();await button.click();await expect(button).toHaveAttribute('aria-pressed','true');expect(await groups.count()).toBe(groupCount);
  await expect(page.locator('.region-detail .table-heading small')).toContainText(count.toLocaleString());
  for(const filter of await page.locator('.region-detail-filters button').all()){
   const n=Number((await filter.locator('b').innerText()).replace(/\D/g,''));await filter.click();await expect(filter).toHaveAttribute('aria-pressed','true');await expect(page.locator('.region-detail .table-heading small')).toContainText(n.toLocaleString());
   for(const cell of await page.locator('.region-detail tbody tr').all())await expect(cell).toContainText(region);
  }
  await groups.first().locator('.completed').click();const done=Number((await groups.first().locator('.completed b').innerText()).replace(/\D/g,''));await expect(page.locator('.region-detail .table-heading small')).toContainText(done.toLocaleString());
 });
}
test('login uses one logo and a proportional illustration on desktop and mobile',async({page})=>{
 await page.goto('/');await expect(page.locator('.login-brand')).toHaveCount(1);
 expect(await page.locator('.login-hero').evaluate(el=>getComputedStyle(el).backgroundSize)).toBe('contain');
 expect(await page.locator('.login-hero').evaluate(el=>getComputedStyle(el).backgroundImage)).toContain('login-monitor-v2.png');
 await page.screenshot({path:'private/pending-qa/login-v2-desktop.png'});await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('Department Head and Team Leader region menus expose only their supplied data',async({page})=>{
 await page.evaluate(async()=>{
  const React=(await import('/node_modules/.vite/deps/react.js' as string)).default,client=await import('/node_modules/.vite/deps/react-dom_client.js' as string),createRoot=client.createRoot||client.default.createRoot;
  const {default:Dashboard}=await import('/src/components/Dashboard.tsx' as string),{LanguageProvider}=await import('/src/lib/language.tsx' as string);
  document.body.innerHTML='<div id="qa-root"></div><div id="sidebar-sections"></div>';
  const root=createRoot(document.getElementById('qa-root'));
  const rows=[{id:'a',payload:{company:'Team A Company',region:'W10',status:'Done',implementor:'PIC A'},sla:{status:'Within SLA',real:1,target:2}},{id:'b',payload:{company:'Team B Company',region:'W14',status:'In progress',implementor:'PIC B'},sla:{status:'SLA Real Unavailable',real:null,target:2}}];
  (window as any).mountRegionRole=(role:string)=>root.render(React.createElement(LanguageProvider,null,React.createElement(Dashboard,{key:role,kind:'regional',rows:role==='team_leader'?rows.slice(0,1):rows,rules:[],sidebarNavigation:role==='team_leader',canReport:true,canEdit:false,onApply:async()=>{},onRestore:async()=>{},onDone:async()=>{},onSaveRule:async()=>{},onDeleteRule:async()=>{}})));
 });
 for(const role of ['department_head','team_leader']){
  await page.evaluate(role=>(window as any).mountRegionRole(role),role);await page.getByRole('button',{name:'Wilayah',exact:true}).click();
  await expect(page.locator('.region-activity-row')).toHaveCount(role==='team_leader'?1:2);await page.locator('.region-activity-row').first().locator('.volume').click();await expect(page.locator('.region-detail-filters')).toBeVisible();await expect(page.locator('.region-detail')).toContainText('Team A Company');await expect(page.locator('.region-detail')).not.toContainText('Team B Company');
 }
});
