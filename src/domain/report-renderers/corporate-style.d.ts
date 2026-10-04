import type PptxGenJS from 'pptxgenjs';
export function corporateStyle(pptx: PptxGenJS, context: {brandLogo: string; coverPhoto: string}, title: string): void;
export function summaryCard(
  slide: {addShape: (...args: unknown[]) => unknown; addText: (...args: unknown[]) => unknown},
  pptx: {ShapeType: {rect: string}},
  x: number, y: number, w: number, label: string, value: string | number, accent: string
): void;
