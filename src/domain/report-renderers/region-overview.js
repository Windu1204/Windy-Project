// Keep every region visible on each month continuation for direct comparison.
export function regionMonthlyOverview(rows,{region,type,month},monthsPerPage=3) {
 const names=[...new Set(rows.map(region))].sort((a,b)=>{const n=s=>Number((s.match(/\d+/)||['9999'])[0]);return n(a)-n(b)||a.localeCompare(b);});
 const months=[...new Set(rows.map(month).filter(Boolean))].sort();
 const pages=[];
 for(let i=0;i<months.length;i+=monthsPerPage){
  const selected=months.slice(i,i+monthsPerPage);
  const label=m=>new Date(m+'-01T00:00:00Z').toLocaleDateString('id-ID',{month:'short',year:'numeric',timeZone:'UTC'});
  const headers=['Wilayah',...selected.flatMap(m=>[label(m)+' N',label(m)+' M',label(m)+' Total']),'Total bulan halaman'];
  const table=names.map(name=>{const scoped=rows.filter(r=>region(r)===name);const values=selected.flatMap(m=>{const records=scoped.filter(r=>month(r)===m),maint=records.filter(r=>type(r)==='M').length;return [records.length-maint,maint,records.length];});return [name,...values,scoped.filter(r=>selected.includes(month(r))).length];});
  table.push(['Grand Total',...selected.flatMap(m=>{const records=rows.filter(r=>month(r)===m),maint=records.filter(r=>type(r)==='M').length;return [records.length-maint,maint,records.length];}),rows.filter(r=>selected.includes(month(r))).length]);
  pages.push({months:selected,headers,rows:table});
 }
 return {names,months,pages};
}

// One total overview, monthly comparison pages, then supporting charts.
export function regionOverview(pptx,rows,{region,type,month,addHeader,colors:C,monthlyComparison=false}) {
 if(!rows.length)return;
 const names=[...new Set(rows.map(region))].sort((a,b)=>{const n=s=>Number((s.match(/\d+/)||['9999'])[0]);return n(a)-n(b)||a.localeCompare(b);});
 const stats=names.map(name=>{const scoped=rows.filter(r=>region(r)===name),m=scoped.filter(r=>type(r)==='M').length;return [name,scoped.length-m,m,scoped.length];});
 const maint=rows.filter(r=>type(r)==='M').length;
 const slide=pptx.addSlide();addHeader(slide,'Overview Implementasi per Wilayah','Overview Wilayah');
 const table=[['Wilayah','N','M','Total'],...stats,['Grand Total',rows.length-maint,maint,rows.length]];
 slide.addTable(table.map((row,i)=>row.map(v=>({text:String(v),options:{bold:i===0||i===table.length-1,color:i===0?'FFFFFF':C.navy,fill:i===0?C.teal:i%2?'F2F5F7':'FFFFFF'}}))),{regionOverviewLayout:true,x:.55,y:1.35,w:12.2,h:5.1,colW:[6.2,2,2,2],fontFace:'Arial',fontSize:Math.min(12,Math.max(8,190/table.length)),rowH:Math.min(.30,4.7/table.length),margin:.025,border:{type:'solid',pt:.5,color:'DCE3E7'},autoPage:false});
 slide.addText('N = New · M = Maintenance',{x:.55,y:6.9,w:12.2,h:.18,fontFace:'Arial',fontSize:9,color:C.muted,margin:0});
 const comparison=regionMonthlyOverview(rows,{region,type,month});
 if(monthlyComparison)comparison.pages.forEach((page,index)=>{
  const s=pptx.addSlide();addHeader(s,'Implementasi per Wilayah per Bulan',`Perbandingan Bulanan ${index+1}/${comparison.pages.length}`);
  const table=[page.headers,...page.rows],fontSize=Math.min(11,Math.max(8,190/table.length));
  s.addTable(table.map((row,i)=>row.map((v,j)=>({text:String(v),options:{bold:i===0||i===table.length-1,color:i===0?'FFFFFF':C.navy,fill:i===0?C.teal:i===table.length-1?'E5F4F6':i%2?'F2F5F7':'FFFFFF',align:j===0?'left':'center',valign:'mid'}}))),{regionOverviewLayout:true,x:.55,y:1.35,w:12.2,h:5.1,colW:[1.4,...Array(page.headers.length-2).fill(9.35/(page.headers.length-2)),1.45],fontFace:'Arial',fontSize,rowH:Math.min(.30,4.7/table.length),margin:.025,border:{type:'solid',pt:.5,color:'DCE3E7'},autoPage:false});
  s.addText('N = New · M = Maintenance · Seluruh wilayah ditampilkan pada setiap halaman. Total bulan halaman hanya mencakup bulan yang terlihat.',{x:.55,y:6.83,w:12.2,h:.32,fontFace:'Arial',fontSize:9,color:C.muted,margin:0});
 });
 const chart=pptx.addSlide();addHeader(chart,'Grafik Implementasi Wilayah','Grafik pendukung Overview Wilayah');
 const months=[...new Set(rows.map(month))].sort(),labels=months.map(m=>new Date(m+'-01T00:00:00Z').toLocaleDateString('id-ID',{month:'short',year:'2-digit',timeZone:'UTC'}));
 chart.addText('Total Implementasi per Bulan',{x:.55,y:1.35,w:12,h:.3,fontFace:'Arial',fontSize:15,bold:true,color:C.navy,margin:0});
 chart.addChart(pptx.ChartType.bar,['N','M'].map(t=>({name:t,labels,values:months.map(m=>rows.filter(r=>month(r)===m&&type(r)===t).length)})),{x:.65,y:1.9,w:12,h:2.2,showLegend:true,legendPos:'b',showValue:false,chartColors:[C.orange,C.teal],catAxisLabelFontSize:9,valAxisLabelFontSize:9,grouping:'stacked',showTitle:false});
 const top=[...stats].sort((a,b)=>b[3]-a[3]).slice(0,5);
 chart.addText('Top 5 Wilayah',{x:.55,y:4.5,w:6,h:.3,fontFace:'Arial',fontSize:15,bold:true,color:C.navy,margin:0});
 chart.addChart(pptx.ChartType.bar,[{name:'Total',labels:top.map(x=>x[0]),values:top.map(x=>x[3])}],{x:.65,y:4.95,w:6,h:1.75,barDir:'bar',showValue:true,showLegend:false,chartColors:[C.teal],catAxisLabelFontSize:9,valAxisLabelFontSize:9});
 chart.addText('Komposisi N / M',{x:7,y:4.5,w:5.4,h:.3,fontFace:'Arial',fontSize:15,bold:true,color:C.navy,margin:0});
 chart.addChart(pptx.ChartType.doughnut,[{name:'Jenis',labels:['N','M'],values:[rows.length-maint,maint]}],{x:7.3,y:4.9,w:5.1,h:1.9,showLegend:true,legendPos:'r',showValue:true,chartColors:[C.orange,C.teal],holeSize:60});
}
