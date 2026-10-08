import {test,expect} from '@playwright/test';
test('large Excel parsing runs outside the UI thread and preserves header mapping',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const path='/src/lib/upload-reader.ts';const {readUploadInWorker}=await import(/* @vite-ignore */path);
  const lines=['Status,Produk,No Register,Company,Assign Date,Done Date'];for(let i=1;i<=10000;i++)lines.push(`Done,BNIDirect,W-${i},Company ${i},2026-08-14,2026-08-18`);
  let ticks=0;const timer=setInterval(()=>ticks++,10);
  try{const audit=await readUploadInWorker(new File([lines.join('\n')],'worker.csv'),'corporate');return {source:audit.source,valid:audit.rows.length,issues:audit.issues.length,last:audit.rows.at(-1).noreg,ticks};}
  finally{clearInterval(timer);}
 });
 expect(result).toMatchObject({source:10000,valid:10000,issues:0,last:'W-10000'});expect(result.ticks).toBeGreaterThan(2);
});
