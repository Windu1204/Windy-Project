// Keep every region visible on each balanced month continuation.
export function regionMonthlyOverview(rows, {region, type, month}, monthsPerPage = 3) {
  const names = [...new Set(rows.map(region))].sort((a,b) => {
    const number = s => Number((s.match(/\d+/) || ['9999'])[0]);
    return number(a)-number(b) || a.localeCompare(b);
  });
  const months = [...new Set(rows.map(month).filter(Boolean))].sort();
  const pageCount = Math.ceil(months.length / Math.max(1, monthsPerPage));
  const base = pageCount ? Math.floor(months.length/pageCount) : 0;
  const extra = pageCount ? months.length%pageCount : 0;
  const pages = [];
  let offset = 0;
  const label = m => new Date(m+'-01T00:00:00Z').toLocaleDateString('id-ID',{month:'short',year:'numeric',timeZone:'UTC'});
  for(let i=0;i<pageCount;i++) {
    const selected = months.slice(offset, offset+base+(i<extra?1:0));
    offset += selected.length;
    const headers = ['Wilayah', ...selected.flatMap(m => [label(m)+' N',label(m)+' M']), 'Total bulan halaman'];
    const pair = records => {const maintenance=records.filter(r=>type(r)==='M').length;return [records.length-maintenance,maintenance];};
    const table = names.map(name => {
      const scoped=rows.filter(r=>region(r)===name);
      return [name,...selected.flatMap(m=>pair(scoped.filter(r=>month(r)===m))),scoped.filter(r=>selected.includes(month(r))).length];
    });
    table.push(['Grand Total',...selected.flatMap(m=>pair(rows.filter(r=>month(r)===m))),rows.filter(r=>selected.includes(month(r))).length]);
    pages.push({months:selected,headers,rows:table});
  }
  return {names,months,pages};
}

export function regionMonthHeaderRows(months) {
  const label=m=>new Date(m+'-01T00:00:00Z').toLocaleDateString('id-ID',{month:'long',year:'numeric',timeZone:'UTC'});
  return [
    [{text:'Wilayah',options:{rowspan:2}},...months.map(m=>({text:label(m),options:{colspan:2}})),{text:'Total bulan halaman',options:{rowspan:2}}],
    months.flatMap(()=>[{text:'N'},{text:'M'}])
  ];
}

// One total overview, balanced monthly matrices, then equal supporting panels.
export function regionOverview(pptx,rows,{region,type,month,addHeader,colors:C,monthlyComparison=false}) {
  if(!rows.length)return;
  const comparison=regionMonthlyOverview(rows,{region,type,month});
  const stats=comparison.names.map(name=>{const scoped=rows.filter(r=>region(r)===name),maintenance=scoped.filter(r=>type(r)==='M').length;return [name,scoped.length-maintenance,maintenance,scoped.length];});
  const maintenance=rows.filter(r=>type(r)==='M').length;
  const slide=pptx.addSlide();addHeader(slide,'Overview Implementasi per Wilayah','Overview Wilayah');
  const table=[['Wilayah','N','M','Total'],...stats,['Grand Total',rows.length-maintenance,maintenance,rows.length]];
  const height=Math.min(5.0,table.length*.27);
  slide.addTable(table,{regionOverviewLayout:true,x:1.65,y:1.55,w:10.0,h:height,colW:[2.8,2.4,2.4,2.4],fontFace:'Arial',fontSize:12,rowH:Math.min(.27,5/table.length),margin:.015,border:{type:'solid',pt:.5,color:'DCE3E7'},autoPage:false});
  slide.addText('N = New · M = Maintenance',{x:1.65,y:Math.min(6.85,1.72+height),w:10,h:.18,fontFace:'Arial',fontSize:9,color:C.muted,align:'center',margin:0});
  if(monthlyComparison)comparison.pages.forEach((page,index)=>{
    const s=pptx.addSlide();addHeader(s,'Implementasi per Wilayah per Bulan',`Perbandingan Bulanan ${index+1}/${comparison.pages.length}`);
    const table=[...regionMonthHeaderRows(page.months),...page.rows];
    s.addTable(table,{regionOverviewLayout:true,regionOverviewHeaderRows:2,x:.55,y:1.35,w:12.2,h:5.1,colW:[1.65,...Array(page.months.length*2).fill(9/(page.months.length*2)),1.55],fontFace:'Arial',fontSize:11,rowH:Math.min(.27,4.9/table.length),margin:.015,border:{type:'solid',pt:.5,color:'DCE3E7'},autoPage:false});
    s.addText('N = New · M = Maintenance · Seluruh wilayah ditampilkan di setiap halaman; total halaman hanya mencakup bulan yang terlihat.',{x:.55,y:6.83,w:12.2,h:.25,fontFace:'Arial',fontSize:9,color:C.muted,align:'center',margin:0});
  });
  const chart=pptx.addSlide();addHeader(chart,'Grafik Implementasi Wilayah','Grafik pendukung Overview Wilayah');
  const panel=(x,title)=>{chart.addShape(pptx.ShapeType.rect,{x,y:1.35,w:4.0,h:5.45,line:{color:'DCE3E7',width:.7},fill:{color:'FFFFFF'}});chart.addText(title,{x:x+.16,y:1.55,w:3.68,h:.5,fontFace:'Arial',fontSize:13,bold:true,color:C.navy,align:'center',margin:0});};
  panel(.38,'Total Implementasi per Bulan');panel(4.67,'Top 5 Wilayah');panel(8.96,'Komposisi N / M');
  const months=comparison.months,labels=months.map(m=>new Date(m+'-01T00:00:00Z').toLocaleDateString('id-ID',{month:'short',year:'2-digit',timeZone:'UTC'}));
  const common={w:3.65,h:4.0,y:2.3,showLegend:false,showValue:true,catAxisLabelFontSize:10,valAxisLabelFontSize:9,showTitle:false,showBorder:false};
  chart.addChart(pptx.ChartType.bar,['N','M'].map(t=>({name:t,labels,values:months.map(m=>rows.filter(r=>month(r)===m&&type(r)===t).length)})),{...common,x:.55,showLegend:true,legendPos:'b',chartColors:[C.orange,C.teal],grouping:'stacked'});
  const top=[...stats].sort((a,b)=>b[3]-a[3]).slice(0,5);
  chart.addChart(pptx.ChartType.bar,[{name:'Total',labels:top.map(r=>r[0]),values:top.map(r=>r[3])}],{...common,x:4.84,barDir:'col',chartColors:[C.teal],valAxisMinVal:0});
  chart.addChart(pptx.ChartType.doughnut,[{name:'Jenis',labels:['N','M'],values:[rows.length-maintenance,maintenance]}],{...common,x:9.13,showLegend:true,legendPos:'b',chartColors:[C.orange,C.teal],holeSize:60});
}
