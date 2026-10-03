import type { ReportContext, ReportModel } from '../report-model';
export function createRenderer(context: ReportContext): { model(): ReportModel; pptx(model: ReportModel): Promise<void>; docx(model: ReportModel): Promise<void> };
