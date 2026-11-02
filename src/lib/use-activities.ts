import {useEffect,useState} from 'react';
import {type ApplicationKind} from '../types';
import {type Activity} from '../domain/activities';
import {loadActivities} from './activities';
export function useActivities(workspace:string,kind:ApplicationKind,revision:number,asUser?:string,preview=false,sessionUser?:string){
 const scope=[workspace,kind,asUser||'',preview,sessionUser||''].join('|'),[state,setState]=useState<{scope:string;rows:Activity[]}>({scope:'',rows:[]}),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 useEffect(()=>{let active=true;setError('');if(preview||!workspace||!['ijr','regional'].includes(kind)){setState({scope,rows:[]});setLoading(false);return;}
  setLoading(true);loadActivities(workspace,kind as 'ijr'|'regional',asUser).then(rows=>{if(active)setState({scope,rows});}).catch(e=>{if(active)setError(e instanceof Error?e.message:String(e));}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};
 },[workspace,kind,revision,asUser,preview,scope,sessionUser]);
 return {rows:state.scope===scope?state.rows:[],loading,error};
}
