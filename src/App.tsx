import { useLanguage } from './lib/language';
import { useEffect, useState, useMemo, useCallback, lazy, Suspense } from 'react';
import { type User } from '@supabase/supabase-js';
import { ChartNoAxesCombined, Building2, Network, LogOut, RefreshCw, UserRound, ArrowUpRight } from 'lucide-react';
import { type ApplicationKind, type SlaRule, type Payload, type MonitoringRecord, type Membership, datasetTitles } from './types';
import { calculateSla } from './domain/sla';
import { supabase } from './lib/supabase';
import * as repository from './lib/repository';
import { Auth } from './components/Auth';
import Dashboard from './components/Dashboard';
const PilotingDashboard = lazy(() => import('./piloting/PilotingDashboard'));
export default function App() { const { t, language, setLanguage } = useLanguage(); 
    const [user, setUser] = useState<User | null>(null), [authLoading, setAuthLoading] = useState(true), [preview, setPreview] = useState(false), [kind, setKind] = useState<ApplicationKind>('ijr'), [members, setMembers] = useState<Membership[]>([]), [workspace, setWorkspace] = useState(''), [raw, setRaw] = useState<repository.StoredRow[]>([]), [original, setOriginal] = useState<repository.StoredRow[]>([]), [rules, setRules] = useState<SlaRule[]>([]), [loading, setLoading] = useState(false), [error, setError] = useState(''), [refresh, setRefresh] = useState(0), [profile, setProfile] = useState(false), [displayName, setDisplayName] = useState('');
    useEffect(() => { if (!supabase) {
        setAuthLoading(false);
        return;
    } let active = true; supabase.auth.getUser().then(({ data }) => { if (active) {
        setUser(data.user);
        setAuthLoading(false);
    } }); const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { setUser(session?.user || null); setAuthLoading(false); }); return () => { active = false; subscription.unsubscribe(); }; }, []);
    useEffect(() => { if (!user) {
        setMembers([]);
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
        return; let active = true; setLoading(true); setError(''); setRaw([]); const load = preview ? (async () => { const response = await fetch('/__local-data/' + kind); if (!response.ok)
        throw new Error('File source lokal tidak tersedia.'); const payload = await response.json() as Payload[]; return { rows: payload.map((p, i) => ({ id: kind + '-' + i, payload: p, position: i + 1 })), rules: [] as SlaRule[] }; })() : Promise.all([repository.loadRows(workspace, kind), repository.loadRules(workspace)]).then(([rows, rules]) => ({ rows, rules })); load.then(result => { if (active) {
        setRaw(result.rows);
        setOriginal(result.rows);
        setRules(result.rules);
    } }).catch(e => { if (active)
        setError(e.message); }).finally(() => { if (active)
        setLoading(false); }); return () => { active = false; }; }, [kind, workspace, preview, refresh]);
    const rows = useMemo<MonitoringRecord[]>(() => raw.map(r => ({ id: r.id, payload: r.payload, sla: kind === 'piloting' ? { target: null, real: null, status: 'Without SLA' as const, over: null, solution: null } : calculateSla(r.payload, kind, rules) })), [raw, kind, rules]);
    const membership = members.find(m => m.workspace_id === workspace), canEdit = preview || membership?.role === 'editor' || membership?.role === 'admin';
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
    } await repository.saveRule(workspace, r); setRules(await repository.loadRules(workspace)); }
    async function deleteRule(product: string) { if (preview) {
        setRules(a => a.filter(x => x.product !== product));
        return;
    } await repository.deleteRule(workspace, product); setRules(await repository.loadRules(workspace)); }
    async function logout() { if (supabase && !preview) {
        const { error } = await supabase.auth.signOut();
        if (error) {
            setError(error.message);
            return;
        }
    } setPreview(false); setUser(null); setRaw([]); setRules([]); setProfile(false); setError(''); }
    async function saveProfile() { const { error } = await supabase!.auth.updateUser({ data: { display_name: displayName } }); if (error)
        setError(error.message);
    else {
        setUser((await supabase!.auth.getUser()).data.user);
        setProfile(false);
    } }
    if (authLoading)
        return <div className="loading-page">{t("Memuat workspace…")}</div>;
    if (!user && !preview)
        return <Auth onPreview={() => { setPreview(true); setError(''); }}/>;
    const name = preview ? 'Local Preview' : user?.user_metadata.display_name || user?.email || 'User';
    return <div className="app-shell"><aside className="side sidebar"><div className="side-left-edge-mask" aria-hidden="true"/><div className="brand"><div className="bni-logo" role="img" aria-label={t("BNI")}/><b>{t("Corporate, Area, dan IJR Monitoring")}</b></div><nav aria-label={t("Pilih dashboard")}>{(['ijr', 'regional', 'corporate', 'piloting'] as ApplicationKind[]).map((key, i) => { const Icon = [ChartNoAxesCombined, Network, Building2, Building2][i]; return <button key={key} className={'nav ' + (kind === key ? 'active' : '')} onClick={() => setKind(key)}><span className="side-ico"><Icon size={19}/></span>{datasetTitles[key]}{kind === key && <ArrowUpRight size={15}/>}</button>; })}</nav><div className="side-building" aria-hidden="true"/><div className="side-wave" aria-hidden="true"/><div className="foot">{t("Unified corporate monitoring")}</div></aside><main className="main"><header className="topbar"><div><p className="eyebrow">{t("MONITORING DASHBOARD")}</p><h2 className="dashboard-title"><span aria-hidden="true">{kind === 'ijr' ? <ChartNoAxesCombined size={24}/> : kind === 'regional' ? <Network size={24}/> : <Building2 size={24}/>}</span>{datasetTitles[kind]}</h2><p className="muted">{t("Pantau request, implementasi, dan pencapaian SLA.")}</p></div><div className="header-actions">{members.length > 1 && <select aria-label={t("Workspace")} value={workspace} onChange={e => setWorkspace(e.target.value)}>{members.map(m => <option key={m.workspace_id} value={m.workspace_id}>{m.wci_workspaces.name}</option>)}</select>}<button className="icon-button" aria-label={t("Refresh data")} onClick={reload}><RefreshCw size={17}/></button><div className="account-area"><button className="profile-button" onClick={() => { setProfile(!profile); setDisplayName(String(user?.user_metadata.display_name || '')); }}><span>{String(name).slice(0, 2).toUpperCase()}</span><div><b>{name}</b><small>{preview ? t('Preview lokal') : membership?.role || t('Menunggu akses')}</small></div><UserRound size={17}/></button><select className="language-picker" aria-label="Bahasa / Language" value={language} onChange={event => setLanguage(event.target.value === 'en' ? 'en' : 'id')}><option value="id">Indonesia</option><option value="en">English</option></select></div><button className="icon-button" aria-label={t("Logout")} onClick={logout}><LogOut size={18}/></button></div></header>{profile && <section className="profile-panel"><h3>{t("Profile")}</h3><p>{user?.email || 'Preview lokal'}</p>{!preview && <><label>{t("Nama tampilan")}<input value={displayName} onChange={e => setDisplayName(e.target.value)}/></label><button className="primary" onClick={saveProfile}>{t("Simpan profile")}</button></>}<button className="secondary" onClick={() => setProfile(false)}>{t("Tutup")}</button></section>}{preview && <div className="preview-banner">{t("Preview lokal · perubahan hanya berlaku selama sesi ini. Data bersama menggunakan Supabase setelah sign-in.")}</div>}{error && <div className="error" role="alert">{error}<button className="text-button" onClick={reload}>{t("Coba lagi")}</button></div>}{loading ? <p className="empty">{t("Memuat data…")}</p> : kind === 'piloting' ? <Suspense fallback={<p className="empty">{t('Memuat tampilan…')}</p>}><PilotingDashboard key={kind + '-' + workspace} rows={rows} canEdit={canEdit} onApply={apply} onRestore={restore}/></Suspense> : <Dashboard key={kind + '-' + workspace} kind={kind} rows={rows} rules={rules} canEdit={canEdit} onApply={apply} onRestore={restore} onDone={done} onSaveRule={saveRule} onDeleteRule={deleteRule}/>}<footer className="page-footer">{t("Corporate, Area, dan IJR Monitoring ·")}{rows.length.toLocaleString()} {kind === 'piloting' ? t("records") : t("records · Memo SLA efektif 14 Juli 2025")}</footer></main></div>;
}
