import {test,expect} from '@playwright/test';

test('absolute 15-minute login expires across refresh and activity, signing out only this device',async({page})=>{
 test.skip(process.env.WCI_CACHE_MOCK!=='1','Isolated Supabase fixture required');
 const start=Date.now(),user={id:'00000000-0000-4000-8000-000000000010',aud:'authenticated',role:'authenticated',email:'session@qa.invalid',last_sign_in_at:new Date(start).toISOString(),app_metadata:{},user_metadata:{}};
 const token=btoa(JSON.stringify({alg:'HS256'}))+'.'+btoa(JSON.stringify({sub:user.id,session_id:'00000000-0000-4000-8000-000000000020',iat:Math.floor(start/1000),exp:4102444800,role:'authenticated'}))+'.signature';
 let logoutScope='';
 await page.clock.install({time:start});
 await page.route('https://cache-test.supabase.co/**',async route=>{
  const url=new URL(route.request().url());let body:unknown=[];
  if(url.pathname.endsWith('/auth/v1/token'))body={access_token:token,refresh_token:'fixture',expires_in:3600,token_type:'bearer',user};
  else if(url.pathname.endsWith('/auth/v1/user'))body=user;
  else if(url.pathname.endsWith('/auth/v1/logout')){logoutScope=url.searchParams.get('scope')||'';return route.fulfill({status:204});}
  else if(url.pathname.endsWith('/wci_session_deadline'))body={expires_at:new Date(start+900000).toISOString(),server_now:new Date(await page.evaluate(()=>Date.now())).toISOString()};
  else if(url.pathname.endsWith('/wci_members'))body=[{workspace_id:'workspace',role:'viewer',wci_workspaces:{name:'Session test'}}];
  else if(url.pathname.endsWith('/wci_profiles'))body={workspace_id:'workspace',user_id:user.id,name:'Person A',email:user.email,role:'super_admin',active:true};
  else if(url.pathname.endsWith('/wci_datasets'))body={active_batch:'batch',data_mode:'reference'};
  else if(url.pathname.endsWith('/wci_events'))body={revision:1};
  return route.fulfill({status:200,json:body});
 });
 await page.goto('/');await page.getByLabel('Email',{exact:true}).fill(user.email);await page.getByLabel('Password',{exact:true}).fill('fixture');await page.getByRole('button',{name:'Login',exact:true}).click();await expect(page.locator('.app-shell')).toBeVisible();
 await page.clock.fastForward(300000);await page.reload();await expect(page.locator('.app-shell')).toBeVisible();
 await page.locator('.header-command').first().click();await page.clock.fastForward(590000);await expect(page.locator('.app-shell')).toBeVisible();
 await page.clock.fastForward(11000);await expect(page.locator('#wciLogin')).toBeVisible();await expect(page.locator('#wciLogin')).not.toContainText('15 menit');await expect.poll(()=>logoutScope).toBe('local');
});
