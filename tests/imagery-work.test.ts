import assert from 'node:assert/strict';
import { test } from 'node:test';
import { imageryWorkKey, WorkCache, WorkQueueBusyError } from '../src/lib/imagery/workCache';
const cache = (overrides = {}) => new WorkCache<number>({ workers: 2, waiting: 2, waitMs: 1000, entries: 2, ttlMs: 3600000, ...overrides });
function deferred() {
  let resolve!: (value: number) => void;
  const promise = new Promise<number>((done) => { resolve = done; });
  return { promise, resolve };
}

test('simultaneous identical raster requests share one job and one completed value', async () => {
  const jobs = cache(), gate = deferred();
  let calls = 0;
  const first = jobs.run('A', () => { calls++; return gate.promise; });
  const duplicates = Array.from({ length: 40 }, () => jobs.run('A', async () => { calls++; return -1; }));
  assert.ok(duplicates.every((p) => p === first));
  await Promise.resolve();
  assert.equal(calls, 1);
  gate.resolve(42);
  assert.deepEqual(await Promise.all([first, ...duplicates]), Array(41).fill(42));
  assert.equal(await jobs.run('A', async () => { calls++; return -1; }), 42);
  assert.equal(calls, 1);
});

test('failed shared work releases capacity and is retryable without stale promises', async () => {
  const jobs = cache({ workers: 1 });
  const error = new Error('upstream failed');
  const a = jobs.run('A', async () => { throw error; });
  const b = jobs.run('A', async () => -1);
  assert.equal(a, b);
  await assert.rejects(a, error);
  assert.equal(await jobs.run('A', async () => 8), 8);
});

test('distinct dates/revisions/tiles stay distinct and bounded queue rejects excess work', async () => {
  const jobs = cache({ workers: 1, waiting: 1 }), gate = deferred();
  const a = imageryWorkKey('revision-1', 14, 9550, 8280, '2025-10-01', '2025-10-31');
  const keys = [a,
    imageryWorkKey('revision-2', 14, 9550, 8280, '2025-10-01', '2025-10-31'),
    imageryWorkKey('revision-1', 14, 9551, 8280, '2025-10-01', '2025-10-31'),
    imageryWorkKey('revision-1', 14, 9550, 8280, '2026-10-01', '2026-10-31')];
  assert.equal(new Set(keys).size, 4);
  const first = jobs.run(a, () => gate.promise);
  const queued = jobs.run(keys[1], async () => 2);
  await assert.rejects(jobs.run(keys[2], async () => 3), WorkQueueBusyError);
  gate.resolve(1);
  assert.deepEqual(await Promise.all([first, queued]), [1, 2]);
  assert.equal(await jobs.run(keys[2], async () => 3), 3, 'rejected key can retry');
});

test('queue deadline removes waiting job, then allows retry and completed cache eviction', async () => {
  const jobs = cache({ workers: 1, waiting: 1, waitMs: 10, entries: 1 }), gate = deferred();
  const first = jobs.run('A', () => gate.promise);
  await assert.rejects(jobs.run('B', async () => 2), WorkQueueBusyError);
  gate.resolve(1);
  await first;
  assert.equal(await jobs.run('B', async () => 2), 2);
  assert.equal(await jobs.run('A', async () => 3), 3, 'old completed entry was evicted');
});
