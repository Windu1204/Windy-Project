import * as XLSX from 'xlsx';
import { type Payload, type Value, type DatasetKind, text } from '../types';
export interface RejectedRow {
    row: Payload;
    reason: string;
}
export interface ImportAudit {
    rows: Payload[];
    revisions: RejectedRow[];
    source: number;
    duplicates: number;
    invalidDates: number;
}
const canonical = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
export function pick(r: Payload, names: string[]): Value { for (const n of names) {
    const key = Object.keys(r).find(k => canonical(k) === canonical(n));
    if (key && text(r[key]))
        return r[key];
} return null; }
export function num(v: Value) { if (v == null || v === '')
    return null; const n = Number(String(v).replace(',', '.').replace(/[^0-9.\-]/g, '')); return Number.isFinite(n) ? n : null; }
export function dateVal(v: Value): string | null {
    if (v == null || v === '')
        return null;
    if (typeof v === 'number') {
        const d = XLSX.SSF.parse_date_code(v);
        return d ? `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}` : String(v);
    }
    const s = text(v), iso = s.match(/^(\d{4})[-/]([01]?\d)[-/]([0-3]?\d)/), short = s.match(/^([0-3]?\d)[-/]([01]?\d)[-/](\d{2,4})$/), word = s.match(/^([0-3]?\d)[\s\-/]([A-Za-z]{3,9})[\s\-/](\d{2,4})$/);
    const year = (y: string) => y.length === 2 ? (Number(y) < 70 ? '20' : '19') + y : y;
    if (iso)
        return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
    if (short)
        return `${year(short[3])}-${short[2].padStart(2, '0')}-${short[1].padStart(2, '0')}`;
    if (word) {
        const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        const m = months.indexOf(word[2].slice(0, 3).toLowerCase().replace('mei', 'may').replace('agu', 'aug').replace('okt', 'oct').replace('des', 'dec'));
        if (m >= 0)
            return `${year(word[3])}-${String(m + 1).padStart(2, '0')}-${word[1].padStart(2, '0')}`;
    }
    return s;
}
export function validDate(s: Value, regional = false) { if (!text(s))
    return true; const raw = text(s); if (!/^\d{4}-\d{2}-\d{2}$/.test(raw))
    return false; const d = new Date(raw + 'T00:00:00Z'); if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== raw)
    return false; return !regional || (raw >= '2000-01-01' && raw <= new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())); }
export function sheetRows(sheet: XLSX.WorkSheet, kind: DatasetKind): Payload[] {
    const grid = XLSX.utils.sheet_to_json<Value[]>(sheet, { header: 1, defval: null, raw: true });
    const ids = kind === 'ijr' ? ['Application Number', 'Application No', 'Application ID', 'No Aplikasi'] : kind === 'corporate' ? ['noreg', 'No Reg'] : ['company', 'NAMA PERUSAHAAN2', 'NAMA PERUSAHAAN'];
    let header = -1, score = 0;
    for (let i = 0; i < Math.min(100, grid.length); i++) {
        const cells = grid[i].map(v => canonical(text(v)));
        const n = (ids.some(a => cells.includes(canonical(a))) ? 4 : 0) + ['status', 'Status Onboard', 'Status Aplikasi', 'Application Status', 'product', 'TB Produk', 'jenisproduct', 'Request Date', 'Email Sales', 'tgl_create'].filter(a => cells.includes(canonical(a))).length;
        if (n > score) {
            header = i;
            score = n;
        }
    }
    if (header < 0 || score < 4)
        throw new Error('Header utama tidak ditemukan. Gunakan template atau file export dashboard.');
    const headers = grid[header].map(text);
    const names=headers.filter(Boolean).map(canonical);if(new Set(names).size!==names.length)throw new Error('Ada nama kolom ganda pada file. Periksa header sebelum upload.');
    return grid.slice(header + 1).filter(row => row.some(v => text(v))).map(row => Object.fromEntries(headers.filter(Boolean).map(h => [h, row[headers.indexOf(h)] ?? null])));
}
export function auditRows(raw: Payload[], kind: DatasetKind): ImportAudit {
    const all = normalize(raw, kind), rows: Payload[] = [], revisions: RejectedRow[] = [], seen = new Set<string>();
    let duplicates = 0, invalidDates = 0;
    for (const row of all) {
        const required = kind === 'ijr' ? ['Application Number', 'Status'] : kind === 'corporate' ? ['noreg', 'company', 'product', 'status'] : ['company', 'product', 'status'];
        const missing = required.filter(k => !text(row[k]));
        const dateKey = kind === 'ijr' ? 'Request Date' : kind === 'corporate' ? 'createDate' : 'salesDate';
        const invalid = !validDate(row[dateKey], kind === 'regional');
        if (invalid)
            invalidDates++;
        const id = kind === 'ijr' ? text(row['Application Number']) : kind === 'corporate' ? text(row.noreg) : ['company', 'cid', 'product', 'salesDate', 'status'].map(k => text(row[k]).toLowerCase()).join('|');
        if (!missing.length) {
            if (seen.has(id))
                duplicates++;
            seen.add(id);
        }
        if (missing.length || invalid)
            revisions.push({ row, reason: missing.length ? 'Field wajib kosong: ' + missing.join(', ') : dateKey + ' tidak valid' });
        else
            rows.push(row);
    }
    return { rows, revisions, source: all.length, duplicates, invalidDates };
}
function normalize_ijr(rows: Payload[]): Payload[] { return rows.map(r => { let x: Payload = { ...r }; x['Application Number'] = pick(r, ['Application Number', 'Application No', 'Application ID', 'No Aplikasi', 'Nomor Aplikasi']); x.Status = pick(r, ['Status', 'Application Status', 'Status Aplikasi']); x['Applicant Name'] = pick(r, ['Applicant Name', 'Applicant', 'Company', 'Company Name', 'Nama Perusahaan', 'Nama Applicant']); x.Wilayah = pick(r, ['Wilayah', 'Region', 'Regional', 'Area']); x['Implementor 1'] = pick(r, ['Implementor 1', 'Implementor', 'PIC', 'PIC Implementor']); x['Request Date'] = dateVal(pick(r, ['Request Date', 'request date', 'REQUEST DATE', 'Req Date', 'Tanggal Request', 'Tanggal Pengajuan', 'RequestDate'])); let age = (v: Value) => { if (v == null || String(v).toLowerCase().includes('null'))
    return null; let m = String(v).match(/-?\d+(?:\.\d+)?/); return m ? Number(m[0]) : null; }; x._TotalDayNum = age(pick(r, ['Total Day', '_TotalDayNum'])); x._CabangDayNum = age(pick(r, ['Total Day Cabang', '_CabangDayNum'])); x._TBSDayNum = age(pick(r, ['Total Day TBS', '_TBSDayNum'])); return x; }); }
function normalize_regional(rows: Payload[]): Payload[] { return rows.map(r => ({ ...r, company: pick(r, ['company', 'NAMA PERUSAHAAN2', 'NAMA PERUSAHAAN', 'Nama Perusahaan']), cid: pick(r, ['cid', 'CID']), region: pick(r, ['region', 'WILAYAH3', 'WILAYAH', 'Wilayah']), type: pick(r, ['type', 'New/Maintenance', 'NEW/MAINTENANCE']), product: pick(r, ['product', 'TB Produk', 'TB PRODUK', 'Produk']), implementor: pick(r, ['implementor', 'TB IMPLEMENTOR NAME (HEAD OFFICE)', 'IMPLEMENTOR', 'Implementor']), status: pick(r, ['status', 'STATUS', 'Status']), remarks: pick(r, ['remarks', 'KETERANGAN', 'Keterangan']), salesDate: dateVal(pick(r, ['salesDate', 'Email Sales', 'EMAIL SALES', 'Tanggal Email Sales'])), approvalDate: dateVal(pick(r, ['approvalDate', 'Approval', 'APPROVAL'])), docComplete: dateVal(pick(r, ['docComplete', 'Dokumen Lengkap', 'DOKUMEN LENGKAP'])), settingDone: dateVal(pick(r, ['settingDone', 'Selesai Setting', 'SELESAI SETTING'])), customerInfo: dateVal(pick(r, ['customerInfo', 'Info Nasabah', 'INFORMASI NASABAH'])), training: dateVal(pick(r, ['training', 'Training', 'TRAINING'])) })); }
function normalize_corporate(rows: Payload[]): Payload[] { return rows.map(r => { let x: Payload = { ...r, noreg: pick(r, ['noreg', 'noreg ', 'No Reg', 'NO REG']), group: pick(r, ['group', 'nama_group', 'NAMA GROUP']), company: pick(r, ['company', 'namaperusahaan', 'NAMA PERUSAHAAN']), cid: pick(r, ['cid', 'CID']), cif: pick(r, ['cif', 'CIF']), sales: pick(r, ['sales', 'pic_sales', 'PIC SALES']), segment: pick(r, ['segment', 'segmen', 'SEGMEN']), projectType: pick(r, ['projectType', 'tipe_project', 'TIPE PROJECT']), product: pick(r, ['product', 'jenisproduct', 'JENISPRODUCT', 'JENIS PRODUCT']), formType: pick(r, ['formType', 'jenisformulir']), requestType: pick(r, ['requestType', 'jenispermintaan']), formStatus: pick(r, ['formStatus', 'statusform']), validation: pick(r, ['validation', 'validasi']), priority: pick(r, ['priority', 'PRIORITY']), status: pick(r, ['status', 'status_onboard', 'STATUS ONBOARD']), percentage: pick(r, ['percentage', 'PERCENTAGE']), discrepancy: pick(r, ['discrepancy', 'flag_discrepancy']), complexity: pick(r, ['complexity', 'cplx']), implementor: pick(r, ['implementor', 'IMPLEMENTOR']), assigner: pick(r, ['assigner', 'ASSIGNER']), createDate: dateVal(pick(r, ['createDate', 'tgl_create', 'TGL CREATE'])), submitDate: dateVal(pick(r, ['submitDate', 'tgl_submit'])), assignDate: dateVal(pick(r, ['assignDate', 'tgl_assign'])), progressDate: dateVal(pick(r, ['progressDate', 'tgl_progress'])), doneDate: dateVal(pick(r, ['doneDate', 'tgl_done'])), handoverDate: dateVal(pick(r, ['handoverDate', 'tgl_handover'])), targetDone: dateVal(pick(r, ['targetDone', 'target_done'])), returnDate: dateVal(pick(r, ['returnDate', 'tgl_return'])), returnNote: pick(r, ['returnNote', 'return_note']), description: pick(r, ['description', 'deskripsi']), remarks: pick(r, ['remarks', 'keterangan']), sourceOutlier: pick(r, ['sourceOutlier', 'outlier_SLA']), slaHO: num(pick(r, ['slaHO', 'SLA_HO'])), slaReal: num(pick(r, ['slaReal', 'SLA_real'])) }; return x; }); }
export function normalize(rows: Payload[], kind: DatasetKind) { return kind === 'ijr' ? normalize_ijr(rows) : kind === 'regional' ? normalize_regional(rows) : normalize_corporate(rows); }
