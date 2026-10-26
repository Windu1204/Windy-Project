import { type Payload } from '../../types';
import { regionSummary, displayAverageDays, type RegionSummaryKind } from '../region-summary';

/** Word keeps product headers readable by continuing columns, never by shrinking the text. */
export function regionReportSections(rows: Payload[], kind: RegionSummaryKind) {
  const summary = regionSummary(rows, kind);
  return summary.matrices.filter(matrix => matrix.category !== 'U' || matrix.grandTotal.total > 0).flatMap(matrix => {
    const label = matrix.category === 'N' ? 'New' : matrix.category === 'M' ? 'Maintenance' : 'Belum diklasifikasikan';
    const parts = Math.max(1, Math.ceil(matrix.products.length / 3));
    return Array.from({ length: parts }, (_, part) => {
      const start = part * 3, products = matrix.products.slice(start, start + 3);
      return {
        title: `Implementasi Wilayah ${label}${parts > 1 ? ` ${part + 1} dari ${parts}` : ''}`,
        headers: ['Wilayah', ...products, matrix.category === 'U' ? 'Total U' : `Total ${label}`, `Average Days ${matrix.category}`],
        rows: [...matrix.rows, matrix.grandTotal].map(row => [row.name, ...row.counts.slice(start, start + 3), row.total, displayAverageDays(row.average.days)]),
        note: `Jumlah mengikuti semua baris ${label} pada filter report. Average Days memakai pekerjaan selesai dengan durasi tersedia; — berarti belum dapat dirata-ratakan.${parts > 1 ? ' Total dan Average Days mencakup seluruh kelompok produk, termasuk kolom pada halaman lanjutan.' : ''}`,
        pageBreak: true,
      };
    });
  });
}
