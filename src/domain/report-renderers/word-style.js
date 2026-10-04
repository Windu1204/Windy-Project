export function corporateWordDocument(docx, context, title, children) {
  const { Document, Paragraph, TextRun, Header, Footer, ImageRun, PageNumber, AlignmentType } = docx;
  const bytes = value => Uint8Array.from(atob(value.split(',')[1]), c => c.charCodeAt(0));
  const logo = () => new ImageRun({ data: bytes(context.brandLogo), transformation: { width: 112, height: 43 } });
  const cover = [new Paragraph({ children: [logo()], spacing: { after: 500 } }),
    new Paragraph({ children: [new TextRun({ text: title, size: 48, bold: true, color: '08275C' })], spacing: { after: 160 } }),
    new Paragraph({ children: [new TextRun({ text: 'Monitoring Report', size: 36 })], spacing: { after: 480 } }),
    new Paragraph({ text: 'Periode: ' + context.presentationPeriod.replace(/\n/g, ' · ') }),
    new Paragraph({ text: 'Implementor: ' + (context.person === 'All Name' ? 'ALL IMPLEMENTORS' : context.person), spacing: { after: 260 } }),
    new Paragraph({ children: [new ImageRun({ data: bytes(context.coverPhoto), transformation: { width: 580, height: 326 } })] }),
    new Paragraph({ text: 'Generated ' + new Date().toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric' }) })];
  // Original Word content stays intact; only the old cover paragraphs are replaced.
  const body = children.slice(3);
  return new Document({
    styles: { default: { document: { run: { font: 'Arial', size: 22, color: '08275C' }, paragraph: { spacing: { after: 120 } } }, heading1: { run: { font: 'Arial', size: 34, bold: true, color: '08275C' }, paragraph: { spacing: { before: 300, after: 180 }, keepNext: true } }, heading2: { run: { font: 'Arial', size: 26, bold: true, color: '08275C' }, paragraph: { spacing: { before: 240, after: 140 }, keepNext: true } } } },
    sections: [
      { properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } }, children: cover },
      { properties: { page: { margin: { top: 1260, bottom: 900, left: 720, right: 720 } } },
        headers: { default: new Header({ children: [new Paragraph({ children: [logo(), new TextRun({ text: '   ' + title + ' | Monitoring Report', size: 18, bold: true })] }), new Paragraph({ children: [new TextRun({ text: 'Periode: ' + context.presentationPeriod.replace(/\n/g, ' · '), size: 18 })], alignment: AlignmentType.RIGHT })] }) },
        footers: { default: new Footer({ children: [new Paragraph({ children: [new TextRun({ text: title + ' | Monitoring Report    ', size: 18 }), new TextRun({ children: [PageNumber.CURRENT], size: 18 })] })] }) }, children: body }
    ]
  });
}



