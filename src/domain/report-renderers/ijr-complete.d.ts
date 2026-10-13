import type { ReportContext } from '../report-model';
export interface IJRSection {
  title: string;
  headers: string[];
  data: (string | number | null | undefined)[][];
  note: string;
  chart: boolean;
}
export function ijrSections(context: Pick<ReportContext, 'rows' | 'person' | 'selected' | 'presentationPeriod'>): IJRSection[];
export function exportIJR(context: ReportContext, format: 'pptx' | 'docx'): Promise<void>;
