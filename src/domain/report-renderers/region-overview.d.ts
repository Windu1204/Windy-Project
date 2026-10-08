import { Payload } from '../../types';
export interface RegionAccessors {
  region: (row: Payload) => string;
  type: (row: Payload) => string;
  month: (row: Payload) => string;
}
export function regionMonthlyOverview(rows:Payload[],accessors:RegionAccessors,monthsPerPage?:number): {
  names:string[];months:string[];pages:{months:string[];headers:string[];rows:(string|number)[][]}[];
};
