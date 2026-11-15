/** Process-local, bounded work. Identical requests share pending work. */
export class WorkQueueBusyError extends Error {}

export class WorkCache<T> {
  private completed = new Map<string, { value: T; expires: number }>();
  private pending = new Map<string, Promise<T>>();
  private active = 0;
  private waiting: (() => void)[] = [];

  constructor(private readonly limits: {
    workers: number;
    waiting: number;
    waitMs: number;
    entries: number;
    ttlMs: number;
  }) {}

  private async acquire() {
    if (this.active < this.limits.workers) {
      this.active++;
      return;
    }
    if (this.waiting.length >= this.limits.waiting) throw new WorkQueueBusyError('Work queue full.');
    await new Promise<void>((resolve, reject) => {
      const ready = () => {
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(() => {
        const i = this.waiting.indexOf(ready);
        if (i >= 0) this.waiting.splice(i, 1);
        reject(new WorkQueueBusyError('Work queue timeout.'));
      }, this.limits.waitMs);
      this.waiting.push(ready);
    });
  }

  private release() {
    const next = this.waiting.shift();
    if (next) next();
    else this.active--;
  }

  run(key: string, work: () => Promise<T>): Promise<T> {
    const cached = this.completed.get(key);
    if (cached && cached.expires > Date.now()) {
      this.completed.delete(key);
      this.completed.set(key, cached);
      return Promise.resolve(cached.value);
    }
    this.completed.delete(key);
    const pending = this.pending.get(key);
    if (pending) return pending;
    const promise = (async () => {
      await this.acquire();
      try {
        const value = await work();
        this.completed.set(key, { value, expires: Date.now() + this.limits.ttlMs });
        if (this.completed.size > this.limits.entries) this.completed.delete(this.completed.keys().next().value!);
        return value;
      } finally {
        this.release();
      }
    })();
    this.pending.set(key, promise);
    const clear = () => this.pending.delete(key);
    // Both settlement handlers return normally, avoiding an unhandled rejection
    // from a detached finally() promise when every shared request has failed.
    void promise.then(clear, clear);
    return promise;
  }
}

export function imageryWorkKey(version: string, z: number, x: number, y: number, start: string, end: string) {
  return `s2-l2a-webp90:${version}:${z}/${x}/${y}:${start}/${end}`;
}
