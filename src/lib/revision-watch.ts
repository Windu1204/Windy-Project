/** Polls verify a revision; unchanged polls must not cancel a slow dataset read. */
export function revisionWatch(read: () => Promise<string | null>, changed: () => void, failed: (error: unknown) => void) {
  let stopped = false, running = false, again = false;
  let previous: string | null | undefined;
  async function check() {
    if (stopped) return;
    if (running) { again = true; return; }
    running = true;
    try {
      do {
        again = false;
        const next = await read();
        if (stopped) return;
        if (previous !== undefined && next !== previous) changed();
        previous = next;
      } while (again && !stopped);
    } catch (error) { if (!stopped) failed(error); }
    finally { running = false; }
  }
  return { check, stop() { stopped = true; } };
}
