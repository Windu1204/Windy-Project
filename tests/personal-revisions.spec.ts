import {test,expect} from '@playwright/test';

test('Corporate detail is adjacent to its selected card or chart, with one active detail',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Buka preview lokal'}).click();
 for(const dashboard of ['Corporate - Non Piloting','Corporate - Piloting']){
  await page.getByRole('button',{name:dashboard,exact:true}).click();await page.getByRole('button',{name:'Proses Implementasi',exact:true}).click();
  await expect(page.locator('.inline-drill-detail')).toHaveCount(0);
  await page.locator('.process-summary button').nth(1).click();
  await expect(page.locator('.inline-drill-detail .process-people')).toBeVisible();
  expect(await page.locator('.inline-drill-detail').evaluate(el=>el.previousElementSibling?.getAttribute('data-drill-anchor'))).toBe('process-summary');
  for(const title of ['Durasi Implementasi','Volume by Segment','Jenis Pekerjaan','Top Products','Pekerjaan Pending']){
   const panel=page.locator('.corporate-process > .panel, .corporate-process > .grid-two > .panel').filter({has:page.getByRole('heading',{name:title,exact:true})});
   const button=panel.locator(title==='Durasi Implementasi'?'.duration-grid button':'.bar-row').first();if(!await button.count())continue;
   await button.click();await expect(page.locator('.inline-drill-detail')).toHaveCount(1);
   expect(await page.locator('.inline-drill-detail').evaluate(el=>el.previousElementSibling?.getAttribute('data-drill-anchor'))).toBe(title);
  }
 }
});

test('Regional status and milestone selections show adjacent details without duplicate distribution',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Buka preview lokal'}).click();await page.getByRole('button',{name:'Regional - Non BNIDirect',exact:true}).click();await page.getByRole('button',{name:'Proses Implementasi',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Distribusi Status',exact:true})).toHaveCount(0);
 await page.locator('.kpis button').filter({hasText:'Pending Doc'}).click();
 await expect(page.locator('.inline-drill-detail tbody tr').first()).toBeVisible();
 expect(await page.locator('.inline-drill-detail').evaluate(el=>el.previousElementSibling?.getAttribute('data-drill-anchor'))).toBe('summary');
 await page.getByRole('button',{name:'Reset Filter',exact:true}).click();
 const milestone=page.locator('.panel').filter({has:page.getByRole('heading',{name:'Kelengkapan Milestone',exact:true})});
 await milestone.locator('.bar-row').first().click();await expect(page.locator('.inline-drill-detail tbody tr').first()).toBeVisible();
 expect(await page.locator('.inline-drill-detail').evaluate(el=>el.previousElementSibling?.getAttribute('data-drill-anchor'))).toBe('Kelengkapan Milestone');
});

test('Theme choices preserve layout and semantic colors, persist per account, and credit stays regular gray',async({page})=>{
 await page.goto('/');await expect(page.locator('.login-foot')).toHaveText('© Internal Application by Windy Olivia');
 expect(await page.locator('.login-foot').evaluate(el=>getComputedStyle(el).fontWeight)).toBe('400');
 await page.getByRole('button',{name:'Buka preview lokal'}).click();
 const footer=page.locator('.sidebar .foot');await expect(footer).toHaveText('© Internal Application by Windy Olivia');
 expect(await footer.evaluate(el=>({weight:getComputedStyle(el).fontWeight,wrap:getComputedStyle(el).whiteSpace,fits:el.scrollWidth<=el.clientWidth}))).toEqual({weight:'400',wrap:'nowrap',fits:true});
 expect(await footer.evaluate(el=>window.innerHeight-el.getBoundingClientRect().bottom)).toBeLessThan(30);
 const existing=await page.locator('.topbar').evaluate(el=>getComputedStyle(el).backgroundImage);
 const semantic=await page.locator('.kpi').nth(1).evaluate(el=>getComputedStyle(el).borderLeftColor);
 await page.getByRole('button',{name:'Akun pengguna',exact:true}).click();
 for(const theme of ['blue','pink','gray','yellow','tosca']){
  await page.getByRole('combobox',{name:'Warna Tema',exact:true}).selectOption(theme);await expect(page.locator('.theme-root')).toHaveAttribute('data-theme',theme);
  expect(await page.locator('.kpi').nth(1).evaluate(el=>getComputedStyle(el).borderLeftColor)).toBe(semantic);
 }
 expect(await page.locator('.topbar').evaluate(el=>getComputedStyle(el).backgroundImage)).toBe(existing);
 await page.getByRole('combobox',{name:'Warna Tema',exact:true}).selectOption('pink');await expect(page.locator('.nav.active')).toHaveCSS('background-color','rgb(245, 185, 203)');await page.reload();await page.getByRole('button',{name:'Buka preview lokal'}).click();await expect(page.locator('.theme-root')).toHaveAttribute('data-theme','pink');
 expect(await page.evaluate(()=>localStorage.getItem('wci-theme:local-preview'))).toBe('pink');expect(await page.evaluate(()=>localStorage.getItem('wci-theme:another-user'))).toBeNull();
});

test('View-as picker filters active users by role and includes dashboard and team context',async({page})=>{
 await page.goto('/');await page.evaluate(async()=>{
  const React=(await import('/node_modules/.vite/deps/react.js' as string)).default,client=await import('/node_modules/.vite/deps/react-dom_client.js' as string);
  const {ViewAsPicker}=await import('/src/components/ViewAsPicker.tsx' as string),{LanguageProvider}=await import('/src/lib/language.tsx' as string);
  const host=document.getElementById('root')!;host.innerHTML='';
  const directory={profiles:[{user_id:'tl',name:'TL Regional',role:'team_leader',active:true},{user_id:'user',name:'Pengguna Regional',role:'individual',active:true},{user_id:'inactive',name:'Nonaktif',role:'individual',active:false}],grants:[{user_id:'tl',dataset:'regional',source:'AT',team_id:'team'},{user_id:'user',dataset:'regional',source:'AT',pic:'PIC Uji'}],teams:[{id:'team',name:'Tim Regional'}],people:[],batches:[],audit:[]};
  (window as any).selectedProfile=null;
  (client.createRoot||client.default.createRoot)(host).render(React.createElement(LanguageProvider,null,React.createElement(ViewAsPicker,{directory,onSelect:(p:any)=>{(window as any).selectedProfile=p.user_id;}})));
 });
 const roles=page.getByRole('combobox',{name:'Pilih role untuk dilihat'}),users=page.getByRole('combobox',{name:'Pilih pengguna untuk dilihat'});
 await expect(users).toBeDisabled();await roles.selectOption('team_leader');await expect(users.locator('option')).toHaveCount(2);await expect(users).toContainText('Tim Regional');await expect(users).not.toContainText('Pengguna Regional');
 await roles.selectOption('individual');await expect(users.locator('option')).toHaveCount(2);await expect(users).not.toContainText('Nonaktif');await users.selectOption('user');expect(await page.evaluate(()=>(window as any).selectedProfile)).toBe('user');
});


