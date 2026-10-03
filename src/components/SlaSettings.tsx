import { useState } from 'react';
import { type SlaRule } from '../types';
import { Panel } from './Charts';
export default function SlaSettings({ rules, canEdit, onSave, onDelete }: {
    rules: SlaRule[];
    canEdit: boolean;
    onSave: (r: SlaRule) => Promise<void>;
    onDelete: (product: string) => Promise<void>;
}) {
    const [rule, setRule] = useState<SlaRule>({ product: '', name: '', aliases: '', newDays: 3, maintDays: 2 }), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
    async function save(e: React.FormEvent) { e.preventDefault(); setBusy(true); try {
        await onSave({ ...rule, name: rule.name || rule.product });
        setMessage('Custom SLA tersimpan. Semua perhitungan diperbarui.');
    }
    catch (e) {
        setMessage(e instanceof Error ? e.message : 'Gagal menyimpan.');
    }
    finally {
        setBusy(false);
    } }
    return <Panel title="Custom SLA Settings" hint="Target tambahan untuk produk yang belum memiliki mapping pada memo."><form onSubmit={save}><div className="filters"><label>Product / Pengajuan<input required value={rule.product} onChange={e => setRule({ ...rule, product: e.target.value })}/></label><label>Nama solusi<input value={rule.name} onChange={e => setRule({ ...rule, name: e.target.value })}/></label><label>Aliases (pisahkan koma)<input value={rule.aliases} onChange={e => setRule({ ...rule, aliases: e.target.value })}/></label><label>New Project (hari)<input type="number" min="1" max="365" required value={rule.newDays} onChange={e => setRule({ ...rule, newDays: Number(e.target.value) })}/></label><label>Maintenance (hari)<input type="number" min="1" max="365" required value={rule.maintDays} onChange={e => setRule({ ...rule, maintDays: Number(e.target.value) })}/></label></div><button className="primary" disabled={!canEdit || busy}>Simpan Custom SLA</button></form>{message && <p role="status">{message}</p>}<div className="table-scroll"><table><thead><tr><th>Produk</th><th>Nama solusi</th><th>Aliases</th><th>New</th><th>Maintenance</th><th /></tr></thead><tbody>{rules.map(r => <tr key={r.product}><td>{r.product}</td><td>{r.name}</td><td>{r.aliases}</td><td>{r.newDays}</td><td>{r.maintDays}</td><td><button className="text-button" onClick={() => setRule(r)}>Edit</button><button className="text-button danger" disabled={!canEdit} onClick={() => onDelete(r.product).catch(e => setMessage(String(e)))}>Hapus</button></td></tr>)}</tbody></table></div></Panel>;
}
