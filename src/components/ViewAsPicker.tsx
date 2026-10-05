import {useState} from 'react';
import {type Profile,type AccessRole,type adminDirectory,roleNames} from '../lib/access';
import {datasetTitles} from '../types';
import {useLanguage} from '../lib/language';
type Directory=Awaited<ReturnType<typeof adminDirectory>>;
export function ViewAsPicker({directory,onSelect}:{directory:Directory;onSelect:(profile:Profile)=>void}){
 const {t}=useLanguage(),[role,setRole]=useState<AccessRole|''>('');
 const roles:AccessRole[]=['department_head','team_leader','individual'];
 const accounts=directory.profiles.filter(p=>p.active&&p.role===role).sort((a,b)=>a.name.localeCompare(b.name));
 const context=(id:string)=>[...new Set(directory.grants.filter(g=>g.user_id===id).map(g=>{
  const team=directory.teams.find(team=>team.id===g.team_id);
  return datasetTitles[g.dataset]+(g.dataset==='piloting'?' · '+g.source:'')+(team?' · '+team.name:'');
 }))].join(' / ');
 return <div className="view-as-picker"><label>{t('Role')}<select aria-label={t('Pilih role untuk dilihat')} value={role} onChange={e=>setRole(e.target.value as AccessRole|'')}><option value="">{t('Pilih role')}</option>{roles.map(value=><option key={value} value={value}>{roleNames[value]}</option>)}</select></label><label>{t('Pengguna')}<select key={role} aria-label={t('Pilih pengguna untuk dilihat')} defaultValue="" disabled={!role} onChange={e=>{const profile=accounts.find(p=>p.user_id===e.target.value);if(profile)onSelect(profile);}}><option value="">{t(role&&!accounts.length?'Tidak ada pengguna untuk role ini.':'Pilih pengguna')}</option>{accounts.map(profile=><option key={profile.user_id} value={profile.user_id}>{profile.name}{context(profile.user_id)?' · '+context(profile.user_id):''}</option>)}</select></label></div>;
}
