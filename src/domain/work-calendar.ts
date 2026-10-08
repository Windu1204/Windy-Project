// SKB national holidays + collective leave; includes the 18 Aug 2025 amendment.
// Sources: https://kemenkopmk.go.id/pemerintah-tetapkan-hari-libur-nasional-dan-cuti-bersama-tahun-2025
// https://www.kemenkopmk.go.id/node/5862
// https://www.kemenkopmk.go.id/pemerintah-tetapkan-cuti-bersama-18-agustus-2025-untuk-peringatan-hut-ke-80-ri
export const calendarYears = [2025, 2026] as const;
const dates: Record<number, string[]> = {
  2025: ['01-01','01-27','01-28','01-29','03-28','03-29','03-31','04-01','04-02','04-03','04-04','04-07','04-18','04-20','05-01','05-12','05-13','05-29','05-30','06-01','06-06','06-09','06-27','08-17','08-18','09-05','12-25','12-26'],
  2026: ['01-01','01-16','02-16','02-17','03-18','03-19','03-20','03-21','03-22','03-23','03-24','04-03','04-05','05-01','05-14','05-15','05-27','05-28','05-31','06-01','06-16','08-17','08-25','12-24','12-25'],
};
const excluded = new Set(Object.entries(dates).flatMap(([y,ds]) => ds.map(d => y+'-'+d)));
export function isoDate(value: unknown): string | null {
  const s = String(value ?? '').slice(0,10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(s+'T00:00:00Z');
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10) === s ? s : null;
}
export function calendarCovered(start:string,end:string) {
  return Object.keys(dates).includes(start.slice(0,4)) && Object.keys(dates).includes(end.slice(0,4));
}
export function isWorkday(day:string) {
  const n = new Date(day+'T00:00:00Z').getUTCDay();
  return n !== 0 && n !== 6 && !excluded.has(day);
}
/** Start excluded; end included only if a workday. Unknown calendar => unavailable. */
export function workingDays(start:unknown,end:unknown):number|null {
  const a=isoDate(start),b=isoDate(end);
  if(!a || !b || b<a || !calendarCovered(a,b)) return null;
  const elapsed=Math.round((new Date(b+'T00:00:00Z').getTime()-new Date(a+'T00:00:00Z').getTime())/86400000);
  let count=Math.floor(elapsed/7)*5;const first=(new Date(a+'T00:00:00Z').getUTCDay()+1)%7;
  for(let i=0;i<elapsed%7;i++){const day=(first+i)%7;if(day!==0&&day!==6)count++;}
  for(const holiday of excluded)if(holiday>a&&holiday<=b){const day=new Date(holiday+'T00:00:00Z').getUTCDay();if(day!==0&&day!==6)count--;}
  return count;
}
export function jakartaToday(date=new Date()) {
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
}
export function completionDate(done:unknown,updated:unknown):string|null {
 const explicit=isoDate(done);if(explicit)return explicit;
 if(!updated)return null;const date=new Date(String(updated));
 return Number.isFinite(date.getTime())?jakartaToday(date):null;
}
