import { PmPlaceholder } from './piloting/PmPlaceholder';
import { useLanguage } from './lib/language';
import { useEffect, useState, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import { type User } from '@supabase/supabase-js';
import { ChartNoAxesCombined, Building2, Network, LogOut, RefreshCw, UserRound, ArrowUpRight } from 'lucide-react';
import { type ApplicationKind, type SlaRule, type Payload, type MonitoringRecord, type Membership, datasetTitles } from './types';
import { pilotSla } from './piloting/sla';
import { calculateSla } from './domain/sla';
import { supabase } from './lib/supabase';
import * as repository from './lib/repository';
import { Auth } from './components/Auth';
import { PasswordSetup } from './components/PasswordSetup';
import { AccountMenu } from './components/AccountMenu';
import Dashboard from './components/Dashboard';
import Admin from './components/Admin';
import * as access from './lib/access';
const PilotingDashboard = lazy(() => import('./piloting/PilotingDashboard'));
export default function App() { const { t, language, setLanguage } = useLanguage(); 
    const [user, setUser] = useState<User | null>(null), [authLoading, setAuthLoading] = useState(true), [preview, setPreview] = useState(false), [kind, setKind] = useState<ApplicationKind>('ijr'), [members, setMembers] = useState<Membership[]>([]), [workspace, setWorkspace] = useState(''), [raw, setRaw] = useState<repository.StoredRow[]>([]), [original, setOriginal] = useState<repository.StoredRow[]>([]), [rules, setRules] = useState<SlaRule[]>([]), [loading, setLoading] = useState(false), [error, setError] = useState(''), [refresh, setRefresh] = useState(0), [profile, setProfile] = useState(false), [displayName, setDisplayName] = useState('');
    const [account,setAccount]=useState<access.Profile|null>(null),[grants,setGrants]=useState<access.Grant[]>([]),[teamPeople,setTeamPeople]=useState<{team_id:string;pic:string}[]>([]),[adminView,setAdminView]=useState(false),[version,setVersion]=useState(''),[versions,setVersions]=useState<access.Batch[]>([]),[dataMode,setDataMode]=useState('reference'),[source,setSource]=useState<'AT'|'PM'>('AT'),[viewAs,setViewAs]=useState<{profile:access.Profile;directory:Awaited<ReturnType<typeof access.adminDirectory>>}|null>(null),[recovery,setRecovery]=useState(false);
    const [lastUpdated,setLastUpdated]=useState<Date|null>(null),[connected,setConnected]=useState(false);
    const loadedScope=useRef('');
    const localProfile:access.Profile={workspace_id:'local',user_id:'local',name:'Local Preview',email:'',role:'super_admin',active:true};
    const currentProfile=viewAs?.profile||(preview?localProfile:account);
    const currentGrants=viewAs?viewAs.directory.grants.filter(g=>g.user_id===viewAs.profile.user_id):grants;
    const availableKinds=preview||currentProfile?.role==='super_admin'?(['ijr','regional','corporate','piloting'] as ApplicationKind[]):currentProfile?.role==='admin'?[]:[...new Set(currentGrants.map(g=>g.dataset))];
    const effectiveSource=kind!=='piloting'?'AT':currentProfile?.role!=='super_admin'&&!currentGrants.some(g=>g.dataset==='piloting'&&g.source==='AT')?'PM':source;
    useEffect(()=>{if(preview||!workspace||!user)return;let active=true;access.myAccess(workspace,user.id).then(c=>{if(!active)return;setAccount(c.profile);setGrants(c.grants);setTeamPeople(c.people);if(c.profile?.role!=='super_admin')setViewAs(null);if(!c.profile?.active){setRaw([]);setError('Akun tidak aktif. Hubungi administrator.');}else if(c.profile.role==='admin')setAdminView(true);}).catch(e=>{if(active){setRaw([]);setError(e.message);}});return()=>{active=false;};},[workspace,user,preview,refresh]);
    useEffect(()=>{if(!viewAs||preview||!workspace)return;let active=true;access.adminDirectory(workspace).then(directory=>{if(active)setViewAs(previous=>{if(!previous)return null;const profile=directory.profiles.find(p=>p.user_id===previous.profile.user_id);return profile?{profile,directory}:null;});}).catch(e=>{if(active){setViewAs(null);setError(e.message);}});return()=>{active=false;};},[workspace,preview,refresh,viewAs?.profile.user_id]);
    useEffect(()=>{if(!supabase||!workspace||preview)return;let timer:ReturnType<typeof setTimeout>;const changed=()=>{clearTimeout(timer);timer=setTimeout(()=>setRefresh(n=>n+1),150);};const channel=supabase.channel('wci-updates-'+workspace).on('postgres_changes',{event:'UPDATE',schema:'public',table:'wci_events',filter:'workspace_id=eq.'+workspace},changed).subscribe(state=>{setConnected(state==='SUBSCRIBED');if(state==='SUBSCRIBED')changed();});const poll=setInterval(changed,20000);window.addEventListener('online',changed);window.addEventListener('focus',changed);return()=>{clearTimeout(timer);clearInterval(poll);window.removeEventListener('online',changed);window.removeEventListener('focus',changed);void supabase!.removeChannel(channel);};},[workspace,preview]);
    useEffect(()=>{setVersion('');setSource('AT');},[kind,workspace]);
    useEffect(()=>setVersion(''),[dataMode]);
    useEffect(()=>{if(!preview&&currentProfile?.active&&currentProfile.role!=='admin'&&!availableKinds.includes(kind)&&availableKinds.length)setKind(availableKinds[0]);},[account,grants,viewAs,kind,preview]);
    useEffect(()=>{if(preview||!workspace)return;let active=true;(async()=>{const {data,error}=await supabase!.from('wci_datasets').select('data_mode').eq('workspace_id',workspace).eq('kind',kind).maybeSingle();if(error)throw error;const mode=data?.data_mode||'reference';const r=await supabase!.from('wci_batches').select('id,dataset,name,created_at,data_mode,source,week_start,row_count').eq('workspace_id',workspace).eq('dataset',kind).eq('data_mode',mode).eq('source','AT').order('created_at',{ascending:false});if(r.error)throw r.error;if(active){setDataMode(mode);setVersions(r.data as access.Batch[]);}})().catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[kind,workspace,preview,refresh]);
    useEffect(() => { if (!supabase) {
        setAuthLoading(false);
        return;
    } let active = true; supabase.auth.getUser().then(({ data }) => { if (active) {
        setUser(data.user);
        setAuthLoading(false);
    } }); const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { setUser(session?.user || null); setAuthLoading(false); if(_event==='PASSWORD_RECOVERY')setRecovery(true); }); return () => { active = false; subscription.unsubscribe(); }; }, []);
    useEffect(() => { if (!user) {
        setMembers([]);setAccount(null);setGrants([]);setViewAs(null);setAdminView(false);
        setWorkspace('');
        if (!preview)
            setRaw([]);
        return;
    } let active = true; repository.memberships().then(m => { if (active) {
        setMembers(m);
        setWorkspace(m[0]?.workspace_id || '');
        if (!m.length)
            setError('Akun belum memiliki akses workspace. Hubungi administrator.');
    } }).catch(e => { if (active)
        setError(e.message); }); return () => { active = false; }; }, [user, preview]);
    useEffect(() => { if (!preview && !workspace)
        return; let active = true; const scope=[kind,workspace,preview,version].join('|'); const switching=loadedScope.current!==scope; if(switching){setLoading(true);setRaw([]);} setError(''); const load = preview ? (async () => { const response = await fetch('/__local-data/' + kind); if (!response.ok)
        throw new Error('File source lokal tidak tersedia.'); const payload = await response.json() as Payload[]; return { rows: payload.map((p, i) => ({ id: kind + '-' + i, payload: p, position: i + 1 })), rules: [] as SlaRule[] }; })() : Promise.all([repository.loadRows(workspace, kind,version), repository.loadRules(workspace,kind)]).then(([rows, rules]) => ({ rows, rules })); load.then(result => { if (active) {
        loadedScope.current=scope;
        setRaw(result.rows);
        setOriginal(result.rows);
        setRules(result.rules);setLastUpdated(new Date());
    } }).catch(e => { if (active)
        setError(e.message); }).finally(() => { if (active)
        setLoading(false); }); return () => { active = false; }; }, [kind, workspace, preview, refresh,version]);
    const visibleRaw=useMemo(()=>viewAs?access.scopedRows(raw,kind,viewAs.profile,viewAs.directory.grants.filter(g=>g.user_id===viewAs.profile.user_id),viewAs.directory.teams,viewAs.directory.people):raw,[raw,kind,viewAs]);
    const rows = useMemo<MonitoringRecord[]>(() => (effectiveSource==='PM'?[]:visibleRaw).map(r => ({ id: r.id, payload: r.payload, sla: kind === 'piloting' ? pilotSla(r.payload, rules) : calculateSla(r.payload, kind, rules) })), [visibleRaw, kind, rules,effectiveSource]);
    const membership = members.find(m => m.workspace_id === workspace), canEdit = !viewAs&&(preview||account?.role==='super_admin'), canDone=!viewAs&&!version&&kind==='regional'&&account?.role==='individual';
    const reload = useCallback(() => setRefresh(n => n + 1), []);
    async function apply(payload: Payload[], name: string) { if (preview) {
        setRaw(payload.map((p, i) => ({ id: kind + '-' + i, payload: p, position: i + 1 })));
        return;
    } await repository.replaceRows(workspace, kind, payload, name); reload(); }
    async function restore() { if (preview) {
        setRaw(original);
        return;
    } await repository.restoreRows(workspace, kind); reload(); }
    async function done(r: MonitoringRecord, note: string) { if (preview) {
        setRaw(a => a.map(x => x.id === r.id ? { ...x, payload: { ...x.payload, status: 'Done', dashboardNote: note, dashboardUpdatedAt: new Date().toISOString() } } : x));
        return;
    } await repository.markDone(workspace, r.id, r.payload, note); reload(); }
    async function saveRule(r: SlaRule) { if (preview) {
        setRules(a => [...a.filter(x => x.product !== r.product), r]);
        return;
    } await repository.saveRule(workspace, r,kind); setRules(await repository.loadRules(workspace,kind)); }
    async function deleteRule(product: string) { if (preview) {
        setRules(a => a.filter(x => x.product !== product));
        return;
    } await repository.deleteRule(workspace, product,kind); setRules(await repository.loadRules(workspace,kind)); }
    async function logout() { if (supabase && !preview) {
        const { error } = await supabase.auth.signOut();
        if (error) {
            setError(error.message);
            return;
        }
    } setPreview(false); setUser(null); setRaw([]); setRules([]); setProfile(false); setError(''); }
    async function saveProfile() { const result=await supabase!.rpc('wci_set_profile_name',{p_workspace:workspace,p_name:displayName});if(result.error){setError(result.error.message);return;} const { error } = await supabase!.auth.updateUser({ data: { display_name: displayName } }); if (error)
        setError(error.message);
    else {
        setUser((await supabase!.auth.getUser()).data.user);
        setProfile(false);reload();
    } }
    const personNames=currentProfile?.role==='individual'?currentGrants.filter(g=>g.dataset===kind&&g.source==='AT').map(g=>g.pic):currentProfile?.role==='team_leader'?(viewAs?viewAs.directory.people:teamPeople).filter(p=>currentGrants.some(g=>g.dataset===kind&&g.source==='AT'&&g.team_id===p.team_id)).map(p=>p.pic):undefined;
    const dataControls=<div className="dataset-period"><label>{t('Versi Data / Minggu Upload')}<select aria-label={t('Versi Data / Minggu Upload')} value={version} onChange={e=>setVersion(e.target.value)}><option value="">{t('Terbaru')}</option>{versions.map(b=><option key={b.id} value={b.id}>{b.week_start} · {new Date(b.created_at).toLocaleString()} · {b.name}</option>)}</select></label>{kind==='piloting'&&<label>{t('Sumber')}<select aria-label={t('Sumber')} value={effectiveSource} onChange={e=>setSource(e.target.value as 'AT'|'PM')}><option value="AT" disabled={currentProfile?.role!=='super_admin'&&!currentGrants.some(g=>g.dataset==='piloting'&&g.source==='AT')}>AT</option><option value="PM" disabled={currentProfile?.role!=='super_admin'&&!currentGrants.some(g=>g.dataset==='piloting'&&g.source==='PM')}>PM</option></select></label>}</div>;
    if (authLoading)
        return <div className="loading-page">{t("Memuat workspace…")}</div>;
    if (!user && !preview)
        return <Auth onPreview={() => { setPreview(true); setError(''); }}/>;
    const name = viewAs?viewAs.profile.name:preview?'Local Preview':account?.name||user?.user_metadata.display_name||user?.email||'User';
    if(!preview&&(recovery||user?.app_metadata.must_change_password))return <PasswordSetup required={!!user?.app_metadata.must_change_password} onSaved={()=>{setRecovery(false);setError('');supabase!.auth.getUser().then(r=>setUser(r.data.user));reload();}} onClose={()=>user?.app_metadata.must_change_password?void logout():setRecovery(false)}/>;
    if(!preview&&!account)return <p className="loading-page">{error||t('Memuat hak akses…')}</p>;
    if(!currentProfile?.active)return <div className="loading-page"><p>{t('Akun tidak aktif. Hubungi administrator.')}</p><button onClick={logout}>{t('Logout')}</button></div>; 
    return <div className="app-shell"><aside className="side sidebar"><div className="side-left-edge-mask" aria-hidden="true"/><div className="brand"><div className="bni-logo" role="img" aria-label={t("BNI")}/><b>{t("Corporate, Area, dan IJR Monitoring")}</b></div><nav aria-label={t("Pilih dashboard")}>{(availableKinds.length > 1 ? availableKinds : []).map((key, i) => { const Icon = [ChartNoAxesCombined, Network, Building2, Building2][i]; return <button key={key} className={'nav ' + (kind === key&&!adminView ? 'active' : '')} onClick={() => {setKind(key);setAdminView(false);}}><span className="side-ico"><Icon size={19}/></span>{datasetTitles[key]}{kind === key && <ArrowUpRight size={15}/>}</button>; })}{!viewAs&&(preview||account?.role==='super_admin'||account?.role==='admin')&&<button className={'nav admin-navigation '+(adminView?'active':'')} onClick={()=>setAdminView(true)}><UserRound size={19}/>{t('Admin')}</button>}</nav><div id="sidebar-sections"/><div className="side-building" aria-hidden="true"/><div className="side-wave" aria-hidden="true"/><div className="foot">{t("Unified corporate monitoring")}</div></aside><main className="main"><header className="topbar"><div><p className="eyebrow">{t("MONITORING DASHBOARD")}</p><h2 className="dashboard-title"><span aria-hidden="true">{kind === 'ijr' ? <ChartNoAxesCombined size={24}/> : kind === 'regional' ? <Network size={24}/> : <Building2 size={24}/>}</span>{adminView&&!viewAs?'Admin':datasetTitles[kind]}</h2><p className="muted">{t("Pantau request, implementasi, dan pencapaian SLA.")}</p></div><div className="header-actions">{members.length > 1 && <select aria-label={t("Workspace")} value={workspace} onChange={e => setWorkspace(e.target.value)}>{members.map(m => <option key={m.workspace_id} value={m.workspace_id}>{m.wci_workspaces.name}</option>)}</select>}<AccountMenu onPassword={()=>{setProfile(false);setRecovery(true);}} name={String(name)} email={user?.email||''} role={currentProfile?access.roleNames[currentProfile.role]:t('Menunggu akses')} preview={preview} open={profile} onToggle={()=>{setProfile(!profile);setDisplayName(String(account?.name||user?.user_metadata.display_name||''));}} onClose={()=>setProfile(false)} displayName={displayName} onNameChange={setDisplayName} onSave={saveProfile}/><button className="header-command" aria-label={t("Refresh data")} onClick={reload}><RefreshCw size={17}/><span>{t("Refresh")}</span></button><button className="header-command" aria-label={t("Logout")} onClick={logout}><LogOut size={18}/><span>{t("Logout")}</span></button></div></header><div className={'update-status'+(!connected&&!preview?' offline':'')} role="status"><span className="connection-dot"/>{t(preview?'Pratinjau lokal':connected?'Terhubung':'Memeriksa pembaruan berkala')}{lastUpdated&&<span>{t('Terakhir diperbarui')}: {lastUpdated.toLocaleTimeString(language==='en'?'en-GB':'id-ID',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</span>}</div>{preview && <div className="preview-banner">{t("Preview lokal · perubahan hanya berlaku selama sesi ini. Data bersama menggunakan Supabase setelah sign-in.")}</div>}{error && <div className="error" role="alert">{error}<button className="text-button" onClick={reload}>{t("Coba lagi")}</button></div>}{viewAs&&<div className="preview-banner">{t('Lihat sebagai pengguna · Hanya baca')}: {viewAs.profile.name}<button className="secondary" onClick={()=>{setViewAs(null);setAdminView(true);}}>{t('Kembali ke Admin')}</button></div>}

{(adminView||currentProfile?.role==='admin')&&!viewAs?<Admin workspace={workspace} profile={preview?localProfile:account!} preview={preview} revision={refresh} onUpload={async(k,r,n)=>{await repository.replaceRows(workspace,k,r,n);reload();}} onViewAs={(p,d)=>{setViewAs({profile:p,directory:d});setAdminView(false);const grant=d.grants.find(g=>g.user_id===p.user_id);if(grant)setKind(grant.dataset);}}/>:effectiveSource==='PM'?<PmPlaceholder individual={currentProfile?.role==='individual'} canReport={['super_admin','department_head','team_leader'].includes(currentProfile?.role||'')} dataControls={dataControls}/>:!availableKinds.length?<p className="empty">{t('Akun belum memiliki pemetaan dashboard. Hubungi administrator.')}</p>:loading?<p className="empty">{t("Memuat data…")}</p>:kind==='piloting'?<Suspense fallback={<p className="empty">{t('Memuat tampilan…')}</p>}><PilotingDashboard individual={currentProfile?.role==='individual'} canReport={['super_admin','department_head','team_leader'].includes(currentProfile?.role||'')} personNames={personNames} dataControls={dataControls} key={kind+'-'+workspace} rows={rows} rules={rules} canEdit={canEdit} onApply={apply} onRestore={restore} onSaveRule={saveRule} onDeleteRule={deleteRule}/></Suspense>:<Dashboard individual={currentProfile?.role==='individual'} canReport={['super_admin','department_head','team_leader'].includes(currentProfile?.role||'')} personNames={personNames} dataControls={dataControls} key={kind+'-'+workspace} kind={kind} rows={rows} rules={rules} canEdit={canEdit} canDone={canDone} onApply={apply} onRestore={restore} onDone={done} onSaveRule={saveRule} onDeleteRule={deleteRule}/>}
<footer className="page-footer">{t("Corporate, Area, dan IJR Monitoring ·")}{rows.length.toLocaleString()} {kind === 'piloting' ? t("records") : t("records · Memo SLA efektif 14 Juli 2025")}</footer></main></div>;
}
