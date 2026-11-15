import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';

export interface AssetEntry { hash: string; count: number; bytes: number }
// Only deployment configuration controls the asset origin. Caller URLs/Host
// headers can never turn this into a fetch proxy or access internal services.
export function footprintAssetOrigin(environment: { NODE_ENV?: string; VERCEL_URL?: string } = process.env): string {
  const deployment = environment.VERCEL_URL;
  if (deployment) {
    if (!/^[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.vercel\.app$/.test(deployment))
      throw new Error('Invalid configured deployment origin');
    return `https://${deployment}`;
  }
  return environment.NODE_ENV === 'production' ? 'https://rwanda-map.vercel.app' : 'http://localhost:3000';
}
const cache = new Map<string, Buffer>();
let cachedBytes = 0;
const CACHE_BYTES = 16 * 1024 * 1024;
export async function readFootprintAsset(entry: AssetEntry, fetcher: typeof fetch = fetch, origin = footprintAssetOrigin(), signal?: AbortSignal): Promise<unknown[]> {
  signal?.throwIfAborted();
  if (!/^[a-f0-9]{64}$/.test(entry.hash) || entry.bytes < 1 || entry.bytes > 6_000_000)
    throw new Error('Footprint asset exceeds query budget');
  const key = `${origin}/${entry.hash}`;
  let bytes = cache.get(key);
  if (!bytes) {
    const response = await fetcher(`${origin}/data/footprints/objects/${entry.hash}.json.gz`, {
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(10_000)]) : AbortSignal.timeout(10_000), cache: 'no-store', redirect: 'error'
    });
    if (!response.ok || !response.body) throw new Error('Footprint asset unavailable');
    const reader = response.body.getReader(), parts: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > entry.bytes) throw new Error('Footprint asset size mismatch');
        parts.push(value);
      }
    } finally { await reader.cancel(); }
    bytes = Buffer.concat(parts);
    if (bytes.length !== entry.bytes || createHash('sha256').update(bytes).digest('hex') !== entry.hash)
      throw new Error('Footprint asset integrity mismatch');
    while (cachedBytes + bytes.length > CACHE_BYTES && cache.size) {
      const oldest = cache.keys().next().value!;
      cachedBytes -= cache.get(oldest)!.length;
      cache.delete(oldest);
    }
    cache.set(key, bytes); cachedBytes += bytes.length;
  }
  cache.delete(key);
  cache.set(key, bytes);
  const rows: unknown = JSON.parse(gunzipSync(bytes, { maxOutputLength: 32_000_000 }).toString());
  if (!Array.isArray(rows) || rows.length !== entry.count) throw new Error('Invalid footprint records');
  return rows;
}
export async function readFootprintAssets(entries: AssetEntry[], deadlineMs = 8_000): Promise<unknown[]> {
  if (entries.reduce((sum, entry) => sum + entry.bytes, 0) > 16_000_000)
    throw new Error('Select a smaller area for complete building data.');
  const rows: unknown[] = [];
  const signal = AbortSignal.timeout(deadlineMs);
  // Bound transfers and JSON decode memory independently of selection tile count.
  for (let i = 0; i < entries.length; i += 2) {
    signal.throwIfAborted();
    for (const batch of await Promise.all(entries.slice(i, i + 2).map((entry) => readFootprintAsset(entry, fetch, footprintAssetOrigin(), signal))))
      for (const row of batch) rows.push(row);
  }
  return rows;
}
