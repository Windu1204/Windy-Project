import {regionSummary,displayAverageDays} from '../region-summary';

export function regionProductOverview(pptx,rows,{kind='regional',addHeader,colors:C}) {
  const summary=regionSummary(rows,kind);
  for(const matrix of summary.matrices){
    if(matrix.category==='U'&&!matrix.grandTotal.total)continue;
    const label=matrix.category==='N'?'New':matrix.category==='M'?'Maintenance':'Belum diklasifikasikan';
    const slide=pptx.addSlide();addHeader(slide,'Implementasi per Wilayah · '+label,'Overview Wilayah '+label);
    const body=[...matrix.rows,matrix.grandTotal];
    const headers=['Wilayah',...matrix.products,matrix.category==='U'?'Total U':'Total '+label,'Average Days '+matrix.category];
    const table=[headers,...body.map(row=>[row.name,...row.counts,row.total,displayAverageDays(row.average.days)])];
    const productWidth=(12.2-3.95)/Math.max(1,matrix.products.length);
    slide.addTable(table,{regionOverviewLayout:true,x:.55,y:1.42,w:12.2,h:5.12,colW:[1.25,...matrix.products.map(()=>productWidth),1.3,1.4],fontFace:'Arial',fontSize:matrix.products.length>7?10:11,rowH:[.60,...body.map(()=>(5.12-.60)/body.length)],margin:.015,border:{type:'solid',pt:.5,color:'DCE3E7'},autoPage:false});
    slide.addText('Average Days: pekerjaan selesai dengan durasi tersedia. — = belum tersedia. Grand Total memakai seluruh pekerjaan dengan durasi.'+(matrix.category==='U'?' U = Belum diklasifikasikan.':''),{x:.55,y:6.76,w:12.2,h:.25,fontFace:'Arial',fontSize:9,color:C.muted,align:'center',margin:0});
  }
}

// Keep every region visible on each balanced month continuation.
export function regionMonthlyOverview(rows, {region, type, month}, monthsPerPage = 3) {
  const names = [...new Set(rows.map(region))].sort((a,b) => {
    const number = s => Number((s.match(/\d+/) || ['9999'])[0]);
    return number(a)-number(b) || a.localeCompare(b);
  });
  const bucket=r=>month(r)||'Tanpa tanggal';
  const category=r=>['N','M'].includes(type(r))?type(r):'U';
  const types=rows.some(r=>category(r)==='U')?['N','M','U']:['N','M'];
  const months = [...new Set(rows.map(bucket))].sort();
  const pageCount = Math.ceil(months.length / Math.max(1, monthsPerPage));
  const base = pageCount ? Math.floor(months.length/pageCount) : 0;
  const extra = pageCount ? months.length%pageCount : 0;
  const pages = [];
  let offset = 0;
  const label = m => /^\d{4}-\d{2}$/.test(m)?new Date(m+'-01T00:00:00Z').toLocaleDateString('id-ID',{month:'short',year:'numeric',timeZone:'UTC'}):m;
  for(let i=0;i<pageCount;i++) {
    const selected = months.slice(offset, offset+base+(i<extra?1:0));
    offset += selected.length;
    const headers = ['Wilayah', ...selected.flatMap(m => types.map(t=>label(m)+' '+(t==='U'?'Belum diklasifikasikan':t))), 'Total bulan halaman'];
    const pair = records => types.map(t=>records.filter(r=>category(r)===t).length);
    const table = names.map(name => {
      const scoped=rows.filter(r=>region(r)===name);
      return [name,...selected.flatMap(m=>pair(scoped.filter(r=>bucket(r)===m))),scoped.filter(r=>selected.includes(bucket(r))).length];
    });
    table.push(['Grand Total',...selected.flatMap(m=>pair(rows.filter(r=>bucket(r)===m))),rows.filter(r=>selected.includes(bucket(r))).length]);
    pages.push({months:selected,headers,rows:table});
  }
  return {names,months,types,pages};
}

export function regionMonthHeaderRows(months,types=['N','M']) {
  const label=m=>/^\d{4}-\d{2}$/.test(m)?new Date(m+'-01T00:00:00Z').toLocaleDateString('id-ID',{month:'long',year:'numeric',timeZone:'UTC'}):m;
  return [
    [{text:'Wilayah',options:{rowspan:2}},...months.map(m=>({text:label(m),options:{colspan:types.length}})),{text:'Total bulan halaman',options:{rowspan:2}}],
    months.flatMap(()=>types.map(t=>({text:t==='U'?'Belum\nklasifikasi':t})))
  ];
}

// One total overview, balanced monthly matrices, then equal supporting panels.
export function regionOverview(pptx,rows,{region,type,month,addHeader,colors:C,monthlyComparison=false,separateProducts=false,kind='regional'}) {
  if(!rows.length)return;
  const bucket=r=>month(r)||'Tanpa tanggal',category=r=>['N','M'].includes(type(r))?type(r):'U';
  const comparison=regionMonthlyOverview(rows,{region,type,month});
  const types=comparison.types;
  const stats=comparison.names.map(name=>{const scoped=rows.filter(r=>region(r)===name);return [name,...types.map(t=>scoped.filter(r=>category(r)===t).length),scoped.length];});
  const maintenance=rows.filter(r=>type(r)==='M').length;
  if(separateProducts)regionProductOverview(pptx,rows,{kind,addHeader,colors:C});
  else {
  const slide=pptx.addSlide();addHeader(slide,'Overview Implementasi per Wilayah','Overview Wilayah');
  const table=[['Wilayah',...types.map(t=>t==='U'?'Belum diklasifikasikan':t),'Total'],...stats,['Grand Total',...types.map(t=>rows.filter(r=>category(r)===t).length),rows.length]];
  const height=Math.min(5.0,table.length*.27);
  slide.addTable(table,{regionOverviewLayout:true,x:1.65,y:1.55,w:10.0,h:height,colW:[2.8,...types.map(()=>7.2/(types.length+1)),7.2/(types.length+1)],fontFace:'Arial',fontSize:12,rowH:Math.min(.27,5/table.length),margin:.015,border:{type:'solid',pt:.5,color:'DCE3E7'},autoPage:false});
  slide.addText('N = New · M = Maintenance',{x:1.65,y:Math.min(6.85,1.72+height),w:10,h:.18,fontFace:'Arial',fontSize:9,color:C.muted,align:'center',margin:0});
  }
  if(monthlyComparison&&!separateProducts)comparison.pages.forEach((page,index)=>{
    const s=pptx.addSlide();addHeader(s,'Implementasi per Wilayah per Bulan',`Perbandingan Bulanan ${index+1}/${comparison.pages.length}`);
    const table=[...regionMonthHeaderRows(page.months,types),...page.rows];
    s.addTable(table,{regionOverviewLayout:true,regionOverviewHeaderRows:2,x:.55,y:1.35,w:12.2,h:5.1,colW:[1.65,...Array(page.months.length*types.length).fill(9/(page.months.length*types.length)),1.55],fontFace:'Arial',fontSize:11,rowH:Math.min(.27,4.9/table.length),margin:.015,border:{type:'solid',pt:.5,color:'DCE3E7'},autoPage:false});
    s.addText('N = New · M = Maintenance · Seluruh wilayah ditampilkan di setiap halaman; total halaman hanya mencakup bulan yang terlihat.',{x:.55,y:6.83,w:12.2,h:.25,fontFace:'Arial',fontSize:9,color:C.muted,align:'center',margin:0});
  });
  const chart=pptx.addSlide();addHeader(chart,'Grafik Implementasi Wilayah','Grafik pendukung Overview Wilayah');
  const panel=(x,title)=>{chart.addShape(pptx.ShapeType.rect,{x,y:1.35,w:4.0,h:5.45,line:{color:'DCE3E7',width:.7},fill:{color:'FFFFFF'}});chart.addText(title,{x:x+.16,y:1.55,w:3.68,h:.5,fontFace:'Arial',fontSize:13,bold:true,color:C.navy,align:'center',margin:0});};
  panel(.38,'Total Implementasi per Bulan');panel(4.67,'Top 5 Wilayah');panel(8.96,'Komposisi N / M');
  const months=comparison.months,labels=months.map(m=>/^\d{4}-\d{2}$/.test(m)?new Date(m+'-01T00:00:00Z').toLocaleDateString('id-ID',{month:'short',year:'2-digit',timeZone:'UTC'}):m);
  const common={w:3.65,h:4.0,y:2.3,showLegend:false,showValue:true,catAxisLabelFontSize:10,valAxisLabelFontSize:9,showTitle:false,showBorder:false};
  chart.addChart(pptx.ChartType.bar,types.map(t=>({name:t==='U'?'Belum diklasifikasikan':t,labels,values:months.map(m=>rows.filter(r=>bucket(r)===m&&category(r)===t).length)})),{...common,x:.55,showLegend:true,legendPos:'b',chartColors:[C.orange,C.teal],grouping:'stacked'});
  const top=[...stats].sort((a,b)=>b.at(-1)-a.at(-1)).slice(0,5);
  chart.addChart(pptx.ChartType.bar,[{name:'Total',labels:top.map(r=>r[0]),values:top.map(r=>r.at(-1))}],{...common,x:4.84,barDir:'col',chartColors:[C.teal],valAxisMinVal:0});
  chart.addChart(pptx.ChartType.doughnut,[{name:'Jenis',labels:types.map(t=>t==='U'?'Belum diklasifikasikan':t),values:types.map(t=>rows.filter(r=>category(r)===t).length)}],{...common,x:9.13,showLegend:true,legendPos:'b',chartColors:[C.orange,C.teal],holeSize:60});
}
