import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { footprintAssetOrigin, readFootprintAsset } from '../src/lib/analysis/footprintAssets';

test('static footprint reads verify exact bytes, hashes, row counts and bounded streams', async () => {
  const rows = [['stable-full-id', 30000000, -2000000, 99, 0, 2, 87]];
  const bytes = gzipSync(JSON.stringify(rows));
  const entry = { hash: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length, count: 1 };
  let fetched = '';
  const fetcher = (async (url: string) => { fetched = url; return new Response(bytes); }) as typeof fetch;
  assert.deepEqual(await readFootprintAsset(entry, fetcher, 'https://fixture.example'), rows);
  assert.equal(fetched, `https://fixture.example/data/footprints/objects/${entry.hash}.json.gz`);
  await assert.rejects(readFootprintAsset({ ...entry, bytes: 1 }, fetcher, 'https://oversize.example'), /size mismatch/);
  await assert.rejects(readFootprintAsset({ ...entry, hash: '0'.repeat(64) }, fetcher, 'https://hash.example'), /integrity mismatch/);
  await assert.rejects(readFootprintAsset({ ...entry, count: 2 }, fetcher, 'https://count.example'), /Invalid footprint records/);
  await assert.rejects(readFootprintAsset({ ...entry, bytes: 6_000_001 }, fetcher), /budget/);
});

test('asset origins accept only fixed local/production origins or a validated deployment configuration', () => {
  assert.equal(footprintAssetOrigin({ NODE_ENV: 'development' }), 'http://localhost:3000');
  assert.equal(footprintAssetOrigin({ NODE_ENV: 'production' }), 'https://rwanda-map.vercel.app');
  assert.equal(footprintAssetOrigin({ VERCEL_URL: 'rwanda-map-preview.vercel.app' }), 'https://rwanda-map-preview.vercel.app');
  for (const VERCEL_URL of ['127.0.0.1:8000', 'evil.example/path', 'rwanda.vercel.app@evil.example', 'rwanda.vercel.app/../x'])
    assert.throws(() => footprintAssetOrigin({ VERCEL_URL }), /Invalid/);
});
