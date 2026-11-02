-- Preserve old schedules as-is. A missing end time must be supplied on the next edit.
do $migration$
declare definition text;needle text:=$old$  if kind='calendar' then
   if coalesce(body->>'time','')!~'^([01]\d|2[0-3]):[0-5]\d$' or coalesce(trim(body->>'place'),'')='' then raise exception 'Waktu dan tempat wajib diisi';end if;
$old$;replacement text:=$new$  if kind='calendar' then
   body:=body||jsonb_build_object('start',coalesce(nullif(body->>'start',''),body->>'time',''),'time',coalesce(nullif(body->>'start',''),body->>'time',''));
   if coalesce(body->>'start','')!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' or coalesce(body->>'end','')!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' or coalesce(trim(body->>'place'),'')='' then raise exception 'Jam mulai, jam selesai, dan tempat wajib diisi';end if;
   if (body->>'end')::time<=(body->>'start')::time then raise exception 'Jam selesai harus setelah jam mulai';end if;
$new$;
begin
 needle:=replace(needle,E'\r\n',E'\n');replacement:=replace(replacement,E'\r\n',E'\n');
 select replace(pg_get_functiondef('wci_private.activity_save(uuid,text,uuid,text,jsonb,jsonb,timestamptz,uuid)'::regprocedure),E'\r\n',E'\n') into definition;
 if strpos(definition,needle)=0 then raise exception 'Calendar validation location changed';end if;
 definition:=replace(definition,needle,replacement);
 if strpos(definition,E'   if kind=''call'' then\n')=0 then raise exception 'Call validation location changed';end if;
 definition:=replace(definition,E'   if kind=''call'' then\n',E'   if kind=''call'' then\n    if jsonb_array_length(files)=0 then raise exception ''Lampiran Call Report wajib diunggah'';end if;\n');
 execute definition;
end $migration$;
