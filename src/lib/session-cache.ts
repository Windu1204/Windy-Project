/** Tab memory only. A caller must verify the server revision before every read. */
export class SessionCache<T> {
  private entries = new Map<string, { stamp: string; value: T; expires: number }>();
  private pending = new Map<string, Promise<T>>();
  private generation = 0;
  constructor(private ttl = 60_000, private limit = 8, private now = () => Date.now()) {}
  clear() { this.generation++; this.entries.clear(); this.pending.clear(); }
  async load(key: string, stamp: string, loader: () => Promise<T>): Promise<T> {
    const entry = this.entries.get(key);
    if (entry?.stamp === stamp && entry.expires > this.now()) {
      this.entries.delete(key); this.entries.set(key, entry);
      return entry.value;
    }
    const token = JSON.stringify([key, stamp]), existing = this.pending.get(token);
    if (existing) return existing;
    const generation = this.generation;
    const request = loader().then(value => {
      if (generation === this.generation) {
        this.entries.delete(key);
        this.entries.set(key, { stamp, value, expires: this.now() + this.ttl });
        while (this.entries.size > this.limit) this.entries.delete(this.entries.keys().next().value!);
      }
      return value;
    }).finally(() => { if (this.pending.get(token) === request) this.pending.delete(token); });
    this.pending.set(token, request);
    return request;
  }
}
