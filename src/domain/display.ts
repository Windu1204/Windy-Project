import { type MonitoringRecord, type DatasetKind, type Value, text } from '../types';

export const productKey = (value: Value) => text(value).toLowerCase().replace(/[^a-z0-9]+/g, '');
/** v78 uses the most frequent spelling for Regional product variants. */
export function regionalProductLabels(rows: MonitoringRecord[]) {
  const groups = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const raw = text(row.payload.product), key = productKey(raw);
    if (!key) continue;
    const group = groups.get(key) || new Map<string, number>();
    group.set(raw, (group.get(raw) || 0) + 1); groups.set(key, group);
  }
  return new Map([...groups].map(([key, values]) => [key, [...values].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0]]));
}
const ijrDetail = ['Reg No', 'Application Number', 'Application Type', 'Applicant Name', 'Status', 'Flow Process', 'Total Day', 'Total Day Cabang', 'Total Day TBS', 'Request Date', 'Unit Pembuka', 'Cabang', 'Wilayah', 'CS BNI Direct', 'Implementor 1', 'Implementor 2'];
const regionalDetail: [string, string][] = [['Company','company'],['CID','cid'],['Wilayah','region'],['New / Maintenance','type'],['TB Produk','product'],['Implementor (HO)','implementor'],['Status','status'],['Dashboard Done Date','dashboardUpdatedAt'],['Keterangan Update','dashboardNote'],['Tanggal Email Sales','salesDate'],['Tanggal Approval','approvalDate'],['Tanggal Dokumen Lengkap','docComplete'],['Tanggal Selesai Setting','settingDone'],['Tanggal Informasi ke Nasabah','customerInfo'],['Tanggal Training','training'],['Keterangan','remarks'],['Informasi Handover','handover']];
const corporateDetail: [string, string][] = [['No Reg','noreg'],['Company','company'],['Group','group'],['CID','cid'],['CIF','cif'],['PIC Sales','sales'],['Segment','segment'],['Project Type','projectType'],['Product','product'],['Form Type','formType'],['Request Type','requestType'],['Status Onboard','status'],['Priority','priority'],['Progress','percentage'],['Complexity','complexity'],['Implementor','implementor'],['Assigner','assigner'],['SLA Policy Reference Date','slaPolicyDate'],['Create Date','createDate'],['Submit Date','submitDate'],['Assign Date','assignDate'],['Progress Date','progressDate'],['Done Date','doneDate'],['Handover Date','handoverDate'],['Target Done','targetDone'],['Return Date','returnDate'],['Return Note','returnNote'],['Description','description'],['Other Remarks','remarks']];
export function detailFields(row: MonitoringRecord, kind: DatasetKind): [string, string][] {
  const definitions: [string, string][] = kind === 'ijr' ? ijrDetail.map(key => [key, key]) : kind === 'regional' ? regionalDetail : corporateDetail;
  const values: [string, string][] = definitions.map(([label, key]) => [label, text(row.payload[key])]);
  if (kind === 'corporate') values.splice(17, 0, ['SLA Solution Mapping', row.sla.solution || ''], ['SLA Target', row.sla.target == null ? '' : row.sla.target + ' working days'], ['SLA Real', row.sla.real == null ? '' : row.sla.real + ' days'], ['SLA Status', row.sla.status], ['Over By', row.sla.over && row.sla.over > 0 ? row.sla.over + ' days' : ''], ['Mapping Method', row.sla.map || '']);
  if (kind === 'regional' && row.payload.dashboardUpdatedAt) values.splice(9, 0, ['Updated via', 'Dashboard']);
  return values.filter(([, value]) => value && value !== 'null Hari');
}
