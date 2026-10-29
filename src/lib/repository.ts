import { supabase } from './supabase';
import { SessionCache } from './session-cache';
import { type ApplicationKind, type Payload, type Membership, type SlaRule } from '../types';
export interface StoredRow {
    id: string;
    payload: Payload;
    position: number;
}
const client = () => { if (!supabase)
    throw new Error('Supabase belum dikonfigurasi.'); return supabase; };
const snapshots = new SessionCache<{ rows: StoredRow[]; rules: SlaRule[] }>();
export function clearSessionCache() { snapshots.clear(); }
export async function workspaceRevision(workspace: string) {
    const { data, error } = await client().from('wci_events').select('revision').eq('workspace_id', workspace).maybeSingle();
    if (error) throw error;
    return data ? String(data.revision) : null;
}
/** Verify revision and rules even on a cache hit; never cache across authenticated users. */
export async function loadSnapshot(workspace: string, kind: ApplicationKind, version: string, owner: string) {
    const key = JSON.stringify([owner, workspace, kind, version]);
    for (let attempt = 0; attempt < 3; attempt++) {
        const [before, rules, batch] = await Promise.all([workspaceRevision(workspace), loadRules(workspace, kind), activeBatch(workspace, kind, version)]);
        if (!owner || before === null) return { rows: await readBatch(workspace, kind, batch), rules };
        const stamp = JSON.stringify([before, rules, batch]);
        const snapshot = await snapshots.load(key, stamp, async () => {
            const rows = await readBatch(workspace, kind, batch);
            if (await workspaceRevision(workspace) !== before || await activeBatch(workspace, kind, version) !== batch) throw new Error('WCI_REVISION_CHANGED');
            return { rows, rules };
        }).catch(error => {
            if (error instanceof Error && error.message === 'WCI_REVISION_CHANGED') return null;
            throw error;
        });
        if (snapshot) return snapshot;
    }
    throw new Error('Data sedang diperbarui. Silakan muat ulang untuk mendapatkan data terbaru.');
}
export async function memberships(): Promise<Membership[]> { const { data, error } = await client().from('wci_members').select('workspace_id,role,wci_workspaces(name)'); if (error)
    throw error; return data as unknown as Membership[]; }
async function activeBatch(workspace: string, kind: ApplicationKind, version?: string): Promise<string | null> {
    const { data: dataset, error } = await client().from('wci_datasets').select('active_batch,operational_batch,data_mode').eq('workspace_id', workspace).eq('kind', kind).maybeSingle();
    if (error) throw error;
    return version || (dataset?.data_mode === 'operational' ? dataset.operational_batch : dataset?.active_batch) || null;
}
export async function loadRows(workspace: string, kind: ApplicationKind, version?: string): Promise<StoredRow[]> {
    return readBatch(workspace, kind, await activeBatch(workspace, kind, version));
}
async function readBatch(workspace: string, kind: ApplicationKind, batch: string | null): Promise<StoredRow[]> {
    if (!batch) return [];
    const out: StoredRow[] = [];
    let total: number | null = null;
    for (let offset = 0;;) {
        const { data, error, count } = await client().from('wci_records')
            .select('id,payload,position', offset === 0 ? { count: 'exact' } : {})
            .eq('workspace_id', workspace).eq('dataset', kind).eq('batch_id', batch)
            .order('position').order('id').range(offset, offset + 999);
        if (error) throw error;
        if (offset === 0) total = count ?? null;
        if (!data?.length) {
            if (total !== null && out.length < total) throw new Error('Data belum termuat lengkap. Silakan muat ulang.');
            break;
        }
        out.push(...data as StoredRow[]);
        offset += data.length;
        if (total !== null ? offset >= total : data.length < 1000) break;
    }
    return out;
}
export async function loadRules(workspace: string, kind:ApplicationKind): Promise<SlaRule[]> { const { data, error } = await client().from('wci_sla_rules').select('product,name,aliases,new_days,maint_days').eq('workspace_id', workspace).eq('dataset',kind); if (error)
    throw error; return data.map(r => ({ product: r.product, name: r.name, aliases: r.aliases, newDays: r.new_days, maintDays: r.maint_days })); }
export async function replaceRows(workspace: string, kind: ApplicationKind, rows: Payload[], name: string) { const { error } = await client().rpc('wci_replace_dataset', { p_workspace: workspace, p_kind: kind, p_rows: rows, p_name: name }); if (error)
    throw error; }
export async function restoreRows(workspace: string, kind: ApplicationKind) { const { error } = await client().rpc('wci_restore_original', { p_workspace: workspace, p_kind: kind }); if (error)
    throw error; }
export async function markDone(workspace:string,id:string,_payload:Payload,note:string,update?:import('../domain/regional-progress').RegionalUpdate){
 const {error}=await client().rpc('wci_regional_progress',{p_workspace:workspace,p_id:id,p_action:update?.action||'done',p_company_id:update?.companyId?.trim()||null,p_note:note});if(error)throw error;
}
export async function saveRule(workspace: string, r: SlaRule,kind:ApplicationKind) { const { error } = await client().from('wci_sla_rules').upsert({ workspace_id: workspace,dataset:kind, product: r.product, name: r.name, aliases: r.aliases, new_days: r.newDays, maint_days: r.maintDays }, { onConflict: 'workspace_id,dataset,product' }); if (error)
    throw error; }
export async function deleteRule(workspace: string, product: string,kind:ApplicationKind) { const { error } = await client().from('wci_sla_rules').delete().eq('workspace_id', workspace).eq('product', product).eq('dataset',kind); if (error)
    throw error; }
