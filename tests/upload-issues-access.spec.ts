import {test,expect} from '@playwright/test';

test('upload diagnostics only fetch and render for Admin/Super Admin across all datasets',async({page})=>{
 let requests=0;
 await page.route('**/src/lib/supabase.ts*',route=>route.fulfill({contentType:'text/javascript',body:`
 const auth={getUser:async()=>({data:{user:null}}),getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})};
 export const supabase={auth,rpc:async name=>({data:await (await fetch('https://example.invalid/rest/v1/rpc/'+name)).json(),error:null}),from(name){const chain={select(){return chain},eq(){return chain},order(){return chain},async range(){return {data:await (await fetch('https://example.invalid/rest/v1/'+name)).json(),count:1,error:null}}};return chain;}};
 `}));

 await page.route('**/rest/v1/rpc/wci_upload_summary',route=>{requests++;return route.fulfill({json:{file:'Example.xlsx',source:3,valid:2,failed:1,committed:true,reasons:[]}});});
 await page.route('**/rest/v1/wci_upload_issues*',route=>{requests++;return route.fulfill({json:[{id:1,file_name:'Example.xlsx',source_row:4,sheet:'Data',reason:'Example issue',created_at:'2026-10-14'}],headers:{'content-range':'0-0/1'}});});
 await page.goto('/');
 await page.evaluate(async()=>{const clientPath='/node_modules/.vite/deps/react-dom_client.js';const {createRoot}=(await import(/* @vite-ignore */clientPath)).default;const el=document.createElement('div');el.id='diagnostic-test';document.body.append(el);(window as any).diagnosticRoot=createRoot(el);});
 for(const role of ['individual','team_leader','department_head','admin','super_admin'])for(const kind of ['ijr','regional','corporate','piloting']){
  const before=requests;
  await page.evaluate(async({role,kind})=>{const reactPath='/node_modules/.vite/deps/react.js',componentPath='/src/components/UploadIssues.tsx';const React=(await import(/* @vite-ignore */reactPath)).default;const {UploadIssues}=await import(/* @vite-ignore */componentPath);(window as any).diagnosticRoot.render(React.createElement(UploadIssues,{key:role+kind,workspace:'test',role,kind,revision:0}));await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));},{role,kind});
  if(['admin','super_admin'].includes(role)){
   await expect(page.locator('#diagnostic-test .upload-issues')).toBeVisible();
   await page.locator('#diagnostic-test summary').click();await expect(page.locator('#diagnostic-test')).toContainText('Example issue');
   expect(requests).toBe(before+2);
  }else {await expect(page.locator('#diagnostic-test .upload-issues')).toHaveCount(0);expect(requests).toBe(before);}
 }
});

test('upload diagnostics are absent from every dashboard and Admin summary',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Buka preview lokal'}).click();
 for(const name of ['IJR - BNIdirect','Regional - Non BNIDirect','Corporate - Non Piloting','Corporate - Piloting']){
  await page.getByRole('button',{name,exact:true}).click();await expect(page.locator('.upload-issues')).toHaveCount(0);
 }
 await page.getByRole('button',{name:'Admin',exact:true}).click();await expect(page.locator('.upload-issues')).toHaveCount(0);
 await page.getByRole('button',{name:'Upload & Riwayat Data',exact:true}).click();await expect(page.getByLabel('Dashboard tujuan',{exact:true})).toBeVisible();
});
