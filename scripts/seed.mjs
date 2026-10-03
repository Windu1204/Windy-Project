import {readFile,mkdir,writeFile} from 'node:fs/promises';
const workspace=process.env.WCI_WORKSPACE_ID||'00a0f3a9-ba2b-42fb-8f98-211e5c1fa8cb';if(!/^[0-9a-f-]{36}$/i.test(workspace))throw Error('Invalid WCI_WORKSPACE_ID');
await mkdir('private/generated-seed',{recursive:true});const manifest=[];
await writeFile('private/generated-seed/000-prepare.sql',`begin;
insert into public.wci_workspaces(id,name) values('${workspace}','Corporate, Area, dan IJR Monitoring') on conflict(id) do nothing;
insert into public.wci_datasets(workspace_id,kind) select '${workspace}',k from unnest(array['ijr','regional','corporate']) k on conflict do nothing;
do $$ declare d record;b uuid;begin for d in select * from public.wci_datasets where workspace_id='${workspace}' for update loop if d.original_batch is null then insert into public.wci_batches(workspace_id,dataset,name,row_count,is_original) values(d.workspace_id,d.kind,'Original v78',0,true) returning id into b;update public.wci_datasets set original_batch=b where workspace_id=d.workspace_id and kind=d.kind;end if;end loop;end $$;commit;`);

for(const kind of ['ijr','regional','corporate']){
 const rows=JSON.parse(await readFile('private/seed/'+kind+'.json','utf8'));
 for(let offset=0;offset<rows.length;offset+=100){const encoded=Buffer.from(JSON.stringify(rows.slice(offset,offset+100))).toString('base64');const file=kind+'-'+String(offset).padStart(5,'0')+'.sql';
 const sql=`insert into public.wci_records(workspace_id,dataset,batch_id,position,payload) select d.workspace_id,d.kind,d.original_batch,(r.ordinality+${offset})::integer,r.value from jsonb_array_elements(convert_from(decode('${encoded}','base64'),'UTF8')::jsonb) with ordinality r cross join public.wci_datasets d where d.workspace_id='${workspace}' and d.kind='${kind}' on conflict(batch_id,position) do nothing;`;
 await writeFile('private/generated-seed/'+file,sql);manifest.push(file);}
}
await writeFile('private/generated-seed/999-activate.sql',`begin;
do $$ declare d record;b uuid;n integer;begin for d in select * from public.wci_datasets where workspace_id='${workspace}' for update loop select count(*) into n from public.wci_records where batch_id=d.original_batch;if n=0 then raise exception 'Empty original dataset';end if;update public.wci_batches set row_count=n where id=d.original_batch;if d.active_batch is null then insert into public.wci_batches(workspace_id,dataset,name,row_count) values(d.workspace_id,d.kind,'Initial migrated data',n) returning id into b;insert into public.wci_records(workspace_id,dataset,batch_id,position,payload) select workspace_id,dataset,b,position,payload from public.wci_records where batch_id=d.original_batch;update public.wci_datasets set active_batch=b where workspace_id=d.workspace_id and kind=d.kind;end if;end loop;end $$;commit;`);
await writeFile('private/generated-seed/manifest.json',JSON.stringify(manifest));console.log(`Generated ${manifest.length} idempotent SQL chunks. Run through a trusted database administrator connection after creating the original batches. No keys or records belong in the public repository.`);
