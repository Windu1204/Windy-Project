import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { type MonitoringRecord, text } from '../types';
import { useLanguage } from '../lib/language';

export function TaskDoneDialog({ row, onClose, onSave }: { row: MonitoringRecord; onClose: () => void; onSave: (note: string) => Promise<void> }) {
  const { t, language } = useLanguage();
  const ref = useRef<HTMLDialogElement>(null);
  const [note, setNote] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => { ref.current?.showModal(); }, []);
  const updated = new Date(text(row.payload.dashboardUpdatedAt));
  const details = [
    ['Perusahaan', text(row.payload.company)], ['CID', text(row.payload.cid)],
    ['Produk', text(row.payload.product)], ['Implementor', text(row.payload.implementor)],
    ['Status', text(row.payload.status)],
    ['Terakhir Diperbarui', Number.isFinite(updated.getTime()) ? updated.toLocaleString(language === 'en' ? 'en-GB' : 'id-ID') : '—'],
  ];
  async function save() {
    if (busy) return;
    setBusy(true); setError('');
    try { await onSave(note); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); setBusy(false); }
  }
  return <dialog ref={ref} className="task-done-dialog" aria-labelledby="task-done-title" onCancel={e => { e.preventDefault(); if (!busy) onClose(); }} onClose={onClose}>
    <div className="dialog-head"><h3 id="task-done-title">{t('Selesaikan pekerjaan ini?')}</h3><button className="icon-button" aria-label={t('Tutup')} disabled={busy} onClick={onClose}><X size={20}/></button></div>
    <div className="detail-grid">{details.map(([label, value]) => <div key={label}><small>{t(label)}</small><p>{value || '—'}</p></div>)}</div>
    <label>{t('Catatan (opsional)')}<textarea autoFocus rows={3} maxLength={500} value={note} disabled={busy} onChange={e => setNote(e.target.value)}/></label>
    {error && <p role="alert" className="error">{error}</p>}
    <div className="button-row"><button className="secondary" disabled={busy} onClick={onClose}>{t('Batal')}</button><button className="primary" disabled={busy} onClick={save}>{t(busy ? 'Menyimpan…' : 'Konfirmasi Done')}</button></div>
  </dialog>;
}
