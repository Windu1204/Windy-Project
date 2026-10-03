export type DatasetKind = 'ijr' | 'regional' | 'corporate';
export type ApplicationKind = DatasetKind | 'piloting';
export type Value = string | number | boolean | null | undefined;
export type Payload = Record<string, Value>;
export type SlaStatus = 'Within SLA' | 'Overdue' | 'Without SLA' | 'SLA Real Unavailable';
export interface SlaResult {
    target: number | null;
    real: number | null;
    status: SlaStatus;
    over: number | null;
    solution: string | null;
    map?: string;
}
export interface SlaRule {
    product: string;
    name: string;
    aliases: string;
    newDays: number;
    maintDays: number;
}
export interface Match {
    target: number;
    solution: string;
    map: string;
}
export interface MonitoringRecord {
    id: string;
    payload: Payload;
    sla: SlaResult;
}
export interface Filters {
    search: string;
    from: string;
    to: string;
    period: string;
    status: string;
    type: string;
    region: string;
    category: string;
    product: string;
    person: string;
    sla: string;
    flow: string;
    branch: string;
}
export type FilterKey = keyof Filters;
export type Role = 'admin' | 'editor' | 'viewer';
export interface Membership {
    workspace_id: string;
    role: Role;
    wci_workspaces: {
        name: string;
    };
}
export const emptyFilters: Filters = { search: '', from: '', to: '', period: '', status: '', type: '', region: '', category: '', product: '', person: '', sla: '', flow: '', branch: '' };
export const datasetTitles: Record<ApplicationKind, string> = { ijr: 'IJR - BNIdirect', regional: 'Regional - Non BNIDirect', corporate: 'Corporate - Non Piloting', piloting: 'Corporate - Piloting' };
export const text = (value: Value) => String(value ?? '').trim();
