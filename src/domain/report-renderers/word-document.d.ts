import type {ReportContext} from '../report-model';
export interface WordSection {title:string;headers:readonly string[];rows:readonly (readonly (string|number|null|undefined)[])[];note?:string;pageBreak?:boolean;months?:string[];types?:string[]}
export function createWordDocument(d:typeof import('docx'),context:Pick<ReportContext,'brandLogo'|'presentationPeriod'|'person'>,title:string,sections:WordSection[]):import('docx').Document;
