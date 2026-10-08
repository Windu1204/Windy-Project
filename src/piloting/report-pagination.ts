// Explicit line budgets keep long source text inside the printable slide area.
export function discrepancyPages(rows: string[][]) {
  const widths = rows[0]?.length===9 ? [16,23,12,12,12,12,38,18,20] : [18,25,12,12,48,21,26];
  const wrap = (text: string, width: number) => {
    const lines: string[] = [];
    for (const paragraph of text.split('\n')) {
      let line = '';
      for (const token of paragraph.match(/\S+/g) || []) {
        let word = token;
        if (line && line.length + word.length + 1 > width) { lines.push(line); line = ''; }
        while (word.length > width) { lines.push(word.slice(0, width)); word = word.slice(width); }
        line = line ? line + ' ' + word : word;
      }
      lines.push(line);
    }
    return lines;
  };
  const pages: { rows: string[][]; heights: number[] }[] = [];
  let page = { rows: [] as string[][], heights: [] as number[] }, used = .44;
  for (const row of rows) {
    const cells = row.map((text, i) => wrap(text, widths[i]));
    const lines = Math.max(1, ...cells.map(c => c.length));
    for (let start = 0; start < lines; start += 12) {
      const part = cells.map((cell, i) => i < (row.length===9?6:4) && start > 0 ? cells[i].join('\n') : cell.slice(start, start + 12).join('\n'));
      const height = Math.max(.44, Math.min(12, lines - start) * .16 + .16);
      if (used + height > 5.1 && page.rows.length) { pages.push(page); page = { rows: [], heights: [] }; used = .44; }
      page.rows.push(part); page.heights.push(height); used += height;
    }
  }
  if (page.rows.length) pages.push(page);
  return pages;
}
