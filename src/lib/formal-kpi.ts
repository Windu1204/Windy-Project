import { supabase } from './supabase';
import { type KpiSnapshot, type KpiPerson } from '../domain/formal-kpi';
function db(){if(!supabase)throw new Error('Koneksi KPI belum tersedia.');return supabase;}
export async function loadKpi(workspace:string,period:string,asUser?:string,annual=false):Promise<KpiSnapshot> {
  const {data,error}=await (annual
    ? db().rpc('wci_kpi_read_year',{p_workspace:workspace,p_year:Number(period.slice(0,4)),p_as:asUser||null})
    : db().rpc('wci_kpi_read',{p_workspace:workspace,p_period:period+'-01',p_as:asUser||null}));
  if(error)throw error;
  return data as KpiSnapshot;
}
export interface KpiChange { indicator_key:string; target:string; actual:number|null; note:string; expected:string|null }
export async function saveKpi(workspace:string,person:string,period:string,changes:KpiChange[]) {
  const {error}=await db().rpc('wci_kpi_save',{p_workspace:workspace,p_person:person,p_period:period+'-01',p_changes:changes});
  if(error)throw error;
}
export async function saveKpiPerson(workspace:string,person:Partial<KpiPerson>) {
  const {error}=await db().rpc('wci_kpi_save_person',{p_workspace:workspace,p_person:person});
  if(error)throw error;
}
