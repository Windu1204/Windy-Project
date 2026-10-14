-- Upload diagnostics belong to administration, across every dashboard.
-- Dashboard record access, SLA diagnostics and dataset-version selectors are unchanged.
alter policy scoped_issue_read on public.wci_upload_issues
 using (wci_private.admin(workspace_id));

do $$ declare body text; needle text; begin
 select pg_get_functiondef('wci_private.upload_summary(uuid,text)'::regprocedure) into body;
 needle:='(wci_private.admin(p_workspace) or wci_private.dashboard_access(p_workspace,p_kind))';
 if position(needle in body)=0 then raise exception 'Upload summary access guard changed';end if;
 body:=replace(body,needle,'wci_private.admin(p_workspace)');
 body:=replace(body,'''Dashboard access required''','''Admin access required''');
 execute body;
end $$;
