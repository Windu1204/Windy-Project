// Shared presentation master. Data and aggregation remain in the dataset renderers.
export function corporateStyle(pptx, context, title) {
  const original = pptx.addSlide.bind(pptx);
  let page = 0;
  pptx.addSlide = (...args) => {
    const slide = original(...args), number = ++page;
    const text = slide.addText.bind(slide), shape = slide.addShape.bind(slide), table = slide.addTable.bind(slide), chart = slide.addChart.bind(slide);
    let contentPage = false, sectionPart = '';
    const logo = () => slide.addImage({ data: context.brandLogo, x: .38, y: .14, w: 1.12, h: .43 });
    const footer = () => {
      shape(pptx.ShapeType.line, { x: .38, y: 7.12, w: 12.57, h: 0, line: { color: 'CBD8DE', width: .6 } });
      text(title + ' | Monitoring Report', { x: .38, y: 7.20, w: 11.8, h: .16, fontFace: 'Arial', fontSize: 8, color: '08275C', margin: 0 });
      text(String(number), { x: 12.45, y: 7.20, w: .5, h: .16, fontFace: 'Arial', fontSize: 8, color: '08275C', align: 'right', margin: 0 });
    };
    slide.addText = (value, options = {}) => {
      const plain = typeof value === 'string' ? value : '';
      if (/^Basis overview:|^Basis wilayah:/.test(plain)) return slide;
      if (/Tidak dijumlahkan ke status/.test(plain)) return text('Overdue merupakan subset status yang sudah dihitung; tidak ditambahkan ke total.', { x: .38, y: 1.95, w: 12.57, h: .16, fontFace: 'Arial', fontSize: 8.5, color: '08275C', margin: 0 });
      if (options.x === .16 && options.y === .115) { sectionPart = plain.match(/\d+\/\d+$/)?.[0] || ''; return slide; }
      if (options.x === .30 && options.y === .40) {
        contentPage = true; slide.background = { color: 'FFFFFF' }; logo(); footer();
        return text(value + (sectionPart ? ' · ' + sectionPart : ''), { ...options, x: .38, y: .64, w: 12.57, h: .38, fontSize: 23 });
      }
      if (options.x === 9.15) return text(value, { ...options, x: 8.6, y: options.y === .29 ? .14 : .33, w: 4.35, fontSize: 8.5, color: '08275C' });
      if (options.x === .98 && options.y === .64) { logo(); footer(); return slide; }
      if (options.x === .74 && options.y === 2.69) options = { ...options, color: '08275C', bold: false };
      if (plain === 'Implementor' && options.x === 1.43) options = { ...options, x: .74 };
      if (options.x === 1.43 && options.y === 4.39) options = { ...options, x: .74, w: 6.2 };
      if (contentPage && options.fontSize >= 6.5 && options.fontSize < 10 && options.y > 1.2 && options.y < 6.9) options = { ...options, fontSize: 9.5, h: Math.max(options.h || 0, .22) };
      if (contentPage && options.align === 'right' && options.w < .65 && options.y > 1.2 && options.y < 6.9) options = { ...options, x: options.x + options.w - .65, w: .65 };
      return text(value, options);
    };
    slide.addShape = (kind, options = {}) => {
      if (kind === pptx.ShapeType.chevron || kind === pptx.ShapeType.arc || (options.x === .10 && options.y === .07)) return slide;
      if (!contentPage && kind === pptx.ShapeType.ellipse && options.y >= 4.15 && options.y < 4.6) return slide;
      if (options.x === .74 && options.y === .72) return slide;
      if (options.x === .30 && options.y === .79) options = { ...options, x: .38, y: 1.02 };
      if (options.x === 0 && options.y === 0 && options.w === 13.333) options = { ...options, fill: { color: 'FFFFFF' } };
      return shape(kind, options);
    };
    const image = slide.addImage.bind(slide);
    slide.addImage = options => image(options.data === context.coverPhoto ? { ...options, x: 0, y: 0, w: 13.333, h: 7.02 } : options);
    slide.addTable = (rows, options = {}) => {
      const cellText = c => String(typeof c === 'object' ? c.text : c);
      const people = cellText(rows[0][0]) === 'PIC / Implementor';
      if (people) rows = rows.map((row, i) => [i === 0 ? 'No.' : String((numbering += 1)), ...row]);
      const overview = ['Overall Total','Total Periode'].includes(cellText(rows[0].at(-1)));
      const styled = rows.map((row, ri) => row.map((cell, ci) => ({ text: cellText(cell), options: {
        ...(typeof cell === 'object' ? cell.options : {}),
        fill: ri === 0 ? '008997' : cellText(row[0]) === 'Grand Total' || overview && ci === row.length - 1 ? 'DDF0F1' : ri % 2 ? 'FFFFFF' : 'F0F3F5',
        color: ri === 0 ? 'FFFFFF' : '08275C', bold: ri === 0 || cellText(row[0]) === 'Grand Total' || overview && ci === row.length - 1,
        align: ci === (people ? 1 : 0) ? 'left' : 'center', valign: 'middle'
      } })));
      // Region matrices have an explicit height budget; retain their sizing.
      if (options.regionOverviewLayout) {
        const {regionOverviewLayout, ...layout} = options;
        return table(styled, layout);
      }
      if (overview) {
        text('M = Maintenance · N = New', {x:.38,y:6.93,w:5,h:.16,fontSize:8,color:'08275C',margin:0});
        const grouped = [{ text: cellText(rows[0][0]), options: { rowspan: 2 } }];
        for (let ci = 1; ci < rows[0].length - 1; ci += 2) grouped.push({ text: cellText(rows[0][ci]).replace(/ M$/, ''), options: { colspan: 2 } });
        grouped.push({ text: cellText(rows[0].at(-1)), options: { rowspan: 2 } });
        const sub = [];
        for (let ci = 1; ci < rows[0].length - 1; ci += 2) sub.push('M', 'N');
        const headerStyle = cell => ({ text: cellText(cell), options: { ...(cell.options || {}), fill: '008997', color: 'FFFFFF', bold: true, align: 'center', valign: 'middle' } });
        styled.splice(0, 1, grouped.map(headerStyle), sub.map(headerStyle));
      }
      return table(styled, { ...options, ...(overview ? {h:3.45,rowH:.285} : {}), y: Math.max(1.18, options.y || 0), fontSize: overview ? 10 : 12, margin: .045, border: { type: 'solid', color: 'DCE3E7', pt: .4 }, colW: people ? [.5, 3.9, ...Array(rows[0].length - 2).fill((options.w - 4.4) / (rows[0].length - 2))] : overview ? [2.25, ...Array(rows[0].length - 2).fill((options.w - 3.45) / (rows[0].length - 2)), 1.2] : undefined });
    };
    slide.addChart = (type, data, options) => chart(type, data, { ...options, chartColors: ['008B98', 'FF791C', '064B65', '39AFB6', '7BAEB7'], catAxisLabelFontSize: 9, valAxisLabelFontSize: 8, legendFontSize: 9 });
    return slide;
  };
  let numbering = 0;
}

export function summaryCard(slide, pptx, x, y, w, label, value, accent) {
  slide.addShape(pptx.ShapeType.rect, { x, y, w, h: .86, line: { color: 'DCE3E7', width: .6 }, fill: { color: 'FFFFFF' } });
  slide.addShape(pptx.ShapeType.rect, { x, y, w: .055, h: .86, line: { transparency: 100 }, fill: { color: accent } });
  slide.addText(label, { x: x + .14, y: y + .12, w: w - .28, h: .26, fontFace: 'Arial', fontSize: 10, color: '08275C', align: 'center', margin: 0 });
  slide.addText(typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('en-US') : String(value), { x: x + .14, y: y + .42, w: w - .28, h: .32, fontFace: 'Arial', fontSize: 24, bold: true, color: '08275C', align: 'center', margin: 0 });
}
