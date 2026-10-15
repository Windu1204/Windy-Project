import type {DatasetKind} from '../../types';
import type {ReportContext,ReportModel} from '../report-model';
export function exportMonitoringWord(context:ReportContext,kind:DatasetKind,model:ReportModel,title:string):Promise<void>;
