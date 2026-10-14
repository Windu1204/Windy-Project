import {test,expect,type Page} from '@playwright/test';
const latest={uploadId:'latest',file:'Latest.xlsx',source:3,valid:3,failed:0,committed:false,canResume:true,complete:true,baselineCurrent:true,reasons:[]};
async function mockClient(page:Page){
 await page.route('**/src/lib/supabase.ts*',route=>route.fulfill({contentType:'text/javascript',body:`
 const auth={getUser:async()=>({data:{user:null}}),getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})};
 export const supabase={auth,async rpc(name,args){const response=await fetch('https://example.invalid/rest/v1/rpc/'+name,{method:'POST',body:JSON.stringify(args)});const body=await response.json();return response.ok?{data:body,error:null}:{data:null,error:body};},from(name){const query=new URLSearchParams();const chain={select(){return chain},eq(k,v){query.set(k,'eq.'+v);return chain},order(){return chain},async range(){const data=await (await fetch('https://example.invalid/rest/v1/'+name+'?'+query)).json();return {data,count:data.length,error:null}}};return chain;}};
 `}));
}
async function mount(page:Page,role='super_admin',kind='corporate'){
 await page.evaluate(async({role,kind})=>{
  const clientPath='/node_modules/.vite/deps/react-dom_client.js',reactPath='/node_modules/.vite/deps/react.js',componentPath='/src/components/UploadIssues.tsx';
  const {createRoot}=(await import(/* @vite-ignore */clientPath)).default,React=(await import(/* @vite-ignore */reactPath)).default,{UploadIssues}=await import(/* @vite-ignore */componentPath);
  if(!(window as any).diagnosticRoot){const el=document.createElement('div');el.id='diagnostic-test';document.body.append(el);(window as any).diagnosticRoot=createRoot(el);}
  (window as any).diagnosticRoot.render(React.createElement(UploadIssues,{key:role+kind,workspace:'test',role,kind,revision:0,onApplied:async()=>{(window as any).uploadApplied=true;}}));
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 },{role,kind});
}

test('upload diagnostics only fetch and render for Admin/Super Admin across all datasets',async({page})=>{
 let requests=0;await mockClient(page);
 await page.route('**/rest/v1/rpc/wci_upload_summary',route=>{requests++;return route.fulfill({json:{...latest,failed:1,committed:true}});});
 await page.route('**/rest/v1/wci_upload_issues*',route=>{requests++;expect(new URL(route.request().url()).searchParams.get('upload_id')).toBe('eq.latest');return route.fulfill({json:[{id:1,file_name:'Latest.xlsx',source_row:4,sheet:'Data',reason:'Example issue',created_at:'2026-10-14'}]});});
 await page.goto('/');
 for(const role of ['individual','team_leader','department_head','admin','super_admin'])for(const kind of ['ijr','regional','corporate','piloting']){
  const before=requests;await mount(page,role,kind);
  if(['admin','super_admin'].includes(role)){
   await expect(page.locator('#diagnostic-test .upload-issues')).toBeVisible();await page.locator('#diagnostic-test summary').click();await expect(page.locator('#diagnostic-test')).toContainText('Example issue');expect(requests).toBe(before+2);
  }else{await expect(page.locator('#diagnostic-test .upload-issues')).toHaveCount(0);expect(requests).toBe(before);}
 }
});

test('saved upload can be reviewed after reload, retried, and applied without uploading the file again',async({page})=>{
 let reviews=0,commits=0;await mockClient(page);
 await page.route('**/rest/v1/rpc/*',route=>{
  const method=route.request().url().split('/').at(-1);
  if(method==='wci_upload_summary')return route.fulfill({json:latest});
  expect(route.request().postDataJSON().p_id).toBe('latest');
  if(method==='wci_review_staged_upload'){reviews++;return reviews===1?route.fulfill({status:400,json:{message:'Temporary review failure'}}):route.fulfill({json:{new:2,updated:0,unchanged:0,duplicates:1,conflicts:0}});}
  if(method==='wci_commit_staged_upload'){commits++;return route.fulfill({json:null});}
  return route.fulfill({status:400,json:{message:'Unexpected RPC'}});
 });
 await page.route('**/rest/v1/wci_upload_issues*',route=>route.fulfill({json:new URL(route.request().url()).searchParams.get('upload_id')==='eq.latest'?[]:[{id:1,file_name:'Old.xlsx',reason:'Old error'}]}));
 await page.goto('/');await mount(page);await page.reload();await mount(page);await page.locator('#diagnostic-test summary').click();
 await expect(page.locator('#diagnostic-test')).toContainText('Tidak ada baris bermasalah');await expect(page.locator('#diagnostic-test')).not.toContainText('Old error');
 await page.getByRole('button',{name:'Lanjutkan Upload',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Temporary review failure');
 await page.getByRole('button',{name:'Lanjutkan Upload',exact:true}).click();await expect(page.getByRole('button',{name:'Terapkan Upload',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'Terapkan Upload',exact:true}).click();await expect(page.locator('#diagnostic-test')).toContainText('Sudah diterapkan');expect(commits).toBe(1);expect(reviews).toBe(2);expect(await page.evaluate(()=>(window as any).uploadApplied)).toBe(true);
});

for(const state of [{canResume:false},{baselineCurrent:false},{complete:false}])test('cannot resume a foreign, stale or incomplete upload '+JSON.stringify(state),async({page})=>{
 await mockClient(page);await page.route('**/rest/v1/rpc/wci_upload_summary',route=>route.fulfill({json:{...latest,...state}}));await page.route('**/rest/v1/wci_upload_issues*',route=>route.fulfill({json:[]}));
 await page.goto('/');await mount(page);await page.locator('#diagnostic-test summary').click();await expect(page.getByRole('button',{name:'Lanjutkan Upload',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Terapkan Upload',exact:true})).toHaveCount(0);
});

test('upload diagnostics are absent from every dashboard and Admin summary',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Buka preview lokal'}).click();for(const name of ['IJR - BNIdirect','Regional - Non BNIDirect','Corporate - Non Piloting','Corporate - Piloting']){await page.getByRole('button',{name,exact:true}).click();await expect(page.locator('.upload-issues')).toHaveCount(0);}
 await page.getByRole('button',{name:'Admin',exact:true}).click();await expect(page.locator('.upload-issues')).toHaveCount(0);await page.getByRole('button',{name:'Upload & Riwayat Data',exact:true}).click();await expect(page.getByLabel('Dashboard tujuan',{exact:true})).toBeVisible();
});
