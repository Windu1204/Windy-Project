import { describe, expect, it, vi } from 'vitest';
import { revisionWatch } from '../src/lib/revision-watch';

describe('workspace revision checks', () => {
 it('does not restart long reads on unchanged polls but refreshes after an upload', async () => {
  let revision='1';const changed=vi.fn();const watch=revisionWatch(async()=>revision,changed,vi.fn());
  await watch.check();await watch.check();await watch.check();expect(changed).not.toHaveBeenCalled();
  revision='2';await watch.check();await watch.check();expect(changed).toHaveBeenCalledOnce();
 });
 it('checks again when a realtime signal arrives during a poll', async () => {
  let finish!:(value:string)=>void;const changed=vi.fn();let calls=0;
  const watch=revisionWatch(()=>++calls===1?new Promise(resolve=>finish=resolve):Promise.resolve('2'),changed,vi.fn());
  const pending=watch.check();await watch.check();finish('1');await pending;
  expect(calls).toBe(2);expect(changed).toHaveBeenCalledOnce();
 });
 it('recovers after a failed check and ignores responses after logout', async () => {
  const changed=vi.fn(),failed=vi.fn();let offline=false;
  const watch=revisionWatch(async()=>{if(offline)throw Error('offline');return offline?'1':'2';},changed,failed);
  offline=true;await watch.check();expect(failed).toHaveBeenCalledOnce();offline=false;await watch.check();
  watch.stop();await watch.check();expect(changed).not.toHaveBeenCalled();
 });
});
