import {test,expect} from '@playwright/test';
test('verified tab cache reuses rows, refreshes upload/Done, reports failures and isolates logout',async({page})=>{
 test.skip(!process.env.WCI_CACHE_MOCK,'Isolated fake Supabase server required');
 let owner='first',revision=1,offline=false,reads=0;
 let payload={company:'First Company',cid:'1',region:'W01',type:'New',product:'VA',implementor:'PIC A',status:'In progress',docComplete:'2026-10-01',doneDate:''};
 const user=()=>({id:owner,aud:'authenticated',role:'authenticated',email:owner+'@example.invalid',app_metadata:{},user_metadata:{}});
 const token=()=>btoa(JSON.stringify({alg:'HS256',typ:'JWT'}))+'.'+btoa(JSON.stringify({sub:owner,exp:4102444800,role:'authenticated'}))+'.signature';
 await page.route('https://cache-test.supabase.co/**',async route=>{
  const url=new URL(route.request().url());let body:unknown=[];
  if(url.pathname==='/auth/v1/token')body={access_token:token(),refresh_token:'fake-refresh',expires_in:3600,token_type:'bearer',user:user()};
  else if(url.pathname==='/auth/v1/user')body=user();
  else if(url.pathname==='/auth/v1/logout')return route.fulfill({status:204});
  else if(url.pathname.endsWith('/wci_members'))body=[{workspace_id:'workspace',role:'owner',wci_workspaces:{name:'Test'}}];
  else if(url.pathname.endsWith('/wci_profiles'))body={workspace_id:'workspace',user_id:owner,name:owner,email:owner+'@example.invalid',role:'super_admin',active:true};
  else if(url.pathname.endsWith('/wci_datasets'))body={active_batch:'batch',data_mode:'reference'};
  else if(url.pathname.endsWith('/wci_events')){if(offline)return route.fulfill({status:400,json:{message:'Offline test'}});body={revision};}
  else if(url.pathname.endsWith('/wci_records')){reads++;body=[{id:owner,position:1,payload:url.searchParams.get('dataset')==='eq.regional'?payload:{...payload,'Application Number':'A','Applicant Name':payload.company,Status:'Dalam Proses',Wilayah:'W01'}}];}
  return route.fulfill({status:200,json:body});
 });
 await page.goto('/');await page.getByLabel('Email',{exact:true}).fill('first@example.invalid');await page.getByLabel('Password',{exact:true}).fill('fake-password');await page.getByRole('button',{name:'Login',exact:true}).click();
 await expect(page.locator('.app-shell')).toBeVisible();await expect(page.locator('.kpis')).toBeVisible();
 await page.getByRole('button',{name:'Regional - Non BNIDirect',exact:true}).click();await expect(page.locator('.records')).toContainText('First Company');
 const loaded=reads;
 await page.getByRole('button',{name:'IJR - BNIdirect',exact:true}).click();await expect(page.locator('.records')).toContainText('First Company');
 await page.getByRole('button',{name:'Regional - Non BNIDirect',exact:true}).click();await expect(page.locator('.records')).toContainText('First Company');expect(reads).toBe(loaded);
 payload={...payload,status:'Done',doneDate:'2026-10-12'};revision++;
 await page.evaluate(()=>window.dispatchEvent(new Event('online')));await expect(page.locator('.records tbody')).toContainText('Done');await expect(page.locator('.records tbody')).toContainText('2026-10-12');expect(reads).toBeGreaterThan(loaded);
 const afterDone=reads;await page.evaluate(()=>window.dispatchEvent(new Event('online')));await page.waitForTimeout(600);expect(reads).toBe(afterDone);
 offline=true;await page.evaluate(()=>window.dispatchEvent(new Event('online')));await expect(page.getByText(/Pembaruan data gagal/)).toBeVisible();
 offline=false;await page.getByRole('button',{name:'Keluar',exact:true}).click();await expect(page.locator('#wciLogin')).toBeVisible();
 owner='second';payload={...payload,company:'Second Company'};
 await page.getByLabel('Email',{exact:true}).fill('second@example.invalid');await page.getByLabel('Password',{exact:true}).fill('fake-password');await page.getByRole('button',{name:'Login',exact:true}).click();
 await expect(page.locator('.kpis')).toBeVisible();await page.getByRole('button',{name:'Regional - Non BNIDirect',exact:true}).click();await expect(page.locator('.records')).toContainText('Second Company');await expect(page.locator('.records')).not.toContainText('First Company');expect(reads).toBeGreaterThan(afterDone);
});
