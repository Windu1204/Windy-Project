import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { type MonitoringRecord, text } from '../types';
import { useLanguage } from '../lib/language';
import {regionalActions,type RegionalAction} from '../domain/regional-progress';
import { jakartaToday, workingDays } from '../domain/work-calendar';

export function TaskDoneDialog({ row, action='done', onClose, onSave }: { row: MonitoringRecord; action?:RegionalAction; onClose: () => void; onSave: (note: string,companyId?:string) => Promise<void> }) {
  const { t, language } = useLanguage();
  const ref = useRef<HTMLDialogElement>(null);
  const isNew=regionalActions(row.payload).isNew;
  const [companyId,setCompanyId]=useState(text(row.payload.companyId));
  const [note, setNote] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => { ref.current?.showModal(); }, []);
  const doneDate=regionalActions(row.payload).done?text(row.payload.doneDate)||jakartaToday():jakartaToday();
  const updated = new Date(text(row.payload.dashboardUpdatedAt));
  const details = [
    ['Perusahaan', text(row.payload.company)], ['Company ID',text(row.payload.companyId)], ['CID', text(row.payload.cid)],
    ['Produk', text(row.payload.product)], ['Implementor', text(row.payload.implementor)],
    ['Status', text(row.payload.status)],
    ['Email Sales', text(row.payload.salesDate)], ['Dokumen Lengkap', text(row.payload.docComplete)],
    ['Selesai Setting', text(row.payload.settingDone)], ['Approval', text(row.payload.approvalDate)],
    ['Tanggal Done',doneDate], ['SLA hari kerja', String((action==='handover'?row.sla.real:workingDays(row.payload.docComplete,doneDate)) ?? '—')],
    ['Info Nasabah', text(row.payload.customerInfo)], ['Training', text(row.payload.training)],
    ['Handover', text(row.payload.handover)],
    ['Terakhir Diperbarui', Number.isFinite(updated.getTime()) ? updated.toLocaleString(language === 'en' ? 'en-GB' : 'id-ID') : '—'],
  ];
  const primary=new Set(['Perusahaan','Produk','Implementor','Status','Tanggal Done','SLA hari kerja',...(action==='handover'?['Company ID']:[])]);
  const grid=(items:string[][])=><div className="detail-grid">{items.map(([label,value])=><div key={label}><small>{t(label)}</small><p>{value||'—'}</p></div>)}</div>;
  async function save() {
    if (busy) return;
    if(isNew&&!companyId.trim()){setError(t('Company ID wajib diisi untuk pengajuan New'));return;}
    setBusy(true); setError('');
    try { await onSave(note,isNew?companyId.trim():undefined); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); setBusy(false); }
  }
  return <dialog ref={ref} className="task-done-dialog" aria-labelledby="task-done-title" onCancel={e => { e.preventDefault(); if (!busy) onClose(); }} onClose={onClose}>
    <div className="dialog-head"><h3 id="task-done-title">{t(action==='handover'?'Konfirmasi Handover':'Selesaikan pekerjaan ini?')}</h3><button className="icon-button" aria-label={t('Tutup')} disabled={busy} onClick={onClose}><X size={20}/></button></div>
    {grid(details.filter(([label])=>primary.has(label)))}
    <details><summary>{t('Lihat rincian pekerjaan')}</summary>{grid(details.filter(([label])=>!primary.has(label)))}</details>
    {isNew&&action==='done'&&<label>{t('Company ID')}<input autoFocus required maxLength={100} value={companyId} disabled={busy} onChange={e=>{setCompanyId(e.target.value);setError('');}}/></label>}
    {action==='handover'&&<p>{t('Pekerjaan sudah Done. Handover tidak mengubah tanggal Done atau durasi SLA.')}</p>}
    {action==='done'&&<label>{t('Catatan (opsional)')}<textarea autoFocus={!isNew} rows={3} maxLength={500} value={note} disabled={busy} onChange={e => setNote(e.target.value)}/></label>}
    {error && <p role="alert" className="error">{error}</p>}
    <div className="button-row"><button className="secondary" disabled={busy} onClick={onClose}>{t('Batal')}</button><button className="primary" disabled={busy} onClick={save}>{t(busy ? 'Menyimpan…' : action==='handover'?'Konfirmasi Handover':'Konfirmasi Done')}</button></div>
  </dialog>;
}
