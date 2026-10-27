import { Payload } from '../../types';
export interface RegionAccessors {
  region: (row: Payload) => string;
  type: (row: Payload) => string;
  month: (row: Payload) => string;
  hideMissingRegion?:boolean;
  separateUnclassified?:boolean;
}
export interface ReportPpt {addSlide():{addTable(rows:any[][],options?:object):unknown;addText(text:string,options?:object):unknown}}
export function regionProductOverview(pptx:ReportPpt,rows:Payload[],options:{kind?:'regional'|'ijr';addHeader:(slide:any,title:string,section:string)=>void;colors:Record<string,string>}):void;
export function regionMonthlyOverview(rows:Payload[],accessors:RegionAccessors,monthsPerPage?:number): {
  names:string[];months:string[];types:string[];pages:{months:string[];headers:string[];rows:(string|number)[][]}[];
};

export function regionMonthHeaderRows(months: string[], types?: string[]): {text: string; options?: {rowspan?: number; colspan?: number}}[][];
