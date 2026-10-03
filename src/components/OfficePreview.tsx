import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../lib/language';
import { saveBlob, type ReportFile } from '../lib/exports';
type Block = { text?: string; table?: string[][]; image?: string; x?: number; y?: number; w?: number; h?: number; size?: number; fill?: string; color?: string; bold?: boolean };
type Page = { blocks: Block[]; slide: boolean };
const nodes = (root: Document | Element, name: string) => Array.from(root.getElementsByTagNameNS('*', name));
const txt = (root: Element) => nodes(root, 't').map(n=>n.textContent||'').join('');
const xml = (s: string) => new DOMParser().parseFromString(s, 'application/xml');
function relative(base: string, target: string) { const parts=base.split('/').slice(0,-1);for(const part of target.split('/')){if(part==='..')parts.pop();else if(part!=='.')parts.push(part);}return parts.join('/'); }
async function readPages(file: ReportFile, urls: string[]): Promise<Page[]> {
  const X = await import('xlsx'), zip=X.CFB.read(new Uint8Array(await file.blob.arrayBuffer()),{type:'array'}) as {FullPaths:string[];FileIndex:{content:Uint8Array}[]};
  const files=new Map<string,Uint8Array>(zip.FullPaths.map((p,i)=>[p.replace(/^Root Entry\//,''),zip.FileIndex[i].content]));
  const read=(path:string)=>{const data=files.get(path);return data?new TextDecoder().decode(new Uint8Array(data)):'';};
  const image=(path:string)=>{const data=files.get(path);if(!data)return '';const ext=path.split('.').pop()?.toLowerCase(),mime=ext==='png'?'image/png':ext==='svg'?'image/svg+xml':ext==='jpeg'||ext==='jpg'?'image/jpeg':'';if(!mime)return '';const url=URL.createObjectURL(new Blob([new Uint8Array(data)],{type:mime}));urls.push(url);return url;};
  const rels=(path:string)=>{const dir=path.split('/').slice(0,-1).join('/'),name=path.split('/').pop();return new Map(nodes(xml(read(dir+'/_rels/'+name+'.rels')),'Relationship').filter(n=>n.getAttribute('TargetMode')!=='External').map(n=>[n.getAttribute('Id')||'',relative(path,n.getAttribute('Target')||'')]));};
  if(file.name.endsWith('.pptx')) {
    const dims=nodes(xml(read('ppt/presentation.xml')),'sldSz')[0],cw=Number(dims?.getAttribute('cx')||12192000),ch=Number(dims?.getAttribute('cy')||6858000);
    return [...files.keys()].filter(p=>/^ppt\/slides\/slide\d+\.xml$/.test(p)).sort((a,b)=>Number(a.match(/slide(\d+)/)?.[1])-Number(b.match(/slide(\d+)/)?.[1])).map(path=>{
      const doc=xml(read(path)),relations=rels(path),tree=nodes(doc,'spTree')[0],blocks:Block[]=[];
      for(const el of Array.from(tree?.children||[])) {
        if(!['sp','pic','graphicFrame'].includes(el.localName))continue;
        const xf=nodes(el,'xfrm')[0],off=xf&&nodes(xf,'off')[0],ext=xf&&nodes(xf,'ext')[0];
        const block:Block={x:100*Number(off?.getAttribute('x')||0)/cw,y:100*Number(off?.getAttribute('y')||0)/ch,w:100*Number(ext?.getAttribute('cx')||cw)/cw,h:100*Number(ext?.getAttribute('cy')||ch)/ch};
        const table=nodes(el,'tbl')[0],blip=nodes(el,'blip')[0],chart=nodes(el,'chart')[0];
        if(table)block.table=nodes(table,'tr').map(tr=>nodes(tr,'tc').map(txt));
        else if(blip){const id=blip.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','embed')||'';block.image=image(relations.get(id)||'');}
        else if(chart){const id=chart.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id')||'',c=xml(read(relations.get(id)||''));block.table=nodes(c,'ser').flatMap(ser=>{const cats=nodes(ser,'cat')[0],vals=nodes(ser,'val')[0],names=cats?nodes(cats,'pt').map(p=>nodes(p,'v')[0]?.textContent||''):[],values=vals?nodes(vals,'pt').map(p=>nodes(p,'v')[0]?.textContent||''):[];return names.map((name,i)=>[name,values[i]||'']);});}
        else {
          const body=nodes(el,'txBody')[0],props=nodes(el,'spPr')[0],fill=props&&Array.from(props.children).find(n=>n.localName==='solidFill');
          if(fill){const color=nodes(fill,'srgbClr')[0]?.getAttribute('val');if(color&&/^[a-f\d]{6}$/i.test(color))block.fill='#'+color;}
          if(body){block.text=nodes(body,'p').map(txt).join('\n');const r=nodes(body,'rPr')[0];block.size=Number(r?.getAttribute('sz')||1400)/100;block.bold=r?.getAttribute('b')==='1';const color=r&&nodes(r,'srgbClr')[0]?.getAttribute('val');if(color&&/^[a-f\d]{6}$/i.test(color))block.color='#'+color;}
        }
        blocks.push(block);
      }
      return {blocks,slide:true};
    });
  }
  const path='word/document.xml',doc=xml(read(path)),relations=rels(path),pages:Page[]=[{blocks:[],slide:false}],body=nodes(doc,'body')[0];
  const current=()=>pages[pages.length-1];const next=()=>{if(current().blocks.length)pages.push({blocks:[],slide:false});};
  for(const el of Array.from(body?.children||[])) {
    if(nodes(el,'pageBreakBefore').length)next();
    if(el.localName==='tbl') {
      const rows=nodes(el,'tr').map(tr=>nodes(tr,'tc').map(txt));
      for(let i=1;i<rows.length;i+=10){if(i>1)next();current().blocks.push({table:[rows[0],...rows.slice(i,i+10)]});}
    } else if(el.localName==='p') {
      const text=txt(el);if(text)current().blocks.push({text,bold:nodes(el,'b').length>0});
      for(const blip of nodes(el,'blip')){const id=blip.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','embed')||'';const src=image(relations.get(id)||'');if(src)current().blocks.push({image:src});}
      if(nodes(el,'br').some(n=>n.getAttributeNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main','type')==='page'))next();
    }
  }
  return pages.filter(p=>p.blocks.length);
}
export function OfficePreview({ file, onClose }: { file: ReportFile; onClose: () => void }) {
  const {language}=useLanguage(),id=language==='id',ref=useRef<HTMLDialogElement>(null),[pages,setPages]=useState<Page[]>([]),[page,setPage]=useState(0),[zoom,setZoom]=useState(100),[error,setError]=useState('');
  useEffect(()=>{let active=true;const urls:string[]=[];ref.current?.showModal();readPages(file,urls).then(p=>{if(active)setPages(p);else urls.forEach(URL.revokeObjectURL);}).catch(e=>{if(active)setError(String(e));});return()=>{active=false;urls.forEach(URL.revokeObjectURL);};},[file]);
  const current=pages[page];
  return <dialog ref={ref} className="office-preview" aria-label={id?'Preview Report':'Report Preview'} onClose={onClose} onClick={e=>{if(e.target===ref.current)onClose();}}>
    <div className="office-preview-toolbar"><b>{id?'Preview Report':'Report Preview'}</b><button className="secondary" disabled={!page} onClick={()=>setPage(p=>p-1)}>{id?'Sebelumnya':'Previous'}</button><span>{page+1} / {pages.length||'…'}</span><button className="secondary" disabled={page>=pages.length-1} onClick={()=>setPage(p=>p+1)}>{id?'Berikutnya':'Next'}</button><label>Zoom<select aria-label="Zoom" value={zoom} onChange={e=>setZoom(Number(e.target.value))}>{[75,100,125,150].map(n=><option key={n} value={n}>{n}%</option>)}</select></label><button className="primary" onClick={()=>saveBlob(file.blob,file.name)}>{id?'Unduh Report':'Download Report'}</button><button className="secondary" onClick={onClose}>{id?'Tutup':'Close'}</button></div>
    <p className="office-preview-note">{id?'Pratinjau isi dari file report yang sama. Font, grafik, dan pemisahan halaman dapat berbeda di Word/PowerPoint.':'Content preview from the same report file. Fonts, charts, and pagination may differ in Word/PowerPoint.'}</p>
    {error&&<p role="alert" className="error">{error}</p>}
    <div className="office-preview-scroll">{current?<article className={'office-page '+(current.slide?'office-slide':'office-word')} style={{width:(current.slide?960:760)*zoom/100,...(current.slide?{height:540*zoom/100}:{})}}>{current.blocks.map((b,i)=><div key={i} className="office-block" style={current.slide?{position:'absolute',left:b.x+'%',top:b.y+'%',width:b.w+'%',height:b.h+'%',background:b.fill,color:b.color,fontSize:(b.size||12)*zoom/100,fontWeight:b.bold?700:400}:{fontWeight:b.bold?700:400}}>{b.image?<img src={b.image} alt="Report"/>:b.table?<table><tbody>{b.table.map((row,j)=><tr key={j}>{row.map((cell,k)=>j===0?<th key={k}>{cell}</th>:<td key={k}>{cell}</td>)}</tr>)}</tbody></table>:b.text}</div>)}</article>:<p className="empty">{id?'Memuat pratinjau…':'Loading preview…'}</p>}</div>
  </dialog>;
}
