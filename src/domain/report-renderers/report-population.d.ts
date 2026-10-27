import {Payload} from '../../types';
import {RegionAccessors,ReportPpt} from './region-overview.js';
export function reportCategory(value:Payload[string]):'N'|'M'|'U';
export function reportDimension(value:Payload[string]):string;
export function reportMonth(value:Payload[string]):string;
export function categoryOverview(pptx:ReportPpt,rows:Payload[],options:Omit<RegionAccessors,'region'> & {title:string;label:string;key:(row:Payload)=>string;addHeader:(slide:any,title:string,section:string)=>void;colors:Record<string,string>}):void;
