import {type Activity} from '../domain/activities';
import {saveBlob} from './exports';
import {supabase} from './supabase';
import {activityBucket} from './activities';
export async function callReportWord(activity:Activity):Promise<Blob>{
 const d=await import('docx'),b=activity.payload;
 const run=(text:string,bold=false)=>new d.TextRun({text,bold,font:'Arial',size:22});
 const p=(text:string)=>new d.Paragraph({alignment:d.AlignmentType.JUSTIFIED,spacing:{after:120,line:276},children:[run(text)]});
 const heading=(text:string)=>new d.Paragraph({keepNext:true,spacing:{before:220,after:100},children:[run(text,true)]});
 const children:(InstanceType<typeof d.Paragraph>|InstanceType<typeof d.Table>)[]=[new d.Paragraph({style:'Title',alignment:d.AlignmentType.CENTER,keepNext:true,spacing:{after:240},children:[new d.TextRun({text:'MoM '+b.title,bold:true,size:28,font:'Arial',color:'000000'})]})];
 const info=[['Hari, Tanggal',new Date(b.date+'T12:00:00+07:00').toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})],['Waktu',b.start+' – '+b.end+' WIB'],['Mode',b.mode||'—'],['Tempat / Media',b.place||'—'],['Nasabah / Perusahaan',b.company||'—'],['Produk',b.product||'—'],['Peserta BNI',(b.bni||[]).filter(p=>p.attended).map(p=>p.name).join(', ')||'—'],['Peserta Nasabah',(b.customers||[]).filter(p=>p.attended).map(p=>p.name).join(', ')||'—']];
 children.push(new d.Table({width:{size:9638,type:d.WidthType.DXA},columnWidths:[2550,7088],borders:{top:{style:d.BorderStyle.NONE},bottom:{style:d.BorderStyle.NONE},left:{style:d.BorderStyle.NONE},right:{style:d.BorderStyle.NONE},insideHorizontal:{style:d.BorderStyle.NONE},insideVertical:{style:d.BorderStyle.NONE}},rows:info.map(([label,value])=>new d.TableRow({cantSplit:true,children:[new d.TableCell({width:{size:2550,type:d.WidthType.DXA},children:[new d.Paragraph({spacing:{after:90},children:[run(label,true)]})]}),new d.TableCell({width:{size:7088,type:d.WidthType.DXA},children:[new d.Paragraph({spacing:{after:90},children:[run(': '+value)]})]})]}))}));
 for(const [name,content] of [['SUMMARY OF DISCUSSION',b.discussion],['CLIENT FEEDBACK',b.feedback],['POTENSI',b.potential],['FOLLOW UP',b.followup]]){children.push(heading(name!));for(const line of (content||'—').split(/\r?\n/))children.push(p(line||' '));}
 children.push(heading('LAMPIRAN'));
 if(!activity.attachments.length)children.push(p('Tidak ada lampiran.'));
 for(const file of activity.attachments){children.push(p(file.name));if(/\.(png|jpe?g)$/i.test(file.name)&&supabase){const {data,error}=await supabase.storage.from(activityBucket).download(file.path);if(error)throw error;const url=URL.createObjectURL(data);try{const img=new Image();img.src=url;await img.decode();const scale=Math.min(520/img.naturalWidth,380/img.naturalHeight,1);children.push(new d.Paragraph({children:[new d.ImageRun({data:new Uint8Array(await data.arrayBuffer()),transformation:{width:Math.round(img.naturalWidth*scale),height:Math.round(img.naturalHeight*scale)}})],spacing:{after:180}}));}finally{URL.revokeObjectURL(url);}}}
 return d.Packer.toBlob(new d.Document({creator:'WCI Monitoring',title:'Call Report '+b.title,styles:{default:{document:{run:{font:'Arial',size:22,color:'000000'}}}},sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:1000,bottom:1000,left:1134,right:1134}}},children}]}));
}
export async function downloadCallReport(activity:Activity){const blob=await callReportWord(activity);saveBlob(blob,('Call Report - '+(activity.payload.company||activity.payload.title)+' - '+activity.payload.date).replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').slice(0,150)+'.docx');}
