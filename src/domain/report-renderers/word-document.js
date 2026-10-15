const PAGE_WIDTH = 11906, CONTENT_WIDTH = PAGE_WIDTH - 1440;

/** Keep count columns compact while leaving readable room for names and descriptions. */
export function wordColumnWidths(section, available = CONTENT_WIDTH) {
 const count = section.headers.length;
 if (!count) return [];
 let weights;
 if (section.months) {
  const first = 0.34, last = 0.14;
  weights = [first, ...Array(count - 2).fill((1 - first - last) / (count - 2)), last];
 } else {
  weights = section.headers.map((header, index) => {
   const values = section.rows.map(row => String(row[index] ?? '').trim()).filter(Boolean);
   const numeric = values.length > 0 && values.every(value => /^[\d.,%\s−-]+$/.test(value));
   const longest = Math.max(String(header).length, ...values.map(value => Math.min(54, value.length)));
   return numeric ? Math.max(7, Math.min(12, String(header).length)) : Math.max(10, Math.min(42, longest));
  });
 }
 const sum = weights.reduce((total, value) => total + value, 0);
 const longestWord = value => Math.max(0,...String(value ?? '').split(/\s+/).map(word => word.length));
 const minimums = section.months ? weights.map(() => 0) : section.headers.map((header,index) => {
  const contentWord = Math.min(8,Math.max(0,...section.rows.map(row => longestWord(row[index]))));
  return Math.min(14,Math.max(longestWord(header),contentWord)) * 120 + 220;
 });
 const minimumTotal = minimums.reduce((total,value) => total + value,0);
 const scale = Math.min(1,available / minimumTotal);
 const remaining = Math.max(0,available - minimumTotal);
 const widths = weights.map((value,index) => Math.round(minimums[index] * scale + remaining * value / sum));
 widths[widths.length - 1] += available - widths.reduce((total, value) => total + value, 0);
 return widths;
}

export function createWordDocument(d, context, title, sections) {
 const { Document, Paragraph, TextRun, Header, Footer, ImageRun, PageNumber, AlignmentType,
  Table, TableRow, TableCell, WidthType, HeadingLevel, BorderStyle, TableLayoutType } = d;
 const date = new Date().toLocaleDateString('id-ID', { timeZone:'Asia/Jakarta', day:'2-digit', month:'long', year:'numeric' });
 const logo = () => new ImageRun({ data:Uint8Array.from(atob(context.brandLogo.split(',')[1]), c => c.charCodeAt(0)), transformation:{ width:112, height:43 } });
 const paragraph = (text, options = {}) => new Paragraph({ alignment:AlignmentType.CENTER, spacing:{ after:120 }, children:[new TextRun({ text:String(text), color:'08275C', size:22 })], ...options });
 const border = { style:BorderStyle.SINGLE, size:4, color:'DCE3E7' };
 const none = { style:BorderStyle.NONE, size:0, color:'FFFFFF' };
 const header = width => new Header({ children:[new Table({
  width:{ size:width, type:WidthType.DXA }, columnWidths:[Math.round(width * .30), width - Math.round(width * .30)], layout:TableLayoutType.FIXED,
  borders:{ top:none, bottom:none, left:none, right:none, insideHorizontal:none, insideVertical:none },
  rows:[new TableRow({ children:[
   new TableCell({ width:{ size:Math.round(width * .30), type:WidthType.DXA }, verticalAlign:'top', margins:{ top:0, bottom:0, left:0, right:0 }, children:[new Paragraph({ alignment:AlignmentType.LEFT, spacing:{ after:0 }, children:[logo()] })] }),
   new TableCell({ width:{ size:width - Math.round(width * .30), type:WidthType.DXA }, verticalAlign:'top', margins:{ top:0, bottom:0, left:0, right:0 }, children:[
    paragraph('Tanggal report: ' + date, { alignment:AlignmentType.RIGHT, spacing:{ after:80 }, children:[new TextRun({ text:'Tanggal report: ' + date, size:18, color:'08275C' })] }),
    paragraph(title, { alignment:AlignmentType.RIGHT, spacing:{ after:0 }, children:[new TextRun({ text:title, bold:true, size:18, color:'08275C' })] })
   ] })
  ] })]
 })] });
 const cover = [
  new Paragraph({ alignment:AlignmentType.CENTER, children:[new TextRun({ text:'MONITORING REPORT', bold:true, size:36, color:'008997' })], spacing:{ before:2600, after:300 } }),
  new Paragraph({ heading:HeadingLevel.TITLE, alignment:AlignmentType.CENTER, children:[new TextRun({ text:title, bold:true, size:44, color:'08275C' })], spacing:{ after:1000 } }),
  paragraph('Periode: ' + context.presentationPeriod.replace(/\n/g, ' · ')),
  paragraph('Cakupan PIC: ' + (context.person === 'All Name' ? 'Seluruh PIC sesuai akses' : context.person)),
  paragraph('Internal application', { spacing:{ before:1400, after:0 }, children:[new TextRun({ text:'Internal application', size:18, color:'8D9AA6' })] })
 ];
 const body = [];
 for (const section of sections) {
  body.push(new Paragraph({ text:section.title, heading:HeadingLevel.HEADING_1, alignment:AlignmentType.CENTER, keepNext:true, ...(section.pageBreak ? { pageBreakBefore:true } : {}) }));
  if (section.note) body.push(paragraph(section.note, { keepNext:true }));
  const widths = wordColumnWidths(section);
  const cell = (value, index, isHeader = false, span = 1, total = false, keepNext = false) => new TableCell({
   columnSpan:span, width:{ size:widths.slice(index,index + span).reduce((sum,n) => sum+n,0), type:WidthType.DXA },
   shading:{ fill:isHeader ? '008997' : total ? 'DDF0F1' : 'FFFFFF' }, verticalAlign:'center', margins:{ top:100, bottom:100, left:90, right:90 },
   children:[new Paragraph({ alignment:AlignmentType.CENTER, keepNext:isHeader || keepNext, spacing:{ after:0 }, children:(isHeader && String(value).trim() === '' ? '' : value === null || value === undefined || String(value).trim() === '' ? 'Belum tersedia' : String(value)).split('\n').map((line,i) => new TextRun({ text:line, break:i ? 1 : 0, bold:isHeader || total, color:isHeader ? 'FFFFFF' : '08275C', size:20 })) })]
  });
  const keepTogether = section.rows.length <= 10 && section.rows.every(row => row.every(value => String(value ?? '').length < 120));
  let heads;
  if (section.months) {
   const label = month => /^\d{4}-\d{2}$/.test(month) ? new Date(month+'-01T00:00:00Z').toLocaleDateString('id-ID',{ month:'long', year:'numeric', timeZone:'UTC' }) : month;
   heads = [
    new TableRow({ tableHeader:true, cantSplit:true, children:[cell(section.headers[0],0,true), ...section.months.map((month,i) => cell(label(month),1+i*section.types.length,true,section.types.length)), cell('Total halaman',widths.length-1,true)] }),
    new TableRow({ tableHeader:true, cantSplit:true, children:[cell(' ',0,true), ...section.months.flatMap((_,i) => section.types.map((type,j) => cell(type==='U'?'Belum\nklasifikasi':type,1+i*section.types.length+j,true))), cell(' ',widths.length-1,true)] })
   ];
  } else heads = [new TableRow({ tableHeader:true, cantSplit:true, children:section.headers.map((value,index) => cell(value,index,true)) })];
  body.push(new Table({ width:{ size:CONTENT_WIDTH, type:WidthType.DXA }, columnWidths:widths, layout:TableLayoutType.FIXED,
   borders:{ top:border, bottom:border, left:border, right:border, insideHorizontal:border, insideVertical:border },
   rows:[...heads, ...section.rows.map((row,rowIndex) => new TableRow({ cantSplit:row.every(value => String(value ?? '').length < 600), children:row.map((value,index) => cell(value,index,false,1,row[0]==='Grand Total',keepTogether && rowIndex<section.rows.length-1)) }))]
  }));
  body.push(new Paragraph({ spacing:{ after:160 }, children:[] }));
 }
 return new Document({ styles:{ default:{ document:{ run:{ font:'Arial', size:22, color:'08275C' }, paragraph:{ alignment:AlignmentType.CENTER, spacing:{ after:120 } } }, heading1:{ run:{ font:'Arial', size:28, bold:true, color:'08275C' }, paragraph:{ alignment:AlignmentType.CENTER, spacing:{ before:260, after:160 }, keepNext:true } } } }, sections:[
  { properties:{ page:{ size:{ width:PAGE_WIDTH, height:16838 }, margin:{ top:1260, bottom:1000, left:900, right:900, header:360 } } }, headers:{ default:header(PAGE_WIDTH-1800) }, children:cover },
  { properties:{ page:{ size:{ width:PAGE_WIDTH, height:16838 }, margin:{ top:1260, bottom:900, left:720, right:720, header:360 } } }, headers:{ default:header(CONTENT_WIDTH) }, footers:{ default:new Footer({ children:[new Paragraph({ alignment:AlignmentType.CENTER, children:[new TextRun({ text:title+' · ', size:18 }), new TextRun({ children:[PageNumber.CURRENT], size:18 })] })] }) }, children:body }
 ] });
}
