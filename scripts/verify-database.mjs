import {readFile,mkdir,writeFile} from 'node:fs/promises';
const workspace=process.env.WCI_WORKSPACE_ID||'00a0f3a9-ba2b-42fb-8f98-211e5c1fa8cb';if(!/^[0-9a-f-]{36}$/i.test(workspace))throw Error('Invalid WCI_WORKSPACE_ID');await mkdir('private/verification',{recursive:true});
for(const kind of ['ijr','regional','corporate']){
 const rows=JSON.parse(await readFile('private/seed/'+kind+'.json','utf8'));let sql='';
 for(let offset=0;offset<rows.length;offset+=100){const encoded=Buffer.from(JSON.stringify(rows.slice(offset,offset+100))).toString('base64');sql+=`select '${kind}' as dataset,${offset} as offset,count(*) filter(where a.payload is distinct from e.value) as mismatches from jsonb_array_elements(convert_from(decode('${encoded}','base64'),'UTF8')::jsonb) with ordinality e cross join public.wci_datasets d left join public.wci_records a on a.batch_id=d.original_batch and a.position=e.ordinality+${offset} where d.workspace_id='${workspace}' and d.kind='${kind}';\n`;}
 await writeFile('private/verification/'+kind+'.sql',sql);
}
console.log('Generated exact JSONB equality checks in private/verification. All mismatch counts must be zero, alongside the expected total counts. Execute through the trusted database connection.');
