import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionCache } from '../src/lib/session-cache';
const state = vi.hoisted(() => ({ revision: 1, rows: [{ id: 'a', position: 1, payload: { status: 'In progress' } }], rules: [] as unknown[], reads: 0, fail: false, changeDuringRead: false }));
vi.mock('../src/lib/supabase', () => ({ supabase: { from(table: string) {
  const query: any = { select: () => query, eq: () => query, order: () => query,
    maybeSingle: async () => state.fail ? { data: null, error: new Error('offline') } : { data: table === 'wci_events' ? { revision: state.revision } : { active_batch: 'batch', data_mode: 'reference' }, error: null },
    range: async () => { state.reads++; if (state.changeDuringRead) { state.changeDuringRead = false; state.revision++; } return { data: state.rows.map(r => structuredClone(r)), error: null }; },
    then: (resolve: any) => Promise.resolve({ data: state.rules, error: null }).then(resolve) };
  return query;
} } }));
import { clearSessionCache, loadSnapshot } from '../src/lib/repository';
beforeEach(() => { clearSessionCache(); state.revision=1; state.reads=0; state.fail=false; state.changeDuringRead=false; state.rules=[]; state.rows=[{id:'a',position:1,payload:{status:'In progress'}}]; });
describe('verified dataset snapshots', () => {
 it('reuses unchanged data across dashboard visits without rereading records', async () => {
  const first=await loadSnapshot('w','regional','','owner');
  await loadSnapshot('w','corporate','','owner');
  expect(await loadSnapshot('w','regional','','owner')).toBe(first);
  expect(state.reads).toBe(2);
 });
 it('upload revisions replace the snapshot rather than append duplicate rows', async () => {
  await loadSnapshot('w','regional','','owner');state.revision++;
  state.rows.push({id:'b',position:2,payload:{status:'Done'}});
  const next=await loadSnapshot('w','regional','','owner');expect(next.rows).toHaveLength(2);expect(state.reads).toBe(2);
 });
 it('Done updates replace a pending status and refresh data used to calculate SLA', async () => {
  await loadSnapshot('w','regional','','owner');state.revision++;state.rows[0].payload={status:'Done',...{doneDate:'2026-10-12'}};
  const next=await loadSnapshot('w','regional','','owner');expect(next.rows[0].payload).toMatchObject({status:'Done',doneDate:'2026-10-12'});
 });
 it('separates accounts, workspaces, and upload versions', async () => {
  for(const [owner,workspace,version] of [['a','w',''],['b','w',''],['a','other',''],['a','w','old']])await loadSnapshot(workspace,'regional',version,owner);
  expect(state.reads).toBe(4);clearSessionCache();await loadSnapshot('w','regional','','a');expect(state.reads).toBe(5);
 });
 it('does not silently serve cache when revision verification fails', async () => {
  await loadSnapshot('w','regional','','owner');state.fail=true;
  await expect(loadSnapshot('w','regional','','owner')).rejects.toThrow('offline');
 });
 it('retries if an upload changes while paginated rows are being read', async () => {
  state.changeDuringRead=true;await loadSnapshot('w','regional','','owner');expect(state.reads).toBe(2);
 });
 it('checks SLA rules even when no workspace revision changes', async () => {
  await loadSnapshot('w','regional','','owner');state.rules=[{product:'VA',new_days:3,maint_days:2}];
  expect((await loadSnapshot('w','regional','','owner')).rules[0].newDays).toBe(3);expect(state.reads).toBe(2);
 });
});
describe('tab memory lifecycle', () => {
 it('expires cached rows and bounds retained datasets', async () => {
  let now=0;const cache=new SessionCache<number>(10,2,()=>now),load=vi.fn(async()=>1);
  await cache.load('a','1',load);await cache.load('a','1',load);expect(load).toHaveBeenCalledTimes(1);
  now=11;await cache.load('a','1',load);expect(load).toHaveBeenCalledTimes(2);
  await cache.load('b','1',load);await cache.load('c','1',load);await cache.load('a','1',load);expect(load).toHaveBeenCalledTimes(5);
 });
 it('a response arriving after logout cannot repopulate cache', async () => {
  const cache=new SessionCache<number>();let finish!:(n:number)=>void;
  const pending=cache.load('a','1',()=>new Promise(r=>finish=r));cache.clear();finish(1);await pending;
  const loader=vi.fn(async()=>2);expect(await cache.load('a','1',loader)).toBe(2);expect(loader).toHaveBeenCalledOnce();
 });
 it('deduplicates simultaneous requests and discards failed promises', async () => {
  const cache=new SessionCache<number>(),load=vi.fn(async()=>1);
  await Promise.all([cache.load('a','1',load),cache.load('a','1',load)]);expect(load).toHaveBeenCalledOnce();
  await expect(cache.load('b','1',async()=>{throw Error('failed');})).rejects.toThrow();
  expect(await cache.load('b','1',async()=>2)).toBe(2);
 });
});
