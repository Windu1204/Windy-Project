-- Preserve the Done override as history when a newer terminal source status replaces it.
alter table wci_private.wci_done_overrides add column superseded_at timestamptz;
do $$ declare body text;begin
 select pg_get_functiondef('wci_private.wci_replace_dataset(uuid,text,jsonb,text)'::regprocedure) into body;
 body:=replace(body,'update wci_merge_stage_v2 s set payload=s.payload||jsonb_build_object',
 'update wci_private.wci_done_overrides o set superseded_at=now() from wci_merge_stage_v2 s where p_kind=''regional'' and o.workspace_id=p_workspace and o.data_mode=mode and o.job_key=s.job_key and o.superseded_at is null and coalesce(s.payload->>''status'','''')~*''(reject|retur|return)'';
 update wci_merge_stage_v2 s set payload=s.payload||jsonb_build_object');
 body:=replace(body,'''doneDate'',to_char(o.completed_at at time zone ''Asia/Jakarta'',''YYYY-MM-DD'')','''doneDate'',case when coalesce(s.payload->>''status'','''')~*''^done$'' then coalesce(nullif(s.payload->>''doneDate'',''''),to_char(o.completed_at at time zone ''Asia/Jakarta'',''YYYY-MM-DD'')) else to_char(o.completed_at at time zone ''Asia/Jakarta'',''YYYY-MM-DD'') end');
 body:=replace(body,'o.job_key=s.job_key;','o.job_key=s.job_key and o.superseded_at is null;');
 execute body;
 select pg_get_functiondef('wci_private.wci_upload_review(uuid,text,jsonb)'::regprocedure) into body;
 body:=replace(body,'case when o.job_key is not null then','case when o.job_key is not null and o.superseded_at is null and coalesce(n.payload->>''status'','''')!~*''(reject|retur|return)'' then');
 body:=replace(body,'''doneDate'',to_char(o.completed_at at time zone ''Asia/Jakarta'',''YYYY-MM-DD'')','''doneDate'',case when coalesce(n.payload->>''status'','''')~*''^done$'' then coalesce(nullif(n.payload->>''doneDate'',''''),nullif(old.payload->>''doneDate'',''''),to_char(o.completed_at at time zone ''Asia/Jakarta'',''YYYY-MM-DD'')) else to_char(o.completed_at at time zone ''Asia/Jakarta'',''YYYY-MM-DD'') end');
 execute body;
 select pg_get_functiondef('wci_private.wci_mark_done(uuid,uuid,text)'::regprocedure) into body;
 body:=replace(body,'do update set note=excluded.note,user_id=excluded.user_id','do update set note=excluded.note,user_id=excluded.user_id,completed_at=case when coalesce(r.payload->>''status'','''')~*''^done$'' then wci_done_overrides.completed_at else now() end,superseded_at=null');
 execute body;
end $$;
