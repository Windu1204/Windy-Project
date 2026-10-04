import { supabase } from './supabase';
import { type ApplicationKind, type Payload, type Membership, type SlaRule } from '../types';
export interface StoredRow {
    id: string;
    payload: Payload;
    position: number;
}
const client = () => { if (!supabase)
    throw new Error('Supabase belum dikonfigurasi.'); return supabase; };
export async function memberships(): Promise<Membership[]> { const { data, error } = await client().from('wci_members').select('workspace_id,role,wci_workspaces(name)'); if (error)
    throw error; return data as unknown as Membership[]; }
export async function loadRows(workspace: string, kind: ApplicationKind, version?:string): Promise<StoredRow[]> {
    const db = client();
    const { data: dataset, error } = await db.from('wci_datasets').select('active_batch,operational_batch,data_mode').eq('workspace_id', workspace).eq('kind', kind).maybeSingle();
    if (error)
        throw error;
    const batch=version||(dataset?.data_mode==='operational'?dataset.operational_batch:dataset?.active_batch);
    if (!batch)
        return [];
    const out: StoredRow[] = [];
    for (let offset = 0;; offset += 1000) {
        const { data, error } = await db.from('wci_records').select('id,payload,position').eq('workspace_id', workspace).eq('dataset', kind).eq('batch_id', batch).order('position').range(offset, offset + 999);
        if (error)
            throw error;
        out.push(...data as StoredRow[]);
        if (data.length < 1000)
            break;
    }
    return out;
}
export async function loadRules(workspace: string, kind:ApplicationKind): Promise<SlaRule[]> { const { data, error } = await client().from('wci_sla_rules').select('product,name,aliases,new_days,maint_days').eq('workspace_id', workspace).eq('dataset',kind); if (error)
    throw error; return data.map(r => ({ product: r.product, name: r.name, aliases: r.aliases, newDays: r.new_days, maintDays: r.maint_days })); }
export async function replaceRows(workspace: string, kind: ApplicationKind, rows: Payload[], name: string) { const { error } = await client().rpc('wci_replace_dataset', { p_workspace: workspace, p_kind: kind, p_rows: rows, p_name: name }); if (error)
    throw error; }
export async function restoreRows(workspace: string, kind: ApplicationKind) { const { error } = await client().rpc('wci_restore_original', { p_workspace: workspace, p_kind: kind }); if (error)
    throw error; }
export async function markDone(workspace: string, id: string, _payload: Payload, note: string) { const { error } = await client().rpc('wci_mark_done',{p_workspace:workspace,p_id:id,p_note:note}); if (error)
    throw error; }
export async function saveRule(workspace: string, r: SlaRule,kind:ApplicationKind) { const { error } = await client().from('wci_sla_rules').upsert({ workspace_id: workspace,dataset:kind, product: r.product, name: r.name, aliases: r.aliases, new_days: r.newDays, maint_days: r.maintDays }, { onConflict: 'workspace_id,dataset,product' }); if (error)
    throw error; }
export async function deleteRule(workspace: string, product: string,kind:ApplicationKind) { const { error } = await client().from('wci_sla_rules').delete().eq('workspace_id', workspace).eq('product', product).eq('dataset',kind); if (error)
    throw error; }
