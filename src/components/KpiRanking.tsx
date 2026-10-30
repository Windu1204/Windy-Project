import {kpiGroups,type KpiSnapshot} from '../domain/formal-kpi';
import {kpiRanking,kpiScoringNote} from '../domain/kpi-ranking';
import {useLanguage} from '../lib/language';

export function KpiRanking({snapshot,period,annual,onSelect,disabled=false}:{snapshot:KpiSnapshot;period:string;annual:boolean;onSelect:(id:string)=>void;disabled?:boolean}){
 const {t}=useLanguage(),rows=kpiRanking(snapshot.people,snapshot.templates,snapshot.values,period,annual);
 const ranked=rows.filter(row=>row.rank!==null).length;
 return <section className="panel kpi-ranking" aria-label={t('Ranking KPI')}>
  <div className="table-heading"><div><h3>{t('Ranking KPI')}</h3><p className="muted">{t('Urutan capaian berbobot pegawai sesuai kelompok dan hak akses.')} {ranked} / {rows.length} {t('pegawai dapat dinilai')}</p></div></div>
  <div className="table-scroll"><table><thead><tr>{['Peringkat','Nama pegawai','Kelompok KPI','Nilai KPI berbobot',annual?'Bulan dinilai':'Indikator dinilai','Status penilaian'].map(h=><th key={h}>{t(h)}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.person.id}>
   <td><span className={row.rank!==null&&row.rank<=3?'kpi-rank top':'kpi-rank'}>{row.rank===null?'—':'#'+row.rank}</span></td>
   <td><button className="text-button" disabled={disabled} onClick={()=>onSelect(row.person.id)}>{row.person.name}</button><small>{row.person.npp||'—'} · {row.template.title}</small></td>
   <td>{kpiGroups[row.template.group_code]}</td>
   <td className="kpi-ranked-score">{row.score===null?'—':row.score.toLocaleString('id-ID',{minimumFractionDigits:2,maximumFractionDigits:4})+'%'}</td>
   <td>{annual?row.months+' / 12':row.assessed+' / '+row.total}</td>
   <td><span className={'badge '+(row.score===null?'neutral':'green')}>{t(!row.validWeights?'Periksa bobot indikator':row.score===null?'Data belum lengkap':annual?'Rata-rata bulan lengkap':'Lengkap')}</span></td>
  </tr>)}</tbody></table></div>
  <p className="kpi-ranking-note">{t(kpiScoringNote)} {t('Nilai sama mendapat peringkat sama.')} {annual&&t('Nilai tahunan adalah rata-rata bulan yang lengkap; bulan yang belum lengkap tidak dihitung sebagai nol.')}</p>
 </section>;
}
