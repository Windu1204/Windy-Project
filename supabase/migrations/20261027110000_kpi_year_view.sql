-- Annual view preserves monthly values, units and the existing KPI access scope.
create function public.wci_kpi_read_year(p_workspace uuid,p_year integer,p_as uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare snapshot jsonb;
begin
 if p_year is null or p_year not between 2026 and 2100 then raise exception 'Tahun KPI mulai dari 2026';end if;
 -- The monthly reader authenticates the caller and authorizes any Super Admin preview.
 snapshot:=public.wci_kpi_read(p_workspace,make_date(p_year,1,1),p_as);
 return jsonb_set(snapshot,'{values}',coalesce((
  select jsonb_agg(to_jsonb(v)-'workspace_id'-'updated_by' order by v.period,v.indicator_key)
  from public.wci_kpi_values v where v.workspace_id=p_workspace
   and v.period>=make_date(p_year,1,1) and v.period<make_date(p_year+1,1,1)
   and v.person_id in(select (s->>'id')::uuid from jsonb_array_elements(snapshot->'people') s)
 ),'[]'::jsonb));
end $$;
revoke all on function public.wci_kpi_read_year(uuid,integer,uuid) from public,anon,authenticated;
grant execute on function public.wci_kpi_read_year(uuid,integer,uuid) to authenticated;
